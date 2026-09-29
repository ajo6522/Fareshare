import json
import logging
import os
import re
from contextlib import asynccontextmanager
from datetime import datetime
from decimal import Decimal
from pathlib import Path
from typing import Literal
from uuid import uuid4

import boto3
import jwt
import psycopg
from opensearchpy import AWSV4SignerAuth, OpenSearch, RequestsHttpConnection
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, PlainTextResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient
from jwt.exceptions import PyJWKClientError, PyJWTError
from pydantic import BaseModel, ConfigDict, Field
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool


logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("fareshare-api")
ACCOUNT_DELETION_FUNCTION = os.getenv(
    "ACCOUNT_DELETION_FUNCTION",
    "fareshare-account-deletion",
)
OPENSEARCH_HOST = os.getenv("OPENSEARCH_HOST")
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
lambda_client = boto3.client("lambda", region_name=AWS_REGION)
cognito_client = boto3.client("cognito-idp", region_name=AWS_REGION)

AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
DB_HOST = os.getenv(
    "DB_HOST",
    "fareshare-db.ck54aaaswng8.us-east-1.rds.amazonaws.com",
)
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_NAME = os.getenv("DB_NAME", "fareshare")
DB_SECRET_ID = os.getenv("DB_SECRET_ID")
COGNITO_USER_POOL_ID = os.getenv("COGNITO_USER_POOL_ID")
COGNITO_APP_CLIENT_ID = os.getenv("COGNITO_APP_CLIENT_ID")
S3_BUCKET_NAME = os.getenv("S3_BUCKET_NAME")
S3_UPLOAD_URL_EXPIRATION_SECONDS = 300
S3_DOWNLOAD_URL_EXPIRATION_SECONDS = 300
RDS_CA_BUNDLE = os.getenv(
    "RDS_CA_BUNDLE",
    str(Path(__file__).with_name("global-bundle.pem")),
)

pool: ConnectionPool | None = None
cognito_issuer: str | None = None
cognito_jwks_client: PyJWKClient | None = None
s3_client = None
bearer_scheme = HTTPBearer(auto_error=False)
opensearch_client: OpenSearch | None = None

class AuthenticatedUser(BaseModel):
    sub: str
    username: str | None = None
    scopes: list[str]


class UploadRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    upload_type: Literal["profile", "vehicle"] = Field(alias="uploadType")
    content_type: Literal[
        "image/jpeg",
        "image/png",
        "image/webp",
    ] = Field(alias="contentType")


class UploadUrlResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    upload_url: str = Field(alias="uploadUrl")
    object_key: str = Field(alias="objectKey")
    expires_in: int = Field(alias="expiresIn")


class ProfileImageResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    object_key: str | None = Field(default=None, alias="objectKey")
    image_url: str | None = Field(default=None, alias="imageUrl")
    expires_in: int = Field(alias="expiresIn")


class BusinessMembershipResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    company_id: int = Field(alias="companyId")
    company_name: str = Field(alias="companyName")
    company_slug: str = Field(alias="companySlug")
    role: str
    approval_status: str = Field(alias="approvalStatus")


class BusinessAccessResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    has_business_access: bool = Field(alias="hasBusinessAccess")
    memberships: list[BusinessMembershipResponse]


SupportedServiceType = Literal[
    "airport_shuttle",
    "local_transportation",
    "cleaning_services",
    "junk_removal",
    "landscaping",
]


class BusinessOnboardingRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, str_strip_whitespace=True)

    company_name: str = Field(alias="companyName", min_length=2, max_length=150)
    description: str | None = Field(default=None, max_length=2000)

    city: str = Field(min_length=1, max_length=100)
    state_region: str = Field(
        alias="stateRegion",
        min_length=1,
        max_length=100,
    )
    postal_code: str = Field(
        alias="postalCode",
        min_length=5,
        max_length=10,
    )

    latitude: float
    longitude: float

    service_types: list[SupportedServiceType] = Field(
        alias="serviceTypes",
        min_length=1,
        max_length=5,
    )


class BusinessOnboardingResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    has_business_access: bool = Field(alias="hasBusinessAccess")
    membership: BusinessMembershipResponse
    service_types: list[SupportedServiceType] = Field(alias="serviceTypes")


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

class AccountDeletionRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    delete_business: bool = Field(
        default=False,
        alias="deleteBusiness",
    )

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

UPLOAD_FILE_EXTENSIONS = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}

SUPPORTED_BUSINESS_SERVICES = {
    "airport_shuttle": {
        "name": "Airport shuttle",
        "description": "Transportation to and from the airport",
    },
    "local_transportation": {
        "name": "Local transportation",
        "description": "Local rides and scheduled transportation",
    },
    "cleaning_services": {
        "name": "Cleaning services",
        "description": "Residential and commercial cleaning",
    },
    "junk_removal": {
        "name": "Junk removal",
        "description": "Hauling and unwanted-item removal",
    },
    "landscaping": {
        "name": "Landscaping",
        "description": "Lawn care and outdoor maintenance",
    },
}


def configure_authentication() -> None:
    global cognito_issuer, cognito_jwks_client

    missing_variables = [
        variable_name
        for variable_name, value in (
            ("COGNITO_USER_POOL_ID", COGNITO_USER_POOL_ID),
            ("COGNITO_APP_CLIENT_ID", COGNITO_APP_CLIENT_ID),
        )
        if not value
    ]

    if missing_variables:
        raise RuntimeError(
            "Missing required environment variables: "
            + ", ".join(missing_variables)
        )

    cognito_issuer = (
        f"https://cognito-idp.{AWS_REGION}.amazonaws.com/"
        f"{COGNITO_USER_POOL_ID}"
    )
    cognito_jwks_client = PyJWKClient(
        f"{cognito_issuer}/.well-known/jwks.json",
        timeout=5,
    )
    logger.info("Configured Cognito access-token validation")


def unauthorized_exception() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired access token",
        headers={"WWW-Authenticate": "Bearer"},
    )


def require_access_token(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise unauthorized_exception()

    if cognito_issuer is None or cognito_jwks_client is None:
        logger.error("Cognito token validator is not initialized")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service is unavailable",
        )

    try:
        signing_key = cognito_jwks_client.get_signing_key_from_jwt(
            credentials.credentials
        )
        claims = jwt.decode(
            credentials.credentials,
            signing_key.key,
            algorithms=["RS256"],
            issuer=cognito_issuer,
            leeway=30,
            options={
                "verify_aud": False,
                "require": [
                    "sub",
                    "iss",
                    "exp",
                    "iat",
                    "token_use",
                    "client_id",
                ],
            },
        )
    except (PyJWKClientError, PyJWTError, ValueError):
        logger.warning("Rejected an invalid Cognito access token")
        raise unauthorized_exception() from None

    if claims["token_use"] != "access":
        logger.warning("Rejected a Cognito token with the wrong token_use")
        raise unauthorized_exception()

    if claims["client_id"] != COGNITO_APP_CLIENT_ID:
        logger.warning("Rejected a token issued for a different app client")
        raise unauthorized_exception()

    return claims


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


def configure_storage() -> None:
    global s3_client

    if not S3_BUCKET_NAME:
        raise RuntimeError("S3_BUCKET_NAME environment variable is required")

    s3_client = boto3.client(
        "s3",
        region_name=AWS_REGION,
    )
    logger.info("Configured private S3 upload storage")




