import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

/**
 * Page opened after Google OAuth callback redirect.
 * If in popup: notifies opener and closes. Otherwise redirects to Settings.
 */
export default function GoogleOAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const success = searchParams.get('success') === '1';

  useEffect(() => {
    if (!success) return;

    if (window.opener) {
      try {
        window.opener.postMessage({ type: 'google-oauth-done' }, window.location.origin);
      } catch {
        // ignore
      }
      window.close();
      return;
    }

    navigate('/settings', { replace: true });
  }, [success, navigate]);

  if (!success) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <p>Authorization did not complete. Try again from Settings.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, textAlign: 'center' }}>
      <p>Google Calendar connected. Closing...</p>
      <p style={{ fontSize: 14, color: '#666' }}>
        If this window does not close, go to Settings.
      </p>
    </div>
  );
}
