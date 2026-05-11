export type ProjectLifecycleStatus =
  | 'unassigned'
  | 'under_development'
  | 'completed'
  | 'suspended';

export const PROJECT_LIFECYCLE_LABELS: Record<ProjectLifecycleStatus, string> = {
  unassigned: 'Unassigned',
  under_development: 'Under development',
  completed: 'Completed',
  suspended: 'Suspended',
};

export function normalizeProjectStatus(raw: string | undefined | null): ProjectLifecycleStatus {
  if (!raw) return 'unassigned';
  if (raw === 'active') return 'under_development';
  if (raw === 'cancelled') return 'suspended';
  if (
    raw === 'unassigned' ||
    raw === 'under_development' ||
    raw === 'completed' ||
    raw === 'suspended'
  ) {
    return raw;
  }
  return 'under_development';
}

export function isProjectUnderDevelopment(status: string | undefined | null): boolean {
  return normalizeProjectStatus(status) === 'under_development';
}
