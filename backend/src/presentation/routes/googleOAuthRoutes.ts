import { Router, Request, Response } from 'express';
import { google } from 'googleapis';
import { setGoogleRefreshToken } from '../../application/services/IntegrationService';

// For Vercel: set GOOGLE_OAUTH_REDIRECT_URI=https://your-api.vercel.app/oauth2callback in env and add that URL in Google Cloud OAuth client.
const REDIRECT_URI = process.env.GOOGLE_OAUTH_REDIRECT_URI || 'http://localhost:5000/oauth2callback';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const SCOPES = ['https://www.googleapis.com/auth/calendar'];

/**
 * Step 1: Open in browser to start OAuth and get redirected to Google.
 * GET /api/v1/google-oauth/start
 */
export function getOAuthStartRouter(): Router {
  const router = Router();
  router.get('/start', (_req: Request, res: Response) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      res.status(500).json({
        success: false,
        error: 'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env',
      });
      return;
    }
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'select_account consent',
      scope: SCOPES,
    });
    res.redirect(authUrl);
  });
  return router;
}

/**
 * Step 2: Google redirects here with ?code=... after user signs in.
 * Exchange code for tokens and show the refresh_token to copy into .env
 */
export async function handleOAuthCallback(req: Request, res: Response): Promise<void> {
  const code = req.query.code as string;
  if (!code) {
    res.status(400).send('Missing ?code= from Google. Start the flow from /api/v1/google-oauth/start');
    return;
  }
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    res.status(500).send('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET not set in .env');
    return;
  }
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);
  try {
    const { tokens } = await oauth2Client.getToken(code);
    const refreshToken = tokens.refresh_token;
    if (!refreshToken) {
      res.send(`
        <h2>No refresh_token in response</h2>
        <p>You may have already granted access. Try revoking the app at
        <a href="https://myaccount.google.com/permissions" target="_blank">Google Account permissions</a>
        and run the flow again from <a href="/api/v1/google-oauth/start">/api/v1/google-oauth/start</a>.</p>
        <p>Make sure your account is added as a Test user in OAuth consent screen (if app is in Testing).</p>
      `);
      return;
    }
    await setGoogleRefreshToken(refreshToken);
    const callbackUrl = `${FRONTEND_URL.replace(/\/$/, '')}/google-oauth-callback?success=1`;
    res.redirect(callbackUrl);
  } catch (err) {
    console.error('OAuth token exchange error:', err);
    res.status(500).send(
      `<h2>Token exchange failed</h2><pre>${err instanceof Error ? err.message : String(err)}</pre>`
    );
  }
}
