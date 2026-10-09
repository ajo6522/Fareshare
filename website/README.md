# FareShare Website

Static multi-page web client derived from the current Expo mobile application and the final FareShare web scope.

## Included
- Cognito OAuth 2.0 Authorization Code + PKCE sign-in/sign-up flow
- Preferred-name onboarding
- Customer home
- Service location/category/search results
- OpenSearch-backed business search through https://api.gofareshare.com
- Profile photo upload through FastAPI/S3 presigned URLs
- Business onboarding and provider dashboard
- Ride pages from the existing mobile app
- Booking, provider booking, notification, and messaging shells for the final product

## Deployment
The site is intended for the private S3 + CloudFront website at gofareshare.com.

Before browser authentication is used in production, add the deployed callback URL:
https://gofareshare.com/auth-callback.html
to the Cognito app client's allowed callback URLs.

## API
The browser client uses:
https://api.gofareshare.com