def configure_opensearch() -> None:
    global opensearch_client

    if not OPENSEARCH_HOST:
        raise RuntimeError("OPENSEARCH_HOST environment variable is required")

    credentials = boto3.Session().get_credentials()

    if credentials is None:
        raise RuntimeError("AWS credentials are unavailable for OpenSearch")

    auth = AWSV4SignerAuth(
        credentials,
        AWS_REGION,
        "es",
    )

    opensearch_client = OpenSearch(
        hosts=[
            {
                "host": OPENSEARCH_HOST,
                "port": 443,
            }
        ],
        http_auth=auth,
        use_ssl=True,
        verify_certs=True,
        connection_class=RequestsHttpConnection,
    )

    logger.info("Configured OpenSearch client")

def get_opensearch_client() -> OpenSearch:
    if opensearch_client is None:
        raise RuntimeError("OpenSearch client is not initialized")

    return opensearch_client


def get_s3_client():
    if s3_client is None:
        raise RuntimeError("S3 client is not initialized")

    return s3_client


def get_pool() -> ConnectionPool:
    if pool is None:
        raise RuntimeError("Database pool is not initialized")

    return pool


@asynccontextmanager
async def lifespan(_: FastAPI):
    configure_authentication()
    configure_storage()
    configure_opensearch()
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


@app.get("/auth/me", response_model=AuthenticatedUser)
def get_authenticated_user(
    claims: dict = Depends(require_access_token),
):
    username = claims.get("username")
    scope = claims.get("scope")

    return AuthenticatedUser(
        sub=claims["sub"],
        username=username if isinstance(username, str) else None,
        scopes=scope.split() if isinstance(scope, str) else [],
    )
@app.delete("/account")
def delete_account(
    deletion: AccountDeletionRequest,
    claims: dict = Depends(require_access_token),
):
    cognito_sub = claims["sub"]
    cognito_username = claims.get("username")

    if not cognito_username:
        logger.error(
            "Authenticated Cognito user %s has no username claim",
            cognito_sub,
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="FareShare could not identify your Cognito account",
        )

    # --------------------------------------------------
    # 1. Invoke the RDS account-deletion Lambda
    # --------------------------------------------------

    try:
        response = lambda_client.invoke(
            FunctionName=ACCOUNT_DELETION_FUNCTION,
            InvocationType="RequestResponse",
            Payload=json.dumps(
                {
                    "cognito_sub": cognito_sub,
                    "delete_business": deletion.delete_business,
                }
            ).encode("utf-8"),
        )

        payload = json.loads(
            response["Payload"].read().decode("utf-8")
        )

    except (BotoCoreError, ClientError, ValueError, TypeError):
        logger.exception(
            "Could not invoke account-deletion Lambda for %s",
            cognito_sub,
        )

        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="FareShare could not delete your account",
        ) from None

    # --------------------------------------------------
    # 2. Detect Lambda execution failure
    # --------------------------------------------------

    if response.get("FunctionError"):
        logger.error(
            "Account-deletion Lambda failed for %s: %s",
            cognito_sub,
            payload,
        )

        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="FareShare could not delete your account",
        )

    lambda_status = payload.get("statusCode")
    lambda_body = payload.get(
        "body",
        "FareShare could not delete your account",
    )

    # --------------------------------------------------
    # 3. Sole-owner protection
    # --------------------------------------------------

    if lambda_status == 409:
        logger.info(
            "Account deletion blocked for sole owner %s",
            cognito_sub,
        )

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=lambda_body,
        )

    # --------------------------------------------------
    # 4. Handle any other Lambda failure
    # --------------------------------------------------

    if lambda_status != 200:
        logger.error(
            "Account-deletion Lambda returned %s for %s: %s",
            lambda_status,
            cognito_sub,
            payload,
        )

        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=lambda_body,
        )

    # --------------------------------------------------
    # 5. RDS cleanup succeeded.
    #    Now delete Cognito identity.
    # --------------------------------------------------

    try:
        cognito_client.admin_delete_user(
            UserPoolId=COGNITO_USER_POOL_ID,
            Username=cognito_username,
        )

    except cognito_client.exceptions.UserNotFoundException:
        logger.warning(
            "Cognito user %s was already deleted",
            cognito_sub,
        )

    except (BotoCoreError, ClientError):
        logger.exception(
            "RDS cleanup succeeded but Cognito deletion failed for %s",
            cognito_sub,
        )

        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Your FareShare profile was removed, but "
                "Cognito account deletion could not be completed"
            ),
        ) from None

    logger.info(
        "Deleted FareShare account for Cognito user %s. "
        "delete_business=%s",
        cognito_sub,
        deletion.delete_business,
    )

    return {
        "message": "Account deleted successfully",
        "businessDeleted": deletion.delete_business,
    }

