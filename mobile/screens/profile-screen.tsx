import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'fareshare.accessToken';

export type ImageContentType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp';

type UploadType = 'profile' | 'vehicle';

export type UploadUrlResponse = {
  uploadUrl: string;
  objectKey: string;
  expiresIn: number;
};

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
  const response = await fetch(`${getApiBaseUrl()}${normalizedPath}`, {
    ...options,
    headers,
  });

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

export function createUploadUrl(
  uploadType: UploadType,
  contentType: ImageContentType
) {
  return apiRequest<UploadUrlResponse>('/uploads', {
    method: 'POST',
    body: JSON.stringify({ uploadType, contentType }),
  });
}

export async function uploadImageToS3(
  uploadUrl: string,
  imageUri: string,
  contentType: ImageContentType
) {
  const imageResponse = await fetch(imageUri);

  if (!imageResponse.ok) {
    throw new Error('FareShare could not read the selected image.');
  }

  const imageBlob = await imageResponse.blob();
  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
    },
    body: imageBlob,
  });

  if (!uploadResponse.ok) {
    throw new Error('FareShare could not upload the selected image.');
  }
}
