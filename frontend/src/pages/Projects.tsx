import { useState, useEffect } from 'react';
import { Plus, Search, Pencil, Trash2, CheckCircle2 } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import ConfirmDialog from '../components/ConfirmDialog';
import AddProjectModal from '../components/AddProjectModal';
import AssignProjectEmployeesModal from '../components/AssignProjectEmployeesModal';
import { useAuth } from '../context/AuthContext';
import { pushSystemToast } from '../lib/systemToast';
import {
  PROJECT_LIFECYCLE_LABELS,
  normalizeProjectStatus,
  isProjectUnderDevelopment,
  type ProjectLifecycleStatus,
} from '../types/projectLifecycle';
import styles from './Inquiries.module.css';

type PayoutReleaseStatus = 'accruing' | 'submitted' | 'released';

interface Project {
  _id: string;
  clientId: string;
  clientName?: string;
  projectName: string;
  description?: string;
  systemType?: string;
  totalValue: number;
  expenses?: number;
  totalDeveloperPayouts?: number;
  netProfit?: number;
  startDate?: string;
  endDate?: string;
  status: ProjectLifecycleStatus;
  requirementWorkflowLabel?: 'none' | 'to_be_updated' | 'updated';
  assignedEmployees?: string[];
  assignedEmployeePayouts?: Record<string, number>;
  assignedEmployeePayoutRelease?: Record<string, PayoutReleaseStatus>;
}

function workStatusLabel(s: PayoutReleaseStatus | undefined): string {
  if (s === 'submitted') return 'Awaiting admin approval';
  if (s === 'released') return 'Credited to wallet';
  return 'In progress';
}

interface CustomerOption {
  _id: string;
  name: string;
  customerId: string;
}

