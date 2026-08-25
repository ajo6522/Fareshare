import json
import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime
from decimal import Decimal
from pathlib import Path

import boto3
import psycopg
from fastapi import FastAPI
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, PlainTextResponse
from pydantic import BaseModel, ConfigDict, Field
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool


logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("fareshare-api")


AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
DB_HOST = os.getenv(
    "DB_HOST",
    "fareshare-db.ck54aaaswng8.us-east-1.rds.amazonaws.com",
)
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_NAME = os.getenv("DB_NAME", "fareshare")
DB_SECRET_ID = os.getenv("DB_SECRET_ID")
RDS_CA_BUNDLE = os.getenv(
    "RDS_CA_BUNDLE",
    str(Path(__file__).with_name("global-bundle.pem")),
)

pool: ConnectionPool | None = None


class RideCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True, str_strip_whitespace=True)

    company_id: int = Field(alias="companyId", gt=0)
    vehicle_id: int | None = Field(default=None, alias="vehicleId", gt=0)
    pickup_location: str = Field(alias="pickupLocation", min_length=1)
    destination_location: str = Field(alias="destinationLocation", min_length=1)
    departure_time: datetime = Field(alias="departureTime")
    available_seats: int = Field(alias="availableSeats", ge=0)
    price: Decimal | None = Field(default=None, ge=0)


class RideRequestCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True, str_strip_whitespace=True)

    user_id: int = Field(alias="userId", gt=0)
    service_id: int | None = Field(default=None, alias="serviceId", gt=0)
    pickup_location: str = Field(alias="pickupLocation", min_length=1)
    destination_location: str = Field(alias="destinationLocation", min_length=1)
    requested_pickup_time: datetime = Field(alias="requestedPickupTime")
    passenger_count: int = Field(alias="passengerCount", gt=0)
    accessibility_notes: str | None = Field(
        default=None,
        alias="accessibilityNotes",
    )
    rider_notes: str | None = Field(default=None, alias="riderNotes")


class RequestStatusUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True, str_strip_whitespace=True)

    request_status: str = Field(alias="requestStatus", min_length=1)


VALID_REQUEST_STATUSES = {
    "PENDING",
    "ACCEPTED",
    "REJECTED",
    "CANCELLED",
    "COMPLETED",
}

ALLOWED_REQUEST_TRANSITIONS = {
    "PENDING": {"ACCEPTED", "REJECTED", "CANCELLED"},
    "ACCEPTED": {"COMPLETED", "CANCELLED"},
    "REJECTED": set(),
    "CANCELLED": set(),
    "COMPLETED": set(),
}


def connect_to_database() -> None:
    global pool

    if not DB_SECRET_ID:
        raise RuntimeError("DB_SECRET_ID environment variable is required")

    if not Path(RDS_CA_BUNDLE).is_file():
        raise RuntimeError(f"RDS CA bundle not found: {RDS_CA_BUNDLE}")

    secrets_client = boto3.client(
        "secretsmanager",
        region_name=AWS_REGION,
    )
    response = secrets_client.get_secret_value(SecretId=DB_SECRET_ID)
    secret = json.loads(response["SecretString"])

    if not secret.get("username") or not secret.get("password"):
        raise RuntimeError("RDS secret is missing username or password")

    candidate_pool = ConnectionPool(
        conninfo="",
        kwargs={
            "host": DB_HOST,
            "port": DB_PORT,
            "dbname": DB_NAME,
            "user": secret["username"],
            "password": secret["password"],
            "sslmode": "verify-full",
            "sslrootcert": RDS_CA_BUNDLE,
            "row_factory": dict_row,
        },
        min_size=1,
        max_size=5,
        timeout=10,
        open=False,
    )

    try:
        candidate_pool.open(wait=True)

        with candidate_pool.connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute("SELECT NOW() AS database_time")
                result = cursor.fetchone()
    except Exception:
        candidate_pool.close()
        raise

    pool = candidate_pool
    logger.info("Connected securely to PostgreSQL RDS")
    logger.info("Database time: %s", result["database_time"])


def get_pool() -> ConnectionPool:
    if pool is None:
        raise RuntimeError("Database pool is not initialized")

    return pool


@asynccontextmanager
async def lifespan(_: FastAPI):
    connect_to_database()

    try:
        yield
    finally:
        if pool is not None:
            pool.close()
            logger.info("PostgreSQL connection pool closed")


app = FastAPI(
    title="FareShare API",
    version="1.0.0",
    lifespan=lifespan,
)


@app.exception_handler(RequestValidationError)
async def validation_error_handler(_, exc: RequestValidationError):
    return JSONResponse(
        status_code=400,
        content={
            "message": "Invalid request data",
            "errors": jsonable_encoder(exc.errors()),
        },
    )


@app.get("/health", response_class=PlainTextResponse)
def health():
    return "OK"


