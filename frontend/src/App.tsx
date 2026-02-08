import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Inquiries from './pages/Inquiries';
import InquiryForm from './pages/InquiryForm';
import InquiryDetail from './pages/InquiryDetail';
import Reminders from './pages/Reminders';
import Proposals from './pages/Proposals';
import CreateProposal from './pages/CreateProposal';
import ProposalDetail from './pages/ProposalDetail';
import Meetings from './pages/Meetings';
import Settings from './pages/Settings';
import Profile from './pages/Profile';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="inquiries" element={<Inquiries />} />
        <Route path="inquiries/new" element={<InquiryForm />} />
        <Route path="inquiries/:id" element={<InquiryDetail />} />
        <Route path="inquiries/:id/edit" element={<InquiryForm />} />
        <Route path="reminders" element={<Reminders />} />
        <Route path="proposals" element={<Proposals />} />
        <Route path="proposals/new" element={<CreateProposal />} />
        <Route path="proposals/:id" element={<ProposalDetail />} />
        <Route path="meetings" element={<Meetings />} />
        <Route path="settings" element={<Settings />} />
        <Route path="profile" element={<Profile />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
