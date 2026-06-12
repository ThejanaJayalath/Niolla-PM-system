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
import MeetingDetail from './pages/MeetingDetail';
import Settings from './pages/Settings';
import GoogleOAuthCallback from './pages/GoogleOAuthCallback';
import Profile from './pages/Profile';
import TeamManagement from './pages/TeamManagement';
import EmployeeDetail from './pages/EmployeeDetail';
import Billing from './pages/Billing';
import BillingDetail from './pages/BillingDetail';
import CreateBilling from './pages/CreateBilling';
import Customer from './pages/Customer';
import CustomerDetail from './pages/CustomerDetail';
import ProductDirectory from './pages/ProductDirectory';
import Campaigns from './pages/Campaigns';
import UpdateTickets from './pages/UpdateTickets';
import ProjectsPaymentsHub from './pages/ProjectsPaymentsHub';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import ProjectRequirementWorkflow from './pages/ProjectRequirementWorkflow';
import PaymentPlans from './pages/PaymentPlans';
import Installments from './pages/Installments';
import InstallmentDetail from './pages/InstallmentDetail';
import Payments from './pages/Payments';
import Invoices from './pages/Invoices';
import PaymentNotifications from './pages/PaymentNotifications';
import Reports from './pages/Reports';
import Expenses from './pages/Expenses';
import Transactions from './pages/Transactions';
import Audit from './pages/Audit';
import AssignEmployees from './pages/AssignEmployees';
import Tasks from './pages/Tasks';
import RoleGate from './components/RoleGate';
import { PwaInstallProvider } from './components/PwaInstallPrompt';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <PwaInstallProvider>
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
        <Route path="tasks" element={<Tasks />} />
        <Route path="inquiries" element={<RoleGate roles={['owner', 'pm']}><Inquiries /></RoleGate>} />
        <Route path="prospects" element={<RoleGate roles={['owner', 'pm']}><Inquiries /></RoleGate>} />
        <Route path="inquiries/new" element={<RoleGate roles={['owner', 'pm']}><InquiryForm /></RoleGate>} />
        <Route path="inquiries/:id" element={<RoleGate roles={['owner', 'pm']}><InquiryDetail /></RoleGate>} />
        <Route path="inquiries/:id/edit" element={<RoleGate roles={['owner', 'pm']}><InquiryForm /></RoleGate>} />
        <Route path="reminders" element={<Reminders />} />
        <Route path="proposals" element={<RoleGate roles={['owner', 'pm']}><Proposals /></RoleGate>} />
        <Route path="proposals/new" element={<RoleGate roles={['owner', 'pm']}><CreateProposal /></RoleGate>} />
        <Route path="proposals/:id" element={<RoleGate roles={['owner', 'pm']}><ProposalDetail /></RoleGate>} />
        <Route path="meetings" element={<Meetings />} />
        <Route path="meetings/:id" element={<MeetingDetail />} />
        <Route path="billing" element={<RoleGate roles={['owner', 'pm']}><Billing /></RoleGate>} />
        <Route path="billing/new" element={<RoleGate roles={['owner', 'pm']}><CreateBilling /></RoleGate>} />
        <Route path="billing/:id" element={<RoleGate roles={['owner', 'pm']}><BillingDetail /></RoleGate>} />
        <Route path="products" element={<RoleGate roles={['owner', 'pm']}><ProductDirectory /></RoleGate>} />
        <Route path="campaigns" element={<RoleGate roles={['owner', 'pm']}><Campaigns /></RoleGate>} />
        <Route path="update-tickets" element={<RoleGate roles={['owner', 'pm']}><UpdateTickets /></RoleGate>} />
        <Route path="customer" element={<RoleGate roles={['owner', 'pm']}><Customer /></RoleGate>} />
        <Route path="customer/:id" element={<RoleGate roles={['owner', 'pm']}><CustomerDetail /></RoleGate>} />
        <Route path="projects-payments" element={<RoleGate roles={['owner', 'pm']}><ProjectsPaymentsHub /></RoleGate>} />
        <Route path="projects" element={<Projects />} />
        <Route path="assign-employees" element={<RoleGate roles={['owner', 'pm']}><AssignEmployees /></RoleGate>} />
        <Route path="projects/:id/requirement-workflow" element={<ProjectRequirementWorkflow />} />
        <Route path="projects/:id" element={<ProjectDetail />} />
        <Route path="payment-plans" element={<RoleGate roles={['owner', 'pm']}><PaymentPlans /></RoleGate>} />
        <Route path="installments" element={<RoleGate roles={['owner', 'pm']}><Installments /></RoleGate>} />
        <Route path="installments/:planId" element={<RoleGate roles={['owner', 'pm']}><InstallmentDetail /></RoleGate>} />
        <Route path="payments" element={<RoleGate roles={['owner', 'pm']}><Payments /></RoleGate>} />
        <Route path="invoices" element={<RoleGate roles={['owner', 'pm']}><Invoices /></RoleGate>} />
        <Route path="expenses" element={<RoleGate roles={['owner']}><Expenses /></RoleGate>} />
        <Route path="transactions" element={<RoleGate roles={['owner']}><Transactions /></RoleGate>} />
        <Route path="notifications" element={<PaymentNotifications />} />
        <Route path="reports" element={<RoleGate roles={['owner', 'pm']}><Reports /></RoleGate>} />
        <Route path="audit" element={<RoleGate roles={['owner']}><Audit /></RoleGate>} />
        <Route path="settings" element={<Settings />} />
        <Route path="google-oauth-callback" element={<GoogleOAuthCallback />} />
        <Route path="profile" element={<Profile />} />
        <Route path="team" element={<RoleGate roles={['owner', 'pm']}><TeamManagement /></RoleGate>} />
        <Route path="team/:id" element={<EmployeeDetail />} />
        <Route path="team/:id/edit" element={<EmployeeDetail />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </PwaInstallProvider>
  );
}
