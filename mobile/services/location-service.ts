import * as Location from 'expo-location';

export type FareShareLocation = {
  latitude: number;
  longitude: number;
  city: string | null;
  stateRegion: string | null;
  postalCode: string | null;
};

export type FareShareCoordinates = {
  latitude: number;
  longitude: number;
};

export async function getCurrentFareShareLocation(): Promise<FareShareLocation> {
  const permission = await Location.requestForegroundPermissionsAsync();

  if (permission.status !== 'granted') {
    throw new Error(
      'Location permission is required to find services near you.'
    );
  }

  const currentLocation = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  const { latitude, longitude } = currentLocation.coords;

  let city: string | null = null;
  let stateRegion: string | null = null;
  let postalCode: string | null = null;

  try {
    const addresses = await Location.reverseGeocodeAsync({
      latitude,
      longitude,
    });

    const address = addresses[0];

    if (address) {
      city = address.city ?? address.subregion ?? null;
      stateRegion = address.region ?? null;
      postalCode = address.postalCode ?? null;
    }
  } catch {
    // Coordinates are still usable even if reverse geocoding fails.
  }

  return {
    latitude,
    longitude,
    city,
    stateRegion,
    postalCode,
  };
}

export async function geocodeBusinessLocation(
  city: string,
  stateRegion: string,
  postalCode: string
): Promise<FareShareCoordinates> {
  const query = [city.trim(), stateRegion.trim(), postalCode.trim()]
    .filter(Boolean)
    .join(', ');

  if (!query) {
    throw new Error('Enter a business location before continuing.');
  }

  const results = await Location.geocodeAsync(query);
  const match = results[0];

  if (!match) {
    throw new Error(
      'FareShare could not find that business location. Check the city, state, and ZIP code.'
    );
  }

  return {
    latitude: match.latitude,
    longitude: match.longitude,
  };
}
