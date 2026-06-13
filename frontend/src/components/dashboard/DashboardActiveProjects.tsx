import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, BarChart2, Triangle } from 'lucide-react';
import { api } from '../../api/client';
import {
  PROJECT_LIFECYCLE_LABELS,
  normalizeProjectStatus,
  isProjectUnderDevelopment,
  type ProjectLifecycleStatus,
} from '../../types/projectLifecycle';
import styles from '../../pages/Dashboard.module.css';

interface Project {
  _id: string;
  projectName: string;
  clientName?: string;
  systemType?: string;
  status: ProjectLifecycleStatus | string;
}

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'under_development', label: 'Running' },
  { value: 'unassigned', label: 'Unassigned' },
  { value: 'completed', label: 'Completed' },
  { value: 'suspended', label: 'Suspended' },
];

function productTag(project: Project): string {
  if (project.systemType?.trim()) return project.systemType.trim().toUpperCase();
  const name = project.projectName.toLowerCase();
  if (name.includes('pos')) return 'POS';
  if (name.includes('erp')) return 'ERP';
  if (name.includes('crm')) return 'CRM';
  return 'PROJECT';
}

export default function DashboardActiveProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    api.get<Project[]>('/projects').then((res) => {
      if (res.success && res.data) setProjects(res.data);
      setLoading(false);
    });
  }, []);

  const runningCount = useMemo(
    () => projects.filter((p) => isProjectUnderDevelopment(p.status)).length,
    [projects]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects.filter((p) => {
      const status = normalizeProjectStatus(p.status);
      if (statusFilter && status !== statusFilter) return false;
      if (!q) return true;
      return (
        p.projectName.toLowerCase().includes(q) ||
        (p.clientName?.toLowerCase().includes(q) ?? false) ||
        (p.systemType?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [projects, search, statusFilter]);

  const displayProjects = filtered.slice(0, 10);

  return (
    <section className={styles.panelCard}>
      <div className={styles.panelHeader}>
        <div className={styles.panelHeaderLeft}>
          <h2 className={styles.panelTitle}>Active Projects</h2>
          <span className={styles.runningBadge}>{runningCount} RUNNING</span>
        </div>
        <div className={styles.panelHeaderRight}>
          <select
            className={styles.panelSelect}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <div className={styles.panelSearchWrap}>
            <Search size={16} className={styles.panelSearchIcon} />
            <input
              type="search"
              className={styles.panelSearch}
              placeholder="Search projects…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Link to="/projects" className={styles.viewAllBtn}>
            View all
          </Link>
        </div>
      </div>

      {loading ? (
        <p className={styles.panelMuted}>Loading projects…</p>
      ) : displayProjects.length === 0 ? (
        <p className={styles.panelMuted}>No projects match your filters.</p>
      ) : (
        <div className={styles.projectGrid}>
          {displayProjects.map((p) => (
            <Link key={p._id} to={`/projects/${p._id}`} className={styles.projectMiniCard}>
              <Triangle size={10} className={styles.projectCornerIcon} fill="currentColor" />
              <span className={styles.projectTag}>{productTag(p)}</span>
              <h3 className={styles.projectMiniTitle}>{p.projectName}</h3>
              <p className={styles.projectMiniMeta}>
                {PROJECT_LIFECYCLE_LABELS[normalizeProjectStatus(p.status)]}
              </p>
              <BarChart2 size={14} className={styles.projectChartIcon} />
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