@app.post("/uploads", response_model=UploadUrlResponse)
def create_upload_endpoint(
    upload: UploadRequest,
    claims: dict = Depends(require_access_token),
):
    extension = UPLOAD_FILE_EXTENSIONS[upload.content_type]
    object_key = (
        f"{upload.upload_type}/{claims['sub']}/{uuid4().hex}{extension}"
    )

    try:
        upload_url = get_s3_client().generate_presigned_url(
            ClientMethod="put_object",
            Params={
                "Bucket": S3_BUCKET_NAME,
                "Key": object_key,
            
            },
            ExpiresIn=S3_UPLOAD_URL_EXPIRATION_SECONDS,
            HttpMethod="PUT",
        )
    except (BotoCoreError, ClientError):
        logger.exception(
            "Could not generate an S3 upload URL for Cognito user %s",
            claims["sub"],
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="FareShare could not prepare the image upload",
        ) from None

    logger.info(
        "Generated an S3 upload URL for Cognito user %s and object %s",
        claims["sub"],
        object_key,
    )
    return UploadUrlResponse(
        upload_url=upload_url,
        object_key=object_key,
        expires_in=S3_UPLOAD_URL_EXPIRATION_SECONDS,
    )


@app.get("/profile/image", response_model=ProfileImageResponse)
def get_profile_image_endpoint(
    claims: dict = Depends(require_access_token),
):
    try:
        with get_pool().connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT profile_image_key
                    FROM public.users
                    WHERE cognito_sub = %s::uuid
                    """,
                    (claims["sub"],),
                )
                user = cursor.fetchone()
    except psycopg.Error:
        logger.exception("Could not load the authenticated user profile")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="FareShare could not load your profile",
        ) from None

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile was not found",
        )

    object_key = user["profile_image_key"]

    if not object_key:
        return ProfileImageResponse(
            object_key=None,
            image_url=None,
            expires_in=0,
        )

    try:
        image_url = get_s3_client().generate_presigned_url(
            ClientMethod="get_object",
            Params={
                "Bucket": S3_BUCKET_NAME,
                "Key": object_key,
            },
            ExpiresIn=S3_DOWNLOAD_URL_EXPIRATION_SECONDS,
        )
    except (BotoCoreError, ClientError):
        logger.exception(
            "Could not generate a profile-image URL for Cognito user %s",
            claims["sub"],
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="FareShare could not load your profile image",
        ) from None

    return ProfileImageResponse(
        object_key=object_key,
        image_url=image_url,
        expires_in=S3_DOWNLOAD_URL_EXPIRATION_SECONDS,
    )


@app.get(
    "/profile/business-access",
    response_model=BusinessAccessResponse,
)
def get_business_access_endpoint(
    claims: dict = Depends(require_access_token),
):
    try:
        with get_pool().connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT
                        u.user_id,
                        c.company_id,
                        c.name AS company_name,
                        c.slug AS company_slug,
                        c.approval_status,
                        cm.role
                    FROM public.users AS u
                    LEFT JOIN public.company_members AS cm
                        ON cm.user_id = u.user_id
                    LEFT JOIN public.companies AS c
                        ON c.company_id = cm.company_id
                    WHERE u.cognito_sub = %s::uuid
                    ORDER BY cm.company_member_id ASC
                    """,
                    (claims["sub"],),
                )
                rows = cursor.fetchall()
    except psycopg.Error:
        logger.exception(
            "Could not load business access for Cognito user %s",
            claims["sub"],
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="FareShare could not load your business access",
        ) from None

    if not rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile was not found",
        )

    memberships = [
        BusinessMembershipResponse(
            company_id=row["company_id"],
            company_name=row["company_name"],
            company_slug=row["company_slug"],
            role=row["role"],
            approval_status=row["approval_status"],
        )
        for row in rows
        if row["company_id"] is not None
    ]

    return BusinessAccessResponse(
        has_business_access=bool(memberships),
        memberships=memberships,
    )


