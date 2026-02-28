# Google Calendar / Meet setup and troubleshooting

## One-click reconnect (recommended)

The app stores the Google refresh token **in the database**. When the token expires or is revoked:

1. Go to **Settings** in the app.
2. Under **Google Calendar & Meet**, click **Reconnect Google Calendar**.
3. In the popup, **choose the Google account** you want to link (or add another), then allow calendar access.
4. The popup closes and the new token is saved automatically. No `.env` or restart needed.

### "localhost refused to connect" or redirect goes to localhost after sign-in

When the app is **deployed** (e.g. https://niollanexa.vercel.app) the backend must use the **production** callback URL. Two things are required:

**1. Set environment variables in Vercel**

In your Vercel project → **Settings** → **Environment Variables** (for Production), add:

| Variable | Value |
|----------|--------|
| `GOOGLE_OAUTH_REDIRECT_URI` | `https://niollanexa.vercel.app/oauth2callback` |
| `FRONTEND_URL` | `https://niollanexa.vercel.app` |

Use your real frontend URL if different. Then **redeploy** (Deployments → ⋮ on latest → Redeploy) so the new env is applied.

**2. Google Cloud Console**

APIs & Services → Credentials → your OAuth 2.0 Client → **Authorized redirect URIs** → add the **exact** same URL as `GOOGLE_OAUTH_REDIRECT_URI`, e.g. `https://niollanexa.vercel.app/oauth2callback`. Save.

**3. Code change (already done)**

The project’s `vercel.json` now rewrites `/oauth2callback` to the API, and the backend handles both `/oauth2callback` and `/api/oauth2callback`. After you set the env vars and redeploy, **Reconnect Google Calendar** will complete without going to localhost.

### "Error 400: redirect_uri_mismatch"

Google shows this when the **redirect URI** in your OAuth request does not **exactly** match one of the **Authorized redirect URIs** in Google Cloud Console.

**Step 1 – See what your app sends**

Open this URL in your browser (use your real app URL if different):

- **Production:** https://niollanexa.vercel.app/api/v1/google-oauth/redirect-uri  
- **Local:** http://localhost:5000/api/v1/google-oauth/redirect-uri  

You’ll see JSON with `redirectUri`. Copy that **exact** value (e.g. `https://niollanexa.vercel.app/oauth2callback` or `http://localhost:5000/oauth2callback`).

**Step 2 – Add it in Google Cloud Console**

1. Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials).
2. Open your **OAuth 2.0 Client ID** (Web application).
3. Under **Authorized redirect URIs**, click **ADD URI** and paste the **exact** `redirectUri` from Step 1.
4. Remove any old or different URIs for this app (e.g. with a trailing slash or `http` instead of `https`).
5. Click **Save**.

**Step 3 – If the app showed the wrong URI**

- If you saw `http://localhost:5000/oauth2callback` on **production**, the backend env is not set. In **Vercel** → your project → **Settings** → **Environment Variables**, add `GOOGLE_OAUTH_REDIRECT_URI` = `https://niollanexa.vercel.app/oauth2callback` (no trailing slash), then **redeploy**.
- The value must match exactly: same scheme (`https` in production), no trailing slash, same host.

---

## What the error means

**"Calendar operation failed. Check OAuth and env (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN)."**

This is shown when any Google Calendar call fails. Common causes:

1. **`.env` in the wrong place** – The backend loads `.env` from the **backend** folder only.
2. **Missing or empty variables** – One of the three env vars is missing or blank.
3. **No valid refresh token** – `GOOGLE_REFRESH_TOKEN` must be obtained via the OAuth flow (see below), not copied from Google Cloud Console.
4. **Expired/revoked token** – Re-run the OAuth flow to get a new refresh token.

---

## 1. Put `.env` in the backend folder

The app loads `backend/.env`, not the project root.

```
Niolla-PM-system/
  backend/
    .env          ← put it here
    src/
    package.json
  frontend/
```

---

## 2. Required variables (exact names)

In `backend/.env`:

```env
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REFRESH_TOKEN=your_refresh_token_here
```

- No spaces around `=`.
- No quotes unless the value itself contains spaces.
- Get **Client ID** and **Client secret** from [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials → your OAuth 2.0 Client.
- **Refresh token** is not in the Console; you get it by running the OAuth flow (step 3).

---

## 3. Get the refresh token (first-time or manual)

You can still get a token manually and put it in `.env` as `GOOGLE_REFRESH_TOKEN`, but the **recommended** way is to use **Settings → Connect Google Calendar** in the app (token is saved in the DB).

To get a token manually:

1. Ensure `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are in `backend/.env`.
2. Start the backend: `cd backend && npm run dev`.
3. In Google Cloud Console:
   - Enable **Google Calendar API** for your project.
   - In OAuth consent screen, add your Google account as a **Test user** (if in Testing mode).
4. In the browser open: **http://localhost:5000/api/v1/google-oauth/start** (or use **Settings → Connect Google Calendar** in the app).
5. Sign in with Google and allow calendar access.
6. You are redirected to the app; the refresh token is saved in the database. No need to copy anything into `.env` unless you want a fallback token in env.

---

## 4. After changing `.env`

Restart the backend so it reloads env (e.g. stop and run `npm run dev` again).

**Optional:** Set `FRONTEND_URL=http://localhost:3000` (or your frontend URL) so that after OAuth the browser redirects to your app; defaults to `http://localhost:3000`.

**Production (Vercel):** Set `FRONTEND_URL=https://niollanexa.vercel.app` in the **backend** project’s Vercel Environment Variables so the OAuth callback redirects users back to your app.

---

## 5. See the real error (development)

In development, the API returns the actual error message in the `error.message` or `error.detail` field. Open DevTools → Network, click the failed request, and check the JSON response to see whether the problem is missing env, invalid token, or something else (e.g. Calendar API not enabled).
