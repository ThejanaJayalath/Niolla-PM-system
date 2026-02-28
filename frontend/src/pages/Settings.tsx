import { useState, useEffect, useCallback } from 'react';
import { Calendar, RefreshCw } from 'lucide-react';
import { api } from '../api/client';
import styles from './Settings.module.css';

export default function Settings() {
  const [googleConnected, setGoogleConnected] = useState<boolean | null>(null);

  const fetchGoogleStatus = useCallback(async () => {
    try {
      const res = await api.get<{ connected: boolean }>('/integrations/google-calendar/status');
      if (res.success && res.data) setGoogleConnected(res.data.connected);
      else setGoogleConnected(false);
    } catch {
      setGoogleConnected(false);
    }
  }, []);

  useEffect(() => {
    fetchGoogleStatus();
  }, [fetchGoogleStatus]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'google-oauth-done') {
        fetchGoogleStatus();
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [fetchGoogleStatus]);

  const openGoogleOAuth = () => {
    const width = 520;
    const height = 620;
    const left = Math.round((window.screen.width - width) / 2);
    const top = Math.round((window.screen.height - height) / 2);
    window.open(
      '/api/v1/google-oauth/start',
      'google-oauth',
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`
    );
  };

  return (
    <div>
      <h1 className={styles.title}>Settings</h1>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>
          <Calendar size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          Google Calendar & Meet
        </h2>
        <p className={styles.cardDesc}>
          Connect your Google account to create meetings with Meet links and send calendar invites.
        </p>
        {googleConnected !== null && (
          <>
            <div
              className={
                googleConnected
                  ? `${styles.statusBadge} ${styles.statusConnected}`
                  : `${styles.statusBadge} ${styles.statusDisconnected}`
              }
            >
              {googleConnected ? 'Connected' : 'Not connected'}
            </div>
            <br />
            <button type="button" onClick={openGoogleOAuth} className={styles.connectBtn}>
              <RefreshCw size={16} />
              {googleConnected ? 'Reconnect Google Calendar' : 'Connect Google Calendar'}
            </button>
          </>
        )}
      </div>

      <div className={styles.placeholder}>
        <p>Other settings will be available in a future phase.</p>
        <p className={styles.hint}>User management, preferences, and more.</p>
      </div>
    </div>
  );
}
