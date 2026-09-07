import * as SecureStore from 'expo-secure-store';

import { cognitoConfig } from '../config/cognito';

const ACCESS_TOKEN_KEY = 'fareshare.accessToken';
const PREFERRED_NAME_ATTRIBUTE = 'custom:Preferred';

type CognitoAttribute = {
  Name: string;
  Value?: string;
};

type GetUserResponse = {
  Username: string;
  UserAttributes?: CognitoAttribute[];
};

type CognitoErrorResponse = {
  message?: string;
  Message?: string;
};

async function getAccessToken(): Promise<string> {
  const accessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);

  if (!accessToken) {
    throw new Error('No Cognito access token was found. Sign in again.');
  }

  return accessToken;
}

async function cognitoRequest<T>(
  operation: 'GetUser' | 'UpdateUserAttributes',
  body: Record<string, unknown>
): Promise<T> {
  const response = await fetch(
    `https://cognito-idp.${cognitoConfig.region}.amazonaws.com/`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target':
          `AWSCognitoIdentityProviderService.${operation}`,
      },
      body: JSON.stringify(body),
    }
  );

  const responseText = await response.text();
  let responseBody: unknown = {};

  if (responseText) {
    try {
      responseBody = JSON.parse(responseText);
    } catch {
      responseBody = {};
    }
  }

  if (!response.ok) {
    const cognitoError = responseBody as CognitoErrorResponse;
    throw new Error(
      cognitoError.message ??
        cognitoError.Message ??
        'FareShare could not update your Cognito profile.'
    );
  }

  return responseBody as T;
}

async function getCognitoAttributes(): Promise<Map<string, string>> {
  const accessToken = await getAccessToken();
  const user = await cognitoRequest<GetUserResponse>('GetUser', {
    AccessToken: accessToken,
  });

  return new Map(
    (user.UserAttributes ?? [])
      .filter(
        (attribute): attribute is Required<CognitoAttribute> =>
          typeof attribute.Value === 'string'
      )
      .map((attribute) => [attribute.Name, attribute.Value] as const)
  );
}

export async function getCognitoPreferredName(): Promise<string | null> {
  const attributes = await getCognitoAttributes();
  const preferredName = attributes.get(PREFERRED_NAME_ATTRIBUTE)?.trim();

  return preferredName || null;
}

export async function hasCognitoPreferredName(): Promise<boolean> {
  return (await getCognitoPreferredName()) !== null;
}

export async function getCognitoDisplayName(): Promise<string> {
  const attributes = await getCognitoAttributes();
  const displayName =
    attributes.get(PREFERRED_NAME_ATTRIBUTE)?.trim() ||
    attributes.get('given_name')?.trim() ||
    attributes.get('name')?.trim();

  if (!displayName) {
    throw new Error('Your Cognito profile does not contain a display name.');
  }

  return displayName;
}

export async function updateCognitoPreferredName(
  preferredName: string
): Promise<void> {
  const normalizedName = preferredName.trim().replace(/\s+/g, ' ');

  if (!normalizedName) {
    throw new Error('Enter the name you want FareShare to display.');
  }

  if (normalizedName.length > 50) {
    throw new Error('Preferred name must be 50 characters or fewer.');
  }

  const accessToken = await getAccessToken();

  await cognitoRequest<Record<string, never>>('UpdateUserAttributes', {
    AccessToken: accessToken,
    UserAttributes: [
      {
        Name: PREFERRED_NAME_ATTRIBUTE,
        Value: normalizedName,
      },
    ],
  });
}

