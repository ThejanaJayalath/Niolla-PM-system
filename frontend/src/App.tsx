import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Inquiries from './pages/Inquiries';
import InquiryForm from './pages/InquiryForm';
import InquiryDetail from './pages/InquiryDetail';
import Reminders from './pages/Reminders';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: 48, textAlign: 'center' }}>Loading...</div>;
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
        <Route index element={<Navigate to="/inquiries" replace />} />
        <Route path="inquiries" element={<Inquiries />} />
        <Route path="inquiries/new" element={<InquiryForm />} />
        <Route path="inquiries/:id" element={<InquiryDetail />} />
        <Route path="inquiries/:id/edit" element={<InquiryForm />} />
        <Route path="reminders" element={<Reminders />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
