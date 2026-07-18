const express = require("express");

const app = express();
app.use(express.json());

const PORT = 3000;

// Sample data
const rides = [
  {
    rideId: 1,
    origin: "Downtown",
    destination: "Airport",
    availableSeats: 3,
  },
];

// Health check
app.get("/health", (req, res) => {
  res.send("OK");
});

// Get all rides
app.get("/rides", (req, res) => {
  res.json(rides);
});

// Get a single ride
app.get("/rides/:rideId", (req, res) => {
  const ride = rides.find(
    (ride) => ride.rideId === parseInt(req.params.rideId)
  );

  if (!ride) {
    return res.status(404).json({
      message: "Ride not found",
    });
  }

  res.json(ride);
});

// Create a ride
app.post("/rides", (req, res) => {
  const { origin, destination, availableSeats } = req.body;

  if (!origin || !destination || !availableSeats) {
    return res.status(400).json({
      message: "origin, destination and availableSeats are required",
    });
  }

  try {
    const newRide = {
      rideId: rides.length + 1,
      origin,
      destination,
      availableSeats,
    };

    rides.push(newRide);

    res.status(201).json(newRide);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Internal Server Error",
    });
  }
});

// Get ride requests
app.get("/rides/:rideId/requests", (req, res) => {
  res.json([]);
});

// Update a ride request
app.patch("/requests/:requestId", (req, res) => {
  res.json({
    message: "Ride request updated (sample response)",
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});