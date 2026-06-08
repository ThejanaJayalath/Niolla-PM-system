export type StaffRole = 'owner' | 'pm' | 'employee';

export type DeveloperTrack = 'frontend' | 'backend' | 'fullstack';

export const ROLE_LABELS: Record<StaffRole, string> = {
  owner: 'Super Admin',
  pm: 'Management (COO/VP)',
  employee: 'Developer',
};

export const ROLE_DESCRIPTIONS: Record<StaffRole, string> = {
  owner:
    'Complete system control, financial reports, account creation, and authority to delete accounts.',
  pm: 'Manage projects and developers; operational reports — no company net profit or financial log deletion.',
  employee: 'Assigned projects and tasks; personal wallet — no company revenue, profit, or ledger.',
};

export const DEVELOPER_TRACK_LABELS: Record<DeveloperTrack, string> = {
  frontend: 'Frontend Developer',
  backend: 'Backend Developer',
  fullstack: 'Full-stack Developer',
};

export function canManageAccounts(role?: string): boolean {
  return role === 'owner' || role === 'pm';
}

export function canDeleteAccounts(role?: string): boolean {
  return role === 'owner';
}

export function canCreateRole(creatorRole: string | undefined, targetRole: 'pm' | 'employee'): boolean {
  if (creatorRole === 'owner') return true;
  if (creatorRole === 'pm') return targetRole === 'employee';
  return false;
}

export function canViewCompanyFinancials(role?: string): boolean {
  return role === 'owner';
}

export function canViewFinancialReports(role?: string): boolean {
  return canViewCompanyFinancials(role);
}

export function canViewOperationalReports(role?: string): boolean {
  return role === 'owner' || role === 'pm';
}

export function canViewPaymentOverview(role?: string): boolean {
  return role === 'owner' || role === 'pm';
}

export function canViewProjectFinancials(role?: string): boolean {
  return role === 'owner' || role === 'pm';
}

export function canDeleteFinancialLogs(role?: string): boolean {
  return role === 'owner';
}

export function canAccessLeadsAndBilling(role?: string): boolean {
  return role === 'owner' || role === 'pm';
}

export function isDeveloperPortal(role?: string): boolean {
  return role === 'employee';
}
