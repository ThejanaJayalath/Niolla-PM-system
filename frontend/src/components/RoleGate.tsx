import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

type RoleGateProps = {
  children: React.ReactNode;
  /** Allowed roles; omit to allow any authenticated user. */
  roles?: Array<'owner' | 'pm' | 'employee'>;
  /** Redirect path when denied (default dashboard). */
  redirectTo?: string;
};

export default function RoleGate({ children, roles, redirectTo = '/dashboard' }: RoleGateProps) {
  const { user, loading } = useAuth();
  if (loading) {
    return <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>;
  }
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role as 'owner' | 'pm' | 'employee')) {
    return <Navigate to={redirectTo} replace />;
  }
  return <>{children}</>;
}
