import type { UserRole } from './entities/User';

/** Internal role keys (stored on User.role). */
export type StaffRole = UserRole;

export const ROLE_LABELS: Record<StaffRole, string> = {
  owner: 'Super Admin',
  pm: 'Management (COO/VP)',
  employee: 'Developer',
};

export const ROLE_DESCRIPTIONS: Record<StaffRole, string> = {
  owner:
    'Complete system control, financial reports, account creation, and authority to delete accounts.',
  pm: 'Oversee projects and assign developers; operational reports only — cannot see company net profit or delete financial logs.',
  employee: 'Assigned projects and tasks only; personal wallet — no company revenue, profit, or ledger.',
};

export type DeveloperTrack = 'frontend' | 'backend' | 'fullstack';

export const DEVELOPER_TRACK_LABELS: Record<DeveloperTrack, string> = {
  frontend: 'Frontend Developer',
  backend: 'Backend Developer',
  fullstack: 'Full-stack Developer',
};

export function isStaffRole(role: string): role is StaffRole {
  return role === 'owner' || role === 'pm' || role === 'employee';
}

export function canManageAccounts(role: string): boolean {
  return role === 'owner' || role === 'pm';
}

export function canDeleteAccounts(role: string): boolean {
  return role === 'owner';
}

export function canCreateRole(creatorRole: string, targetRole: 'pm' | 'employee'): boolean {
  if (creatorRole === 'owner') return true;
  if (creatorRole === 'pm') return targetRole === 'employee';
  return false;
}

export function canAssignDevelopers(role: string): boolean {
  return role === 'owner' || role === 'pm';
}

/** Company P&amp;L, net profit, live ledger balance, master ledger — Super Admin only. */
export function canViewCompanyFinancials(role: string): boolean {
  return role === 'owner';
}

export function canViewFinancialReports(role: string): boolean {
  return canViewCompanyFinancials(role);
}

export function canViewOperationalReports(role: string): boolean {
  return role === 'owner' || role === 'pm';
}

export function canViewPaymentOverview(role: string): boolean {
  return role === 'owner' || role === 'pm';
}

/** Per-project margin on assigned work — Management + Super Admin; never Developers. */
export function canViewProjectFinancials(role: string): boolean {
  return role === 'owner' || role === 'pm';
}

export function canManageExpenses(role: string): boolean {
  return role === 'owner';
}

/** Master ledger, expense ledger rows, audit trail — no delete except Super Admin. */
export function canDeleteFinancialLogs(role: string): boolean {
  return role === 'owner';
}

export function canManageFinancialLedger(role: string): boolean {
  return canDeleteFinancialLogs(role);
}

export function canAccessLeadsPipeline(role: string): boolean {
  return role === 'owner' || role === 'pm';
}

export function isDeveloperPortal(role: string): boolean {
  return role === 'employee';
}
