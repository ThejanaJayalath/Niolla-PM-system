import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User, Shield, Briefcase, Edit2, Save, X, Trash2, Lock, ArrowLeft } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import ConfirmDialog from '../components/ConfirmDialog';
import styles from './Profile.module.css';

interface UserType {
  _id: string;
  name: string;
  email: string;
  role: 'owner' | 'pm' | 'employee';
  status: 'active' | 'suspended';
  phone?: string;
  address?: string;
  profilePhoto?: string;
  createdAt: string;
  updatedAt: string;
  lastLogin?: string;
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  pm: 'Project Manager',
  employee: 'Software Engineer',
};

export default function EmployeeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [user, setUser] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<UserType>>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ newPassword: '', confirmPassword: '' });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const isOwner = currentUser?.role === 'owner';

  useEffect(() => {
    if (id) loadUser();
  }, [id]);

  const loadUser = async () => {
    if (!id) return;
    try {
      const res = await api.get<UserType>(`/users/${id}`);
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
      const res = await api.patch<UserType>(`/users/${id}`, editData);
      if (res.success && res.data) {
        setUser(res.data);
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
      if (res.success) navigate('/team');
      else setError(res.error?.message || 'Failed to delete user');
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
      const res = await api.patch<UserType>(`/users/${id}`, { status: newStatus });
      if (res.success && res.data) {
        setUser(res.data);
        setEditData(res.data);
      } else setError(res.error?.message || 'Failed to update status');
    } catch (err) {
      setError('Network error');
    } finally {
      setSuspendDialogOpen(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }
    if (!id) return;
    setChangingPassword(true);
    try {
      const res = await api.patch(`/users/${id}/password`, { newPassword: passwordForm.newPassword });
      if (res.success) {
        setPasswordSuccess('Password updated');
        setPasswordForm({ newPassword: '', confirmPassword: '' });
        setTimeout(() => {
          setShowPasswordModal(false);
          setPasswordSuccess('');
        }, 1500);
      } else setPasswordError(res.error?.message || 'Failed to update password');
    } catch (err) {
      setPasswordError('Failed to update password');
    } finally {
      setChangingPassword(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={styles.container}>
        <div className="flex flex-col items-center justify-center h-64 text-gray-500 gap-4">
          <p>User not found</p>
          <button
            onClick={() => navigate('/team')}
            className="text-orange-600 hover:text-orange-800 font-medium"
          >
            Back to Team Management
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header: Back + Title + Edit actions */}
      <div className={styles.header}>
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/team')}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            aria-label="Back to team"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className={styles.title}>Employee Details</h1>
        </div>
        {!editing ? (
          <button onClick={() => setEditing(true)} className={styles.editButton}>
            <Edit2 size={16} />
            Edit Details
          </button>
        ) : (
          <div className={styles.editActions}>
            <button
              onClick={handleUpdate}
              disabled={updating}
              className={`${styles.saveButton} ${updating ? styles.disabled : ''}`}
            >
              <Save size={16} />
              Save Changes
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setEditData(user);
              }}
              className={styles.cancelButton}
            >
              <X size={16} />
              Cancel
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
          {error}
        </div>
      )}

      <div className={styles.content}>
        {/* Main card: Profile header + Personal Information */}
        <div className={styles.mainCard}>
          <div className={styles.profileHeader}>
            <div className={styles.avatarWrapper}>
              <div className={styles.avatar}>
                {user.profilePhoto ? (
                  <img src={user.profilePhoto} alt="" className={styles.avatarImage} />
                ) : (
                  <User size={48} className={styles.avatarIcon} />
                )}
              </div>
            </div>
            <div className={styles.profileInfo}>
              <h2 className={styles.name}>
                {editing ? (editData.name ?? user.name) : user.name}
              </h2>
              <p className={styles.role}>{ROLE_LABELS[user.role]}</p>
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>
              <User size={18} className={styles.sectionIcon} />
              Personal Information
            </div>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Full Name</label>
                {editing ? (
                  <input
                    type="text"
                    value={editData.name ?? ''}
                    onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                    className={styles.input}
                    placeholder="Full name"
                  />
                ) : (
                  <div className={styles.readOnlyValue}>{user.name}</div>
                )}
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Email</label>
                <div className={styles.readOnlyValue}>{user.email}</div>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Phone Number</label>
                {editing ? (
                  <input
                    type="tel"
                    value={editData.phone ?? ''}
                    onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                    className={styles.input}
                    placeholder="Phone number"
                  />
                ) : (
                  <div className={styles.readOnlyValue}>{user.phone || '—'}</div>
                )}
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Address</label>
                {editing ? (
                  <input
                    type="text"
                    value={editData.address ?? ''}
                    onChange={(e) => setEditData({ ...editData, address: e.target.value })}
                    className={styles.input}
                    placeholder="Address"
                  />
                ) : (
                  <div className={styles.readOnlyValue}>{user.address || '—'}</div>
                )}
              </div>
            </div>
          </div>

          {/* Actions: under Personal Information to use empty space */}
          <div className={styles.section} style={{ marginTop: '2rem' }}>
            <div className={styles.sectionTitle}>Actions</div>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => setSuspendDialogOpen(true)}
                className={`w-full px-4 py-2.5 rounded-lg font-medium text-sm transition-colors ${
                  user.status === 'active'
                    ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                }`}
              >
                {user.status === 'active' ? 'Suspend Account' : 'Reactivate Account'}
              </button>
              {isOwner && (
                <button
                  onClick={() => setDeleteDialogOpen(true)}
                  className="w-full px-4 py-2.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors font-medium text-sm flex items-center justify-center gap-2"
                >
                  <Trash2 size={18} />
                  Delete User
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar: Account Security + Work Information */}
        <div className={styles.sidebar}>
          <div className={styles.sidebarCard}>
            <div className={styles.sectionTitle}>
              <Shield size={18} className={styles.sectionIcon} />
              Account Security
            </div>
            <div className={styles.securitySection}>
              <div className={styles.securityItem}>
                <label className={styles.label}>Email</label>
                <div className={styles.readOnlyValue}>{user.email}</div>
              </div>
              <div className={styles.securityItem}>
                <label className={styles.label}>Password</label>
                <div className={styles.readOnlyValue}>••••••••</div>
              </div>
              {isOwner && (
                <button
                  onClick={() => setShowPasswordModal(true)}
                  className={styles.changePasswordButton}
                >
                  <Lock size={14} />
                  Change Password
                </button>
              )}
            </div>
          </div>

          <div className={styles.sidebarCard}>
            <div className={styles.sectionTitle}>
              <Briefcase size={18} className={styles.sectionIcon} />
              Work Information
            </div>
            <div className={styles.workSection}>
              <div className={styles.workItem}>
                <label className={styles.label}>Position</label>
                {editing ? (
                  <select
                    value={editData.role ?? user.role}
                    onChange={(e) => setEditData({ ...editData, role: e.target.value as UserType['role'] })}
                    className={styles.input}
                    style={{ minHeight: 'auto', padding: '0.5rem 1rem' }}
                  >
                    <option value="owner">Owner</option>
                    <option value="pm">Project Manager</option>
                    <option value="employee">Software Engineer</option>
                  </select>
                ) : (
                  <div className={styles.readOnlyValue}>{ROLE_LABELS[user.role]}</div>
                )}
              </div>
              <div className={styles.workItem}>
                <label className={styles.label}>Account Status</label>
                {editing ? (
                  <select
                    value={editData.status ?? user.status}
                    onChange={(e) => setEditData({ ...editData, status: e.target.value as 'active' | 'suspended' })}
                    className={styles.input}
                    style={{ minHeight: 'auto', padding: '0.5rem 1rem' }}
                  >
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                  </select>
                ) : (
                  <div className={styles.readOnlyValue}>
                    <span className={`${styles.statusBadge} ${styles[`status${user.status.charAt(0).toUpperCase() + user.status.slice(1)}`]}`}>
                      {user.status}
                    </span>
                  </div>
                )}
              </div>
              <div className={styles.workItem}>
                <label className={styles.label}>Joined</label>
                <div className={styles.readOnlyValue}>{formatDate(user.createdAt)}</div>
              </div>
              <div className={styles.workItem}>
                <label className={styles.label}>Last Login</label>
                <div className={styles.readOnlyValue}>
                  {user.lastLogin ? formatDateTime(user.lastLogin) : 'Never'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

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
        message={
          user.status === 'active'
            ? 'Suspend this user? They will no longer be able to access the system.'
            : 'Reactivate this user? They will regain access.'
        }
        onConfirm={handleSuspend}
        onCancel={() => setSuspendDialogOpen(false)}
        isLoading={updating}
      />

      {/* Change Password Modal (owner only) */}
      {showPasswordModal && (
        <div className={styles.modalOverlay} onClick={() => setShowPasswordModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Change Password</h3>
              <button onClick={() => setShowPasswordModal(false)} className={styles.modalClose}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleChangePassword} className={styles.passwordForm}>
              <div className={styles.formGroup}>
                <label className={styles.label}>New Password</label>
                <input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))}
                  className={styles.input}
                  placeholder="Enter new password"
                  minLength={6}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Confirm New Password</label>
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                  className={styles.input}
                  placeholder="Confirm new password"
                  minLength={6}
                  required
                />
              </div>
              {passwordError && <div className={styles.errorMessage}>{passwordError}</div>}
              {passwordSuccess && <div className={styles.successMessage}>{passwordSuccess}</div>}
              <div className={styles.modalActions}>
                <button type="button" onClick={() => setShowPasswordModal(false)} className={styles.modalCancelButton}>
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={changingPassword}
                  className={`${styles.modalSaveButton} ${changingPassword ? styles.disabled : ''}`}
                >
                  {changingPassword ? 'Updating...' : 'Change Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
