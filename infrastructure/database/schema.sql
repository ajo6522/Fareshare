CREATE TABLE users (
    user_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cognito_sub UUID UNIQUE,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone_number VARCHAR(20),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    profile_image_key TEXT,
    bio TEXT,
    city VARCHAR(100),
    state_region VARCHAR(100),
    account_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE companies (
    company_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    name VARCHAR(150) NOT NULL,
    slug VARCHAR(150) UNIQUE NOT NULL,

    description TEXT,

    website_url TEXT,
    phone_number VARCHAR(20),
    email VARCHAR(255),

    logo_image_key TEXT,
    cover_image_key TEXT,
    business_category VARCHAR(50),

    city VARCHAR(100),
    state_region VARCHAR(100),
    postal_code VARCHAR(10),
    service_radius_miles INTEGER CHECK (service_radius_miles > 0),
    service_area_description TEXT,

    approval_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE company_members (
    company_member_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(company_id),
    user_id INTEGER NOT NULL REFERENCES users(user_id),
    role VARCHAR(20) NOT NULL,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, user_id)
);
CREATE TABLE driver_profiles (
    driver_profile_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    user_id INTEGER UNIQUE NOT NULL REFERENCES users(user_id),
    company_id INTEGER REFERENCES companies(company_id),

    display_name VARCHAR(150),
    bio TEXT,

    phone_number VARCHAR(20),
    email VARCHAR(255),
    website_url TEXT,

    profile_image_key TEXT,

    city VARCHAR(100),
    state_region VARCHAR(100),
    postal_code VARCHAR(10),
    service_radius_miles INTEGER CHECK (service_radius_miles > 0),
    service_area_description TEXT,

    license_number VARCHAR(100) UNIQUE NOT NULL,
    license_state_region VARCHAR(100) NOT NULL,

    availability_status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE',
    approval_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE vehicles (
    vehicle_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    company_id INTEGER REFERENCES companies(company_id),
    driver_profile_id INTEGER REFERENCES driver_profiles(driver_profile_id),
    make VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    vehicle_year INTEGER NOT NULL,
    color VARCHAR(50),
    license_plate VARCHAR(20) UNIQUE NOT NULL,
    state_region VARCHAR(100),
    passenger_capacity INTEGER NOT NULL,
    wheelchair_accessible BOOLEAN NOT NULL DEFAULT FALSE,
    vehicle_image_key TEXT,
    approval_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT vehicle_owner_check CHECK (
        (company_id IS NOT NULL AND driver_profile_id IS NULL)
        OR
        (company_id IS NULL AND driver_profile_id IS NOT NULL)
    )
);
CREATE TABLE rides (
    ride_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(company_id),
    vehicle_id INTEGER REFERENCES vehicles(vehicle_id),

    pickup_location TEXT NOT NULL,
    destination_location TEXT NOT NULL,
    departure_time TIMESTAMPTZ NOT NULL,
    available_seats INTEGER NOT NULL CHECK (available_seats >= 0),
    price DECIMAL(10, 2) CHECK (price >= 0),

    ride_status VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ride_requests (
    ride_request_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    user_id INTEGER NOT NULL REFERENCES users(user_id),

    company_id INTEGER REFERENCES companies(company_id),
    driver_profile_id INTEGER REFERENCES driver_profiles(driver_profile_id),

    service_id INTEGER REFERENCES services(service_id),

    pickup_location TEXT NOT NULL,
    destination_location TEXT NOT NULL,
    requested_pickup_time TIMESTAMPTZ NOT NULL,

    passenger_count INTEGER NOT NULL
        CHECK (passenger_count > 0),

    accessibility_notes TEXT,
    rider_notes TEXT,

    quoted_price DECIMAL(10,2)
        CHECK (quoted_price >= 0),

    request_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT ride_request_provider_check CHECK (
        (company_id IS NOT NULL AND driver_profile_id IS NULL)
        OR
        (company_id IS NULL AND driver_profile_id IS NOT NULL)
    )
);
CREATE TABLE services (
    service_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    company_id INTEGER REFERENCES companies(company_id),
    driver_profile_id INTEGER REFERENCES driver_profiles(driver_profile_id),

    service_name VARCHAR(100) NOT NULL,
    description TEXT,

    pricing_type VARCHAR(20) NOT NULL DEFAULT 'QUOTE',
    starting_price DECIMAL(10,2) CHECK (starting_price >= 0),

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT service_provider_check CHECK (
        (company_id IS NOT NULL AND driver_profile_id IS NULL)
        OR
        (company_id IS NULL AND driver_profile_id IS NOT NULL)
    )
);
CREATE TABLE reviews (
    review_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    ride_request_id INTEGER UNIQUE NOT NULL
        REFERENCES ride_requests(ride_request_id),

    user_id INTEGER NOT NULL
        REFERENCES users(user_id),

    company_id INTEGER
        REFERENCES companies(company_id),

    driver_profile_id INTEGER
        REFERENCES driver_profiles(driver_profile_id),

    rating INTEGER NOT NULL
        CHECK (rating BETWEEN 1 AND 5),

    review_text TEXT,

    review_status VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED',

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT review_provider_check CHECK (
        (company_id IS NOT NULL AND driver_profile_id IS NULL)
        OR
        (company_id IS NULL AND driver_profile_id IS NOT NULL)
    )
);