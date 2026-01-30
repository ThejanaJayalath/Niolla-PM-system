import { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  MessageSquare,
  Bell,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
  User,
  LogOut,
  Layers, // Logo icon
} from 'lucide-react';
import { api } from '../api/client';
import styles from './Layout.module.css';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/inquiries', label: 'Inquiries', icon: MessageSquare },
  { path: '/reminders', label: 'Reminders', icon: Bell },
  { path: '/proposals', label: 'Proposals', icon: FileText },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [upcomingCount, setUpcomingCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get<{ length: number }>('/reminders/upcoming?limit=100').then((res) => {
      // Safely access data length
      if (res.success && res.data && Array.isArray(res.data)) {
        setUpcomingCount(res.data.length);
      }
    });
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setUserDropdownOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = () => {
    setUserDropdownOpen(false);
    logout();
    navigate('/login');
  };

  const isActive = (path: string) => {
    if (path === '/dashboard') return location.pathname === '/dashboard';
    return location.pathname.startsWith(path);
  };

  return (
    <div className={styles.layout}>
      <aside className={`${styles.sidebar} ${sidebarCollapsed ? styles.sidebarCollapsed : ''}`}>
        <div className={styles.sidebarHeader}>
          <Link to="/dashboard" className={styles.logo}>
            <div className={styles.logoIcon}>
              <Layers size={20} />
            </div>
            <span className={styles.logoText}>Niolla PM</span>
          </Link>
          <button
            type="button"
            className={styles.toggleBtn}
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>
        <nav className={styles.nav}>
          {navItems.map(({ path, label, icon: Icon }) => (
            <Link
              key={path}
              to={path}
              className={`${styles.navItem} ${isActive(path) ? styles.navItemActive : ''}`}
              title={sidebarCollapsed ? label : ''}
            >
              <Icon size={20} />
              <span className={styles.navLabel}>{label}</span>
            </Link>
          ))}
        </nav>
      </aside>

      <div className={styles.mainWrap}>
        <header className={styles.header}>
          <Link to="/reminders" className={styles.notifBtn} title="Upcoming reminders">
            <Bell size={20} />
            {upcomingCount > 0 && (
              <span className={styles.notifBadge}>{upcomingCount > 99 ? '99+' : upcomingCount}</span>
            )}
          </Link>
          <div className={styles.userWrap} ref={dropdownRef}>
            <button
              type="button"
              className={styles.userTrigger}
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              aria-expanded={userDropdownOpen}
            >
              <span className={styles.avatar}>
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </span>
              <span>{user?.name}</span>
            </button>
            {userDropdownOpen && (
              <div className={styles.dropdown}>
                <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-subtle)', marginBottom: '0.5rem' }}>
                  <div className="font-semibold text-sm">{user?.name}</div>
                  <div className="text-xs text-muted" style={{ marginTop: 2 }}>{user?.email}</div>
                </div>
                <button type="button" className={`${styles.dropdownItem} ${styles.dropdownItemDisabled}`} disabled>
                  <User size={16} />
                  Profile
                </button>
                <button type="button" className={styles.dropdownItem} onClick={handleSignOut}>
                  <LogOut size={16} />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </header>
        <main className={styles.main}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
