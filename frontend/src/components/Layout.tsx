import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './Layout.module.css';

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const nav = [
    { path: '/inquiries', label: 'Inquiries' },
    { path: '/reminders', label: 'Reminders' },
  ];

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <Link to="/" className={styles.logo}>Niolla PM</Link>
        <nav className={styles.nav}>
          {nav.map(({ path, label }) => (
            <Link
              key={path}
              to={path}
              className={location.pathname.startsWith(path) ? styles.navActive : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className={styles.user}>
          <span className={styles.userName}>{user?.name}</span>
          <button type="button" onClick={logout} className={styles.logout}>Logout</button>
        </div>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
