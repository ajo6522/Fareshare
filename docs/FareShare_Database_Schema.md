# FareShare Database Schema

This document is the database structure for the FareShare application.

## Users

| Field | Constraints |
|---|---|
| `user_id` | Primary key |
| `cognito_sub` | Unique, required |
| `email` | Unique, required |
| `phone_number` | Optional |
| `first_name` | Required |
| `last_name` | Required |
| `profile_image_key` | Optional |
| `created_at` | Required |
| `updated_at` | Required |

## Drivers

| Field | Constraints |
|---|---|
| `driver_id` | Primary key |
| `user_id` | Foreign key → `users.user_id` |
| `verification_status` | Required |
| `created_at` | Required |
| `updated_at` | Required |

Allowed `verification_status` values:

- `PENDING`
- `VERIFIED`
- `REJECTED`
- `SUSPENDED`

## Vehicles

| Field | Constraints |
|---|---|
| `vehicle_id` | Primary key |
| `driver_id` | Foreign key → `drivers.driver_id` |
| `make` | Required |
| `model` | Required |
| `vehicle_year` | Optional |
| `color` | Optional |
| `license_plate_number` | Unique, required |
| `created_at` | Required |
| `updated_at` | Required |

## Rides

| Field | Constraints |
|---|---|
| `ride_id` | Primary key |
| `driver_id` | Foreign key → `drivers.driver_id` |
| `vehicle_id` | Foreign key → `vehicles.vehicle_id` |
| `origin` | Required |
| `destination` | Required |
| `departure_time` | Required |
| `estimated_duration_minutes` | Optional |
| `available_seats` | Required |
| `status` | Required |
| `created_at` | Required |
| `updated_at` | Required |



## Ride Requests

| Field | Constraints |
|---|---|
| `request_id` | Primary key |
| `ride_id` | Foreign key → `rides.ride_id` |
| `rider_id` | Foreign key → `users.user_id` |
| `request_status` | Required |
| `created_at` | Required |
| `updated_at` | Required |

Allowed `request_status` values:

- `PENDING`
- `ACCEPTED`
- `REJECTED`
- `CANCELED`

## Relationships

- A user can have a driver record through `drivers.user_id`.
- A driver can own one or more vehicles.
- A driver can create one or more rides.
- Each ride uses one vehicle belonging to a driver.
- A ride can have zero or more ride requests.
- A user can create zero or more ride requests.

## Notes

- Allowed values for `rides.status` have not yet been defined.
- Fields not marked as required are currently treated as optional.
