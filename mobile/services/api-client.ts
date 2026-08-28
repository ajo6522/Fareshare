import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'fareshare.accessToken';

function getApiBaseUrl() {
  const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

  if (!apiBaseUrl) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL is not configured.');
  }

  return apiBaseUrl.replace(/\/+$/, '');
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const accessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);

  if (!accessToken) {
    throw new Error('No Cognito access token was found. Sign in again.');
  }

  const headers = new Headers(options.headers);

  headers.set('Accept', 'application/json');
  headers.set('Authorization', `Bearer ${accessToken}`);

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  const response = await fetch(
    `${getApiBaseUrl()}${normalizedPath}`,
    {
      ...options,
      headers,
    }
  );

  const responseText = await response.text();
  let responseBody: unknown = null;

  if (responseText) {
    try {
      responseBody = JSON.parse(responseText);
    } catch {
      responseBody = responseText;
    }
  }

  if (!response.ok) {
    const detail =
      typeof responseBody === 'object' &&
      responseBody !== null &&
      'detail' in responseBody
        ? String((responseBody as { detail: unknown }).detail)
        : `API request failed with status ${response.status}.`;

    throw new Error(detail);
  }

  return responseBody as T;
}