@app.post(
    "/businesses/onboarding",
    response_model=BusinessOnboardingResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_business_onboarding_endpoint(
    onboarding: BusinessOnboardingRequest,
    claims: dict = Depends(require_access_token),
):
    service_types = list(dict.fromkeys(onboarding.service_types))
    slug_base = re.sub(r"[^a-z0-9]+", "-", onboarding.company_name.lower())
    slug_base = slug_base.strip("-")[:130] or "business"
    company_slug = f"{slug_base}-{uuid4().hex[:8]}"
    business_category = (
        service_types[0] if len(service_types) == 1 else "multi_service"
    )

    try:
        with get_pool().connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT user_id
                    FROM public.users
                    WHERE cognito_sub = %s::uuid
                    FOR UPDATE
                    """,
                    (claims["sub"],),
                )
                user = cursor.fetchone()

                if user is None:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="User profile was not found",
                    )

                cursor.execute(
                    """
                    SELECT company_id
                    FROM public.company_members
                    WHERE user_id = %s
                    LIMIT 1
                    """,
                    (user["user_id"],),
                )

                if cursor.fetchone() is not None:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="This account already has business access",
                    )

                cursor.execute(
                    """
                    INSERT INTO public.companies (
                        name,
                        slug,
                        description,
                        business_category,
                        city,
                        state_region,
                        postal_code
                        latitude,
                        longitude
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    RETURNING company_id, name, slug, approval_status
                    """,
                    (
                        onboarding.company_name,
                        company_slug,
                        onboarding.description,
                        business_category,
                        onboarding.city,
                        onboarding.state_region,
                        onboarding.postal_code,
                        onboarding.latitude,
                        onboarding.longitude,
                    ),
                )
                company = cursor.fetchone()

                cursor.execute(
                    """
                    INSERT INTO public.company_members (
                        company_id,
                        user_id,
                        role
                    )
                    VALUES (%s, %s, 'OWNER')
                    RETURNING role
                    """,
                    (company["company_id"], user["user_id"]),
                )
                membership = cursor.fetchone()

                for service_type in service_types:
                    service = SUPPORTED_BUSINESS_SERVICES[service_type]
                    cursor.execute(
                        """
                        INSERT INTO public.services (
                            company_id,
                            driver_profile_id,
                            service_name,
                            description,
                            pricing_type,
                            is_active
                        )
                        VALUES (%s, NULL, %s, %s, 'QUOTE', FALSE)
                        """,
                        (
                            company["company_id"],
                            service["name"],
                            service["description"],
                        ),
                    )
    except HTTPException:
        raise
    except psycopg.Error:
        logger.exception(
            "Could not create business access for Cognito user %s",
            claims["sub"],
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="FareShare could not create your business account",
        ) from None

    logger.info(
        "Created company %s and OWNER access for Cognito user %s",
        company["company_id"],
        claims["sub"],
    )
    return BusinessOnboardingResponse(
        has_business_access=True,
        membership=BusinessMembershipResponse(
            company_id=company["company_id"],
            company_name=company["name"],
            company_slug=company["slug"],
            role=membership["role"],
            approval_status=company["approval_status"],
        ),
        service_types=service_types,
    )


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