@app.get("/rides")
def get_rides():
    try:
        with get_pool().connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT
                        ride_id,
                        company_id,
                        vehicle_id,
                        pickup_location,
                        destination_location,
                        departure_time,
                        available_seats,
                        price,
                        ride_status,
                        created_at,
                        updated_at
                    FROM rides
                    ORDER BY departure_time ASC
                    """
                )
                return cursor.fetchall()
    except psycopg.Error:
        logger.exception("Error retrieving rides")
        return JSONResponse(
            status_code=500,
            content={"message": "Internal Server Error"},
        )


@app.get("/rides/{ride_id}")
def get_ride(ride_id: int):
    try:
        with get_pool().connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT
                        ride_id,
                        company_id,
                        vehicle_id,
                        pickup_location,
                        destination_location,
                        departure_time,
                        available_seats,
                        price,
                        ride_status,
                        created_at,
                        updated_at
                    FROM rides
                    WHERE ride_id = %s
                    """,
                    (ride_id,),
                )
                ride = cursor.fetchone()

        if ride is None:
            return JSONResponse(
                status_code=404,
                content={"message": "Ride not found"},
            )

        return ride
    except psycopg.Error:
        logger.exception("Error retrieving ride %s", ride_id)
        return JSONResponse(
            status_code=500,
            content={"message": "Internal Server Error"},
        )


@app.post("/rides", status_code=201)
def create_ride(ride: RideCreate):
    try:
        with get_pool().connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO rides (
                        company_id,
                        vehicle_id,
                        pickup_location,
                        destination_location,
                        departure_time,
                        available_seats,
                        price
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    RETURNING *
                    """,
                    (
                        ride.company_id,
                        ride.vehicle_id,
                        ride.pickup_location,
                        ride.destination_location,
                        ride.departure_time,
                        ride.available_seats,
                        ride.price,
                    ),
                )
                return cursor.fetchone()
    except psycopg.Error:
        logger.exception("Error creating ride")
        return JSONResponse(
            status_code=500,
            content={"message": "Internal Server Error"},
        )


@app.get("/rides/{ride_id}/requests")
def get_ride_requests(ride_id: int):
    try:
        with get_pool().connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT *
                    FROM ride_requests
                    WHERE ride_id = %s
                    ORDER BY created_at ASC
                    """,
                    (ride_id,),
                )
                return cursor.fetchall()
    except psycopg.Error:
        logger.exception("Error retrieving requests for ride %s", ride_id)
        return JSONResponse(
            status_code=500,
            content={"message": "Internal Server Error"},
        )


@app.post("/rides/{ride_id}/requests", status_code=201)
def create_ride_request(ride_id: int, request: RideRequestCreate):
    try:
        with get_pool().connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT ride_id, company_id
                    FROM rides
                    WHERE ride_id = %s
                    """,
                    (ride_id,),
                )
                ride = cursor.fetchone()

                if ride is None:
                    return JSONResponse(
                        status_code=404,
                        content={"message": "Ride not found"},
                    )

                cursor.execute(
                    """
                    INSERT INTO ride_requests (
                        ride_id,
                        user_id,
                        company_id,
                        driver_profile_id,
                        service_id,
                        pickup_location,
                        destination_location,
                        requested_pickup_time,
                        passenger_count,
                        accessibility_notes,
                        rider_notes
                    )
                    VALUES (%s, %s, %s, NULL, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING *
                    """,
                    (
                        ride["ride_id"],
                        request.user_id,
                        ride["company_id"],
                        request.service_id,
                        request.pickup_location,
                        request.destination_location,
                        request.requested_pickup_time,
                        request.passenger_count,
                        request.accessibility_notes,
                        request.rider_notes,
                    ),
                )
                return cursor.fetchone()
    except psycopg.Error:
        logger.exception("Error creating request for ride %s", ride_id)
        return JSONResponse(
            status_code=500,
            content={"message": "Internal Server Error"},
        )


@app.patch("/requests/{request_id}")
def update_request_status(request_id: int, update: RequestStatusUpdate):
    new_status = update.request_status.upper()

    if new_status not in VALID_REQUEST_STATUSES:
        return JSONResponse(
            status_code=400,
            content={
                "message": (
                    "Invalid requestStatus. Allowed values: "
                    + ", ".join(sorted(VALID_REQUEST_STATUSES))
                )
            },
        )

    try:
        with get_pool().connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT *
                    FROM ride_requests
                    WHERE ride_request_id = %s
                    FOR UPDATE
                    """,
                    (request_id,),
                )
                ride_request = cursor.fetchone()

                if ride_request is None:
                    return JSONResponse(
                        status_code=404,
                        content={"message": "Ride request not found"},
                    )

                current_status = ride_request["request_status"].upper()

                if new_status == current_status:
                    return ride_request

                allowed_next_statuses = ALLOWED_REQUEST_TRANSITIONS.get(
                    current_status,
                    set(),
                )

                if new_status not in allowed_next_statuses:
                    return JSONResponse(
                        status_code=409,
                        content={
                            "message": (
                                f"Cannot change request status from "
                                f"{current_status} to {new_status}"
                            )
                        },
                    )

                cursor.execute(
                    """
                    UPDATE ride_requests
                    SET
                        request_status = %s,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE ride_request_id = %s
                    RETURNING *
                    """,
                    (new_status, request_id),
                )
                return cursor.fetchone()
    except psycopg.Error:
        logger.exception("Error updating ride request %s", request_id)
        return JSONResponse(
            status_code=500,
            content={"message": "Internal Server Error"},
        )
