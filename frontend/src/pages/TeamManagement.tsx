import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Eye, Pencil, Trash2, ChevronDown } from 'lucide-react';
import { api } from '../api/client';
import ConfirmDialog from '../components/ConfirmDialog';
import AddEmployeeModal from '../components/AddEmployeeModal';
import styles from './TeamManagement.module.css';

interface User {
  _id: string;
  name: string;
  email: string;
  role: 'owner' | 'pm' | 'employee';
  status: 'active' | 'suspended';
  phone?: string;
  address?: string;
  createdAt: string;
  updatedAt: string;
  lastLogin?: string;
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  pm: 'Project Manager',
  employee: 'Software Engineer',
};

export default function TeamManagement() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const load = async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);

      const queryString = params.toString() ? `?${params.toString()}` : '';
      const res = await api.get<User[]>(`/users${queryString}`);
      if (res.success && res.data) {
        setUsers(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      load();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleDelete = async () => {
    if (!deleteId) return;

    setDeleting(true);
    try {
      const res = await api.delete(`/users/${deleteId}`);
      if (res.success) {
        setUsers(users.filter(user => user._id !== deleteId));
        setDeleteId(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  const handleStatusChange = async (userId: string, newStatus: 'active' | 'suspended') => {
    try {
      const res = await api.patch(`/users/${userId}`, { status: newStatus });
      if (res.success) {
        setUsers(users.map(user =>
          user._id === userId ? { ...user, status: newStatus } : user
        ));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(search.toLowerCase()) ||
    user.email.toLowerCase().includes(search.toLowerCase())
  );

  const getRoleClass = (role: string) => {
    switch (role) {
      case 'owner':
        return styles.roleOwner;
      case 'pm':
        return styles.rolePm;
      case 'employee':
        return styles.roleEmployee;
      default:
        return '';
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'active':
        return styles.statusActive;
      case 'suspended':
        return styles.statusSuspended;
      default:
        return '';
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Team Management</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-primary hover:bg-primary-hover text-white px-6 py-2.5 rounded-lg text-sm font-bold shadow-sm transition-colors flex items-center gap-2"
        >
          <Plus size={18} />
          Add New Employee
        </button>
      </div>

      {/* Search */}
      <div className="flex gap-4 items-center">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search by Name or Email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Table */}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className="px-6 py-4 w-[25%]">Name</th>
              <th className="px-6 py-4 w-[25%]">Email</th>
              <th className="px-6 py-4 w-[20%]">Position</th>
               <th className="px-6 py-4 w-[15%] text-center">Status</th>
               <th className="px-6 py-4 w-[15%] text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : (
              <>
                {filteredUsers.map((user) => (
                  <tr
                    key={user._id}
                    onClick={() => navigate(`/team/${user._id}`)}
                  >
                    <td className="px-6 py-4">
                      <div className={styles.cellName}>{user.name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={styles.cellEmail}>{user.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`${styles.roleBadge} ${getRoleClass(user.role)}`}>
                        {ROLE_LABELS[user.role]}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="relative w-32 mx-auto">
                        <select
                          value={user.status}
                          onChange={(e) => handleStatusChange(user._id, e.target.value as 'active' | 'suspended')}
                          className={`appearance-none w-full pl-4 pr-10 py-2 rounded-full text-xs font-bold border uppercase tracking-wide cursor-pointer focus:outline-none transition-colors shadow-sm ${getStatusClass(user.status)}`}
                        >
                          <option value="active">Active</option>
                          <option value="suspended">Suspended</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 pointer-events-none" size={14} />
                      </div>
                    </td>
                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-center items-center gap-4">
                        <button
                          onClick={() => navigate(`/team/${user._id}`)}
                          className="text-gray-900 hover:text-primary transition-colors"
                          title="View Details"
                        >
                          <Eye size={20} />
                        </button>
                        <button
                          onClick={() => navigate(`/team/${user._id}/edit`)}
                          className="text-gray-900 hover:text-primary transition-colors"
                          title="Edit"
                        >
                          <Pencil size={20} />
                        </button>
                        <button
                          onClick={() => setDeleteId(user._id)}
                          className="text-gray-900 hover:text-red-600 transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {/* Fill remaining rows to always show 8 total */}
                {Array.from({ length: Math.max(0, 8 - filteredUsers.length) }).map((_, idx) => (
                  <tr key={`empty-${idx}`} className="h-[60px]">
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

        {/* Pagination */}
        <div className={styles.pagination}>
          <div className={styles.paginationLeft}>
            <span>Rows Per Page:</span>
            <select className={styles.paginationSelect}>
              <option>8</option>
              <option>16</option>
            </select>
          </div>
          <div className={styles.paginationRight}>
            <span>1-{filteredUsers.length} of {filteredUsers.length}</span>
            <div className="flex gap-1">
              <button className={styles.paginationBtn} disabled>&lt;</button>
              <button className={styles.paginationBtn}>&gt;</button>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <ConfirmDialog
        open={!!deleteId}
        title="Delete User"
        message="Are you sure you want to delete this user? This action cannot be undone."
        confirmLabel={deleting ? 'Deleting...' : 'Delete'}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        danger
      />

      <AddEmployeeModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={load}
      />
    </div>
  );
}
