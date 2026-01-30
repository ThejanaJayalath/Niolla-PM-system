import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './Login.module.css';

export default function Login() {
  const { user, login, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (loading) return <div className={styles.page}>Loading...</div>;
  if (user) return <Navigate to="/dashboard" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const result = await login(email, password);
    setSubmitting(false);
    if (result.success) navigate('/dashboard');
    else setError(result.error || 'Login failed');
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>Niolla PM</h1>
        <p className={styles.subtitle}>Sign in to manage leads and proposals</p>
        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className={styles.input}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className={styles.input}
            />
          </label>
          <button type="submit" disabled={submitting} className={styles.button}>
            {submitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
