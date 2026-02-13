import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Edit2, Save, X, Trash2 } from 'lucide-react';
import { api } from '../api/client';
import ConfirmDialog from '../components/ConfirmDialog';

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

const getStatusColor = (status: string) => {
  switch (status) {
    case 'active':
      return 'bg-green-100 text-green-700';
    case 'suspended':
      return 'bg-orange-100 text-orange-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
};

export default function EmployeeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<User>>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadUser();
  }, [id]);

  const loadUser = async () => {
    if (!id) return;

    try {
      const res = await api.get<User>(`/users/${id}`);
      if (res.success && res.data) {
        setUser(res.data);
        setEditData(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!id) return;

    setUpdating(true);
    setError('');

    try {
      const res = await api.patch(`/users/${id}`, editData);
      if (res.success && res.data) {
        setUser(res.data as User);
        setEditing(false);
      } else {
        setError(res.error?.message || 'Failed to update user');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;

    setDeleteLoading(true);
    setError('');

    try {
      const res = await api.delete(`/users/${id}`);
      if (res.success) {
        navigate('/team');
      } else {
        setError(res.error?.message || 'Failed to delete user');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setDeleteLoading(false);
      setDeleteDialogOpen(false);
    }
  };

  const handleSuspend = async () => {
    if (!id) return;

    try {
      const newStatus = user?.status === 'active' ? 'suspended' : 'active';
      const res = await api.patch(`/users/${id}`, { status: newStatus });
      if (res.success && res.data) {
        setUser(res.data as User);
        setEditData(res.data);
      } else {
        setError(res.error?.message || 'Failed to update status');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setSuspendDialogOpen(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500"></div>
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6">
        <div className="text-red-600">User not found</div>
        <button
          onClick={() => navigate('/team')}
          className="mt-4 text-orange-600 hover:text-orange-900"
        >
          Back to Team Management
        </button>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/team')}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X size={24} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Employee Details</h1>
            <p className="text-gray-500 mt-1">View and manage employee information</p>
          </div>
        </div>
        <div className="flex gap-3">
          {editing ? (
            <>
              <button
                onClick={handleUpdate}
                disabled={updating}
                className="bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <Save size={18} />
                Save Changes
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setEditData(user);
                }}
                className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors"
              >
                <X size={18} />
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors flex items-center gap-2"
            >
              <Edit2 size={18} />
              Edit Details
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* Employee Profile */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-6">
          <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center">
            <div className="text-gray-500 text-4xl">👤</div>
          </div>
          <div>
            {editing ? (
              <div>
                <input
                  type="text"
                  value={editData.name || ''}
                  onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  className="text-2xl font-bold text-gray-900 bg-transparent border-b border-gray-200 focus:outline-none focus:border-orange-500"
                />
                <select
                  value={editData.role || 'employee'}
                  onChange={(e) => setEditData({ ...editData, role: e.target.value as 'owner' | 'pm' | 'employee' })}
                  className="ml-4 px-3 py-1 text-sm rounded-full border border-gray-200 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value="owner">Owner</option>
                  <option value="pm">Project Manager</option>
                  <option value="employee">Software Engineer</option>
                </select>
              </div>
            ) : (
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{user.name}</h2>
                <p className="text-gray-500">{ROLE_LABELS[user.role]}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Personal Information */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <UserIcon size={20} />
            Personal Information
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              {editing ? (
                <input
                  type="text"
                  value={editData.name || ''}
                  onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              ) : (
                <div className="text-gray-900">{user.name}</div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              {editing ? (
                <input
                  type="email"
                  value={editData.email || ''}
                  onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              ) : (
                <div className="text-gray-900">{user.email}</div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              {editing ? (
                <input
                  type="tel"
                  value={editData.phone || ''}
                  onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              ) : (
                <div className="text-gray-900">{user.phone || '-'}</div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              {editing ? (
                <input
                  type="text"
                  value={editData.address || ''}
                  onChange={(e) => setEditData({ ...editData, address: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              ) : (
                <div className="text-gray-900">{user.address || '-'}</div>
              )}
            </div>
          </div>
        </div>

        {/* Work Information */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BriefcaseIcon size={20} />
            Work Information
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
              {editing ? (
                <select
                  value={editData.role || 'employee'}
                  onChange={(e) => setEditData({ ...editData, role: e.target.value as 'owner' | 'pm' | 'employee' })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value="owner">Owner</option>
                  <option value="pm">Project Manager</option>
                  <option value="employee">Software Engineer</option>
                </select>
              ) : (
                <div className="text-gray-900">{ROLE_LABELS[user.role]}</div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Account Status</label>
              {editing ? (
                <select
                  value={editData.status || 'active'}
                  onChange={(e) => setEditData({ ...editData, status: e.target.value as 'active' | 'suspended' })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
              ) : (
                <div className={`inline-block px-3 py-1 text-sm rounded-full ${getStatusColor(user.status)}`}>
                  {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* System Information */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <SettingsIcon size={20} />
            System Information
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID</label>
              <div className="text-gray-900">#{user._id.slice(-6)}</div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Joined</label>
              <div className="text-gray-900">{formatDate(user.createdAt)}</div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Login</label>
              <div className="text-gray-900">{user.lastLogin ? formatDateTime(user.lastLogin) : 'Never'}</div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Created By</label>
              <div className="text-gray-900">Admin</div>
            </div>
          </div>
        </div>

        {/* Account Security */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <LockIcon size={20} />
            Account Security
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <div className="text-gray-900">{user.email}</div>
            </div>

            <div>
              <button
                onClick={() => {
                  // TODO: Implement password reset
                }}
                className="text-orange-600 hover:text-orange-900 text-sm font-medium"
              >
                Change Password
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Actions</h3>
        <div className="flex gap-3">
          <button
            onClick={() => setSuspendDialogOpen(true)}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
              user.status === 'active' ? 'bg-orange-100 text-orange-700 hover:bg-orange-200' : 'bg-green-100 text-green-700 hover:bg-green-200'
            }`}
          >
            {user.status === 'active' ? 'Suspend Account' : 'Reactivate Account'}
          </button>
          <button
            onClick={() => setDeleteDialogOpen(true)}
            className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors flex items-center gap-2"
          >
            <Trash2 size={18} />
            Delete User
          </button>
        </div>
      </div>

      {/* Dialogs */}
      <ConfirmDialog
        open={deleteDialogOpen}
        title="Delete User"
        message="Are you sure you want to delete this user? This action cannot be undone."
        onConfirm={handleDelete}
        onCancel={() => setDeleteDialogOpen(false)}
        isLoading={deleteLoading}
      />

      <ConfirmDialog
        open={suspendDialogOpen}
        title={user.status === 'active' ? 'Suspend Account' : 'Reactivate Account'}
        message={user.status === 'active' 
          ? 'Are you sure you want to suspend this user account? They will no longer be able to access the system.'
          : 'Are you sure you want to reactivate this user account? They will regain access to the system.'
        }
        onConfirm={handleSuspend}
        onCancel={() => setSuspendDialogOpen(false)}
        isLoading={updating}
      />
    </div>
  );
}

// Helper components for icons
function UserIcon({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function BriefcaseIcon({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 3h-8a2 2 0 0 0-2 2v2" />
    </svg>
  );
}

function SettingsIcon({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v6m0 6v6M4.22 4.22l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M4.22 19.78l4.24-4.24m4.24-4.24l4.24-4.24" />
    </svg>
  );
}

function LockIcon({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
