# Google API Credentials Configuration

Google API credentials should be provided via the environment variable `GOOGLE_API_CREDENTIALS` rather than storing them in the repository.

This approach enhances security by:
1. Preventing credentials from being exposed in source control
2. Allowing different credentials in different environments
3. Following security best practices for credential management

## Setup Instructions

1. Obtain a Google service account JSON file
2. Set the `GOOGLE_API_CREDENTIALS` environment variable with the entire JSON content
3. For local development, you can use a `.env` file with this variable

Example format for the credentials JSON:
```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "your-private-key-id",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "your-service-account-email",
  "client_id": "your-client-id",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "your-client-x509-cert-url"
}
```

DO NOT place actual credentials in this file or commit any credential files to the repository.