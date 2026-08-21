const express = require("express");
const { Pool } = require("pg");
const {
  SecretsManagerClient,
  GetSecretValueCommand,
} = require("@aws-sdk/client-secrets-manager");

const app = express();
app.use(express.json());

const PORT = 3000;

const DB_HOST =
  "fareshare-db.ck54aaaswng8.us-east-1.rds.amazonaws.com";

const DB_NAME = "fareshare";
const DB_PORT = 5432;

const SECRET_ID =
  "arn:aws:secretsmanager:us-east-1:577638364357:secret:rds!db-aabefbc2-2c4c-4bce-a22e-58e8a63c4003-69MCtf";

const secretsClient = new SecretsManagerClient({
  region: "us-east-1",
});

let pool;

// Connect to RDS using the password stored in AWS Secrets Manager
async function connectToDatabase() {
  const response = await secretsClient.send(
    new GetSecretValueCommand({
      SecretId: SECRET_ID,
    })
  );

  const secret = JSON.parse(response.SecretString);

  pool = new Pool({
    host: DB_HOST,
    port: DB_PORT,
    database: DB_NAME,
    user: secret.username,
    password: secret.password,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  // Test the database connection
  const result = await pool.query("SELECT NOW()");

  console.log("Connected to PostgreSQL RDS");
  console.log("Database time:", result.rows[0].now);
}

// Health check
app.get("/health", (req, res) => {
  res.send("OK");
});

// Get all rides from PostgreSQL
app.get("/rides", async (req, res) => {
  try {
    const result = await pool.query(`
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
    `);

    res.json(result.rows);
  } catch (error) {
    console.error("Error retrieving rides:", error);

    res.status(500).json({
      message: "Internal Server Error",
    });
  }
});

// Get a single ride from PostgreSQL
app.get("/rides/:rideId", async (req, res) => {
  try {
    const result = await pool.query(
      `
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
      WHERE ride_id = $1
      `,
      [req.params.rideId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Ride not found",
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error retrieving ride:", error);

    res.status(500).json({
      message: "Internal Server Error",
    });
  }
});

// Get ride requests
app.get("/rides/:rideId/requests", async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT *
      FROM ride_requests
      WHERE ride_request_id = $1
      `,
      [req.params.rideId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Error retrieving ride requests:", error);

    res.status(500).json({
      message: "Internal Server Error",
    });
  }
});

// Start the application only after the database connection succeeds
async function startServer() {
  try {
    await connectToDatabase();

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to connect to database:", error);
    process.exit(1);
  }
}

startServer();