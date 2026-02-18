import { useState } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { Mail, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import styles from './Login.module.css';

export default function Login() {
  const { user, login, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (loading) return (
    <div className={styles.page}>
      <span className={styles.loadingText}>Loading...</span>
    </div>
  );
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
      <header className={styles.brand}>
        <img
          src="/login/Niollanexa.gif"
          alt="Niolla Nexa"
          className={styles.logoImage}
        />
        <div className={styles.brandText}>
          <span className={styles.brandName}>NIOLLA</span>
          <span className={styles.brandSub}>NEXA</span>
        </div>
      </header>

      <div className={styles.card}>
        <div>
          <h1 className={styles.title}>Welcome Back</h1>
          <p className={styles.subtitle}>Please sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.inputGroup}>
            <label className={styles.label}>Email</label>
            <div className={styles.inputWrap}>
              <Mail className={styles.inputIcon} size={18} aria-hidden />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="Enter your email address"
                className={styles.input}
              />
            </div>
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>Password</label>
            <div className={styles.inputWrap}>
              <Lock className={styles.inputIcon} size={18} aria-hidden />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="Enter your password"
                className={styles.input}
              />
            </div>
          </div>

          <div className={styles.forgotWrap}>
            <Link to="#" className={styles.forgotLink}>Forgot password?</Link>
          </div>

          <button type="submit" disabled={submitting} className={styles.button}>
            {submitting ? 'Signing in...' : 'Sign In'}
          </button>

          <p className={styles.signUpText}>
            Don&apos;t have an account?{' '}
            <Link to="#" className={styles.signUpLink}>Sign Up</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
