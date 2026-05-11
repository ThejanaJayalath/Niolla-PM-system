/** Canonical project lifecycle (replaces legacy active / cancelled). */
export type ProjectLifecycleStatus =
  | 'unassigned'
  | 'under_development'
  | 'completed'
  | 'suspended';

export function normalizeProjectStatus(raw: string | undefined | null): ProjectLifecycleStatus {
  if (!raw) return 'unassigned';
  const s = String(raw).trim();
  if (s === 'active') return 'under_development';
  if (s === 'cancelled') return 'suspended';
  if (s === 'unassigned' || s === 'under_development' || s === 'completed' || s === 'suspended') {
    return s as ProjectLifecycleStatus;
  }
  return 'under_development';
}

/** Projects where staff payouts / “mark complete” workflow applies. */
export function isProjectInDevelopment(status: string | undefined | null): boolean {
  return normalizeProjectStatus(status) === 'under_development';
}
