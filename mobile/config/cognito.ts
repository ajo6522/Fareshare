export const cognitoConfig = {
  region: 'us-east-1',
  userPoolId: 'us-east-1_B9EiRBvPW',
  clientId: '5hu6fghgfui19o47e231r9i5ru',
  issuer:
    'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_B9EiRBvPW',
  domain:
    'https://us-east-1b9eirbvpw.auth.us-east-1.amazoncognito.com',
  redirectUri: 'fareshare://callback',
  scopes: ['openid', 'email', 'phone'],
} as const;

export const cognitoAuthDiscovery = {
  authorizationEndpoint: `${cognitoConfig.domain}/oauth2/authorize`,
  tokenEndpoint: `${cognitoConfig.domain}/oauth2/token`,
  revocationEndpoint: `${cognitoConfig.domain}/oauth2/revoke`,
};

export const cognitoSignUpDiscovery = {
  authorizationEndpoint: `${cognitoConfig.domain}/signup`,
  tokenEndpoint: `${cognitoConfig.domain}/oauth2/token`,
  revocationEndpoint: `${cognitoConfig.domain}/oauth2/revoke`,
};