import { useState, useEffect } from 'react';
import { Plus, Search, Pencil, Trash2 } from 'lucide-react';
import { api } from '../api/client';
import ConfirmDialog from '../components/ConfirmDialog';
import AddProjectModal from '../components/AddProjectModal';
import styles from './Inquiries.module.css';

interface Project {
  _id: string;
  clientId: string;
  clientName?: string;
  projectName: string;
  description?: string;
  systemType?: string;
  totalValue: number;
  startDate?: string;
  endDate?: string;
  status: 'active' | 'completed' | 'cancelled';
}

interface CustomerOption {
  _id: string;
  name: string;
  customerId: string;
}

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 8;
  const totalPages = Math.ceil(projects.length / rowsPerPage);
  const paginated = projects.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  return (
    <div className={`${styles.page} font-sans`}>
      <div className={styles.headerRow}>
        <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
        <button
          onClick={handleAdd}
          className="bg-primary hover:bg-primary-hover text-white px-6 py-2.5 rounded-lg text-sm font-bold shadow-sm transition-colors flex items-center gap-2"
        >
          <Plus size={18} />
          Add Project
        </button>
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
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
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
              <th className="px-6 py-4 text-orange-500 font-bold text-sm">Start Date</th>
              <th className="px-6 py-4 text-orange-500 font-bold text-sm">End Date</th>
              <th className="px-6 py-4 text-orange-500 font-bold text-sm">Status</th>
              <th className="px-6 py-4 text-orange-500 font-bold text-sm !text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y-0">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : projects.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                  No projects yet. Add a project to get started.
                </td>
              </tr>
            ) : (
              <>
                {paginated.map((p) => (
                  <tr key={p._id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-6 py-4 font-medium text-gray-900">{p.projectName}</td>
                    <td className="px-6 py-4 text-gray-600">{p.clientName || '—'}</td>
                    <td className="px-6 py-4 text-gray-600">{p.systemType || '—'}</td>
                    <td className="px-6 py-4 text-gray-900 font-medium">
                      Rs. {Number(p.totalValue).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-gray-600">{formatDate(p.startDate)}</td>
                    <td className="px-6 py-4 text-gray-600">{formatDate(p.endDate)}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                          p.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : p.status === 'completed'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center items-center gap-2">
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
                      </div>
                    </td>
                  </tr>
                ))}
                {Array.from({ length: Math.max(0, rowsPerPage - paginated.length) }).map((_, idx) => (
                  <tr key={`empty-${idx}`} className="h-[60px]">
                    <td className="px-6 py-4">&nbsp;</td>
                    <td className="px-6 py-4">&nbsp;</td>
                    <td className="px-6 py-4">&nbsp;</td>
                    <td className="px-6 py-4">&nbsp;</td>
                    <td className="px-6 py-4">&nbsp;</td>
                    <td className="px-6 py-4">&nbsp;</td>
                    <td className="px-6 py-4">&nbsp;</td>
                    <td className="px-6 py-4">&nbsp;</td>
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
        }}
        onSuccess={handleCloseModal}
        editProject={editProject}
        customers={customers}
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
    </div>
  );
}
