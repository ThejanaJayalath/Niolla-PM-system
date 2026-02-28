# Backend deployment (e.g. Vercel)

## Environment variables

Set these in your host (e.g. Vercel → Project → Settings → Environment Variables):

- `NODE_ENV` – e.g. `production`
- `PORT` – optional; host often sets it
- `MONGODB_URI` – your MongoDB connection string
- `JWT_SECRET` – secret for signing JWTs
- `JWT_EXPIRES_IN` – e.g. `7d`
- `GOOGLE_CLIENT_ID` – OAuth2 client ID (from Google Cloud Console)
- `GOOGLE_CLIENT_SECRET` – OAuth2 client secret
- `GOOGLE_REFRESH_TOKEN` – refresh token from the OAuth flow (run `/api/v1/google-oauth/start` once locally and paste the token)

### Optional (Google OAuth redirect for production)

- `GOOGLE_OAUTH_REDIRECT_URI` – Your **backend** callback URL, e.g. `https://your-backend.vercel.app/oauth2callback`.  
  Add this exact URL in Google Cloud Console → APIs & Services → Credentials → your OAuth 2.0 Client → **Authorized redirect URIs**.
- `FRONTEND_URL` – Your frontend base URL so the app redirects back after OAuth, e.g. `https://niollanexa.vercel.app`.

## Notes

- Do **not** commit `.env` or `config/google-service.json` (use env vars and OAuth refresh token in production).
- The app uses OAuth2 (refresh token) for Google Calendar/Meet; no service account key file is needed in production.