export default function Projects() {
  const { user } = useAuth();
  const isEmployee = user?.role === 'employee';
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  const newProjectCustId = searchParams.get('newProjectForCustomer');

  const [projects, setProjects] = useState<Project[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [markingCompleteId, setMarkingCompleteId] = useState<string | null>(null);
  const [assignModalProject, setAssignModalProject] = useState<Project | null>(null);

  const loadProjects = async () => {
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.append('search', search.trim());
      if (statusFilter) params.append('status', statusFilter);
      const queryString = params.toString() ? `?${params.toString()}` : '';
      const res = await api.get<Project[]>(`/projects${queryString}`);
      if (res.success && res.data) setProjects(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadCustomers = async () => {
    try {
      const res = await api.get<CustomerOption[]>('/customers');
      if (res.success && res.data) setCustomers(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    if (newProjectCustId && customers.length > 0) {
      setEditProject(null);
      setShowModal(true);
    }
  }, [newProjectCustId, customers]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      loadProjects();
    }, 300);
    return () => clearTimeout(timer);
  }, [search, statusFilter]);

  const handleAdd = () => {
    setEditProject(null);
    setShowModal(true);
  };

  const handleEdit = (p: Project) => {
    setEditProject(p);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditProject(null);
    loadProjects();
  };

  const handleDelete = async () => {
    const id = deleteId;
    if (!id) return;
    setDeleting(true);
    setDeleteId(null);
    try {
      const res = await api.delete(`/projects/${id}`);
      if (res?.success !== false) await loadProjects();
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (d?: string) =>
    d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  const markWorkComplete = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    setMarkingCompleteId(projectId);
    const res = await api.post(`/projects/${projectId}/payout-completion/submit`, {});
    setMarkingCompleteId(null);
    if (res.success) {
      pushSystemToast('A notification was sent to the Admin for approval.', 'success');
      await loadProjects();
    } else {
      pushSystemToast(res.error?.message ?? 'Could not submit. You need an active project, payout set, and assignment.', 'error');
    }
  };

  const getMarkBlockedReason = (
    projectStatus: Project['status'],
    myPayout: number,
    release: PayoutReleaseStatus
  ): string | null => {
    if (!isProjectUnderDevelopment(projectStatus)) return 'Only under-development projects can be marked complete.';
    if (!(myPayout > 0)) return 'Admin has not set your payout for this project yet.';
    if (release === 'submitted') return 'You already submitted this project. Waiting for admin approval.';
    if (release === 'released') return 'This payout is already credited to your wallet.';
    return null;
  };

  const colCount = isEmployee ? 10 : 8;

  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 8;
  const totalPages = Math.ceil(projects.length / rowsPerPage);
  const paginated = projects.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  return (
    <div className={`${styles.page} font-sans`}>
      <div className={styles.headerRow}>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{isEmployee ? 'My projects' : 'Projects'}</h1>
          {isEmployee ? (
            <p className="text-sm text-gray-600 mt-1">
              Once clicked, a notification is sent to Admin for approval; after approval, payout moves to your wallet.
            </p>
          ) : null}
        </div>
        {!isEmployee ? (
          <button
            onClick={handleAdd}
            className="bg-primary hover:bg-primary-hover text-white px-6 py-2.5 rounded-lg text-sm font-bold shadow-sm transition-colors flex items-center gap-2"
          >
            <Plus size={18} />
            Add Project
          </button>
        ) : null}
      </div>

      <div className={styles.filtersRow}>
        <div className="relative w-64 md:w-64 sm:w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search by project name, system type…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary"
        >
          <option value="">All statuses</option>
          <option value="unassigned">Unassigned</option>
          <option value="under_development">Under development</option>
          <option value="completed">Completed</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className="px-6 py-4 text-orange-500 font-bold text-sm">Project Name</th>
              <th className="px-6 py-4 text-orange-500 font-bold text-sm">Client</th>
              <th className="px-6 py-4 text-orange-500 font-bold text-sm">System Type</th>
              <th className="px-6 py-4 text-orange-500 font-bold text-sm">Total Value</th>
              {!isEmployee ? (
                <th className="px-6 py-4 text-orange-500 font-bold text-sm">Net profit</th>
              ) : null}
              <th className="px-6 py-4 text-orange-500 font-bold text-sm">Start Date</th>
              <th className="px-6 py-4 text-orange-500 font-bold text-sm">End Date</th>
              <th className="px-6 py-4 text-orange-500 font-bold text-sm">Status</th>
              {isEmployee ? (
                <>
                  <th className="px-6 py-4 text-orange-500 font-bold text-sm">My payout</th>
                  <th className="px-6 py-4 text-orange-500 font-bold text-sm">Your work</th>
                </>
              ) : null}
              <th className="px-6 py-4 text-orange-500 font-bold text-sm !text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y-0">
            {loading ? (
              <tr>
                <td colSpan={colCount} className="px-6 py-8 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : projects.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="px-6 py-8 text-center text-gray-500">
                  {isEmployee
                    ? 'You are not assigned to any projects yet.'
                    : 'No projects yet. Add a project to get started.'}
                </td>
              </tr>
            ) : (
              <>
                {paginated.map((p) => {
                  const myId = user?._id ?? '';
                  const myPayout = myId ? Number(p.assignedEmployeePayouts?.[myId] ?? 0) : 0;
                  const release = (myId ? p.assignedEmployeePayoutRelease?.[myId] : undefined) ?? 'accruing';
                  const blockedReason = getMarkBlockedReason(p.status, myPayout, release);
                  const canMarkComplete = isEmployee && !blockedReason;
                  return (
                    <tr
                      key={p._id}
                      className="hover:bg-gray-50 transition-colors group cursor-pointer"
                      onClick={() => navigate(`/projects/${p._id}`)}
                    >
                      <td className="px-6 py-4 font-medium text-gray-900">
                        <div className="flex flex-col gap-1.5">
                          <span>{p.projectName}</span>
                          {!isEmployee && (
                            <div className="flex flex-wrap items-center gap-1.5">
                              {!(p.assignedEmployees && p.assignedEmployees.length > 0) &&
                                normalizeProjectStatus(p.status) !== 'unassigned' && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setAssignModalProject(p);
                                    }}
                                    className="inline-flex px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded-full bg-amber-100 text-amber-900 border border-amber-200 hover:bg-amber-200 cursor-pointer"
                                  >
                                    Unassigned
                                  </button>
                                )}
                            </div>
                          )}
                          {(p.requirementWorkflowLabel === 'to_be_updated' ||
                            p.requirementWorkflowLabel === 'updated') && (
                            <div className="flex flex-wrap items-center gap-1.5">
                              {p.requirementWorkflowLabel === 'to_be_updated' && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/projects/${p._id}/requirement-workflow`);
                                  }}
                                  className="inline-flex px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded-full bg-orange-500 text-white hover:bg-orange-600"
                                >
                                  To be updated
                                </button>
                              )}
                              {p.requirementWorkflowLabel === 'updated' && (
                                <span className="inline-flex px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  Updated
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{p.clientName || '—'}</td>
                      <td className="px-6 py-4 text-gray-600">{p.systemType || '—'}</td>
                      <td className="px-6 py-4 text-gray-900 font-medium">
                        Rs. {Number(p.totalValue).toLocaleString()}
                      </td>
                      {!isEmployee ? (
                        <td
                          className={`px-6 py-4 font-medium ${
                            Number(p.netProfit ?? 0) >= 0 ? 'text-green-700' : 'text-red-700'
                          }`}
                        >
                          Rs. {Number(p.netProfit ?? 0).toLocaleString()}
                        </td>
                      ) : null}
                      <td className="px-6 py-4 text-gray-600">{formatDate(p.startDate)}</td>
                      <td className="px-6 py-4 text-gray-600">{formatDate(p.endDate)}</td>
                      <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                        {normalizeProjectStatus(p.status) === 'unassigned' && !isEmployee ? (
                          <button
                            type="button"
                            onClick={() => setAssignModalProject(p)}
                            className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100 cursor-pointer"
                          >
                            {PROJECT_LIFECYCLE_LABELS.unassigned}
                          </button>
                        ) : (
                          <span
                            className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                              normalizeProjectStatus(p.status) === 'under_development'
                                ? 'bg-green-100 text-green-800'
                                : normalizeProjectStatus(p.status) === 'completed'
                                  ? 'bg-blue-100 text-blue-800'
                                  : normalizeProjectStatus(p.status) === 'unassigned'
                                    ? 'bg-amber-50 text-amber-900 border border-amber-200'
                                    : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {PROJECT_LIFECYCLE_LABELS[normalizeProjectStatus(p.status)]}
                          </span>
                        )}
                      </td>
                      {isEmployee ? (
                        <>
                          <td className="px-6 py-4 text-gray-800">
                            {myPayout > 0 ? `LKR ${myPayout.toLocaleString()}` : '—'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-700">{workStatusLabel(release)}</td>
                        </>
                      ) : null}
                      <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-center items-center gap-2 flex-wrap">
                          {isEmployee ? (
                            <>
                              <button
                                type="button"
                                onClick={(e) => {
                                  if (!canMarkComplete) {
                                    e.stopPropagation();
                                    pushSystemToast(blockedReason || 'Action unavailable for this project.', 'warning');
                                    return;
                                  }
                                  markWorkComplete(e, p._id);
                                }}
                                disabled={!!markingCompleteId}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-orange-500 text-white disabled:opacity-45 disabled:cursor-not-allowed hover:bg-orange-600"
                                title={
                                  blockedReason ||
                                  'Once clicked, a notification is sent to Admin for approval.'
                                }
                                aria-label="Mark work complete. Once clicked, a notification is sent to Admin for approval."
                              >
                                <CheckCircle2 size={14} />
                                {markingCompleteId === p._id
                                  ? 'Submitting…'
                                  : release === 'submitted'
                                    ? 'Submitted'
                                    : release === 'released'
                                      ? 'Completed'
                                      : 'Mark work complete'}
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/projects/${p._id}?tab=assignments`);
                                }}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50"
                              >
                                Open
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => handleEdit(p)}
                                className="p-2 text-gray-600 hover:text-primary hover:bg-orange-50 rounded-lg transition-colors"
                                title="Edit"
                              >
                                <Pencil size={18} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteId(p._id)}
                                className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete"
                              >
                                <Trash2 size={18} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {Array.from({ length: Math.max(0, rowsPerPage - paginated.length) }).map((_, idx) => (
                  <tr key={`empty-${idx}`} className="h-[60px]">
                    {Array.from({ length: colCount }).map((__, c) => (
                      <td key={c} className="px-6 py-4">
                        &nbsp;
                      </td>
                    ))}
                  </tr>
                ))}
              </>
            )}
          </tbody>
        </table>

        <div className="px-6 py-3 bg-[#f9fafb] border-t border-[#fed7aa] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline">Rows Per Page:</span>
            <span className="sm:hidden">Rows:</span>
            <span>{rowsPerPage}</span>
          </div>
          <div className="flex items-center gap-2">
            <span>
              {projects.length === 0
                ? '0-0 of 0'
                : `${(currentPage - 1) * rowsPerPage + 1}-${Math.min(currentPage * rowsPerPage, projects.length)} of ${projects.length}`}
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2 py-1 border border-gray-300 rounded hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                &lt;
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="px-2 py-1 border border-gray-300 rounded hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                &gt;
              </button>
            </div>
          </div>
        </div>
      </div>

      <AddProjectModal
        open={showModal}
        onClose={() => {
          setShowModal(false);
          setEditProject(null);
          if (newProjectCustId) {
            navigate('/projects', { replace: true });
          }
        }}
        onSuccess={handleCloseModal}
        editProject={editProject}
        customers={customers}
        initialCustomerId={newProjectCustId}
      />

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Project"
        message="Are you sure you want to delete this project?"
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
        cancelLabel="Cancel"
        danger
        onConfirm={handleDelete}
        onCancel={() => !deleting && setDeleteId(null)}
      />

      <AssignProjectEmployeesModal
        open={!!assignModalProject}
        project={assignModalProject}
        onClose={() => setAssignModalProject(null)}
        onSaved={loadProjects}
      />
    </div>
  );
}
