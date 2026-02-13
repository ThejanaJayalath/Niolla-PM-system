import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { User, Shield, Briefcase, Edit, Save, X, LogOut } from 'lucide-react';
import styles from './Profile.module.css';

interface UserProfile {
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

export default function Profile() {
  const { logout } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    address: ''
  });
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [updating, setUpdating] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get<UserProfile>('/auth/me');
        if (res.success && res.data) {
          setProfile(res.data);
          setEditForm({
            name: res.data.name,
            phone: res.data.phone || '',
            address: res.data.address || ''
          });
        }
      } catch (err) {
        console.error('Failed to fetch profile:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSaveProfile = async () => {
    if (!profile) return;

    setUpdating(true);
    try {
      const res = await api.patch<UserProfile>(`/users/${profile._id}`, editForm);
      if (res.success && res.data) {
        setProfile(res.data);
        setIsEditing(false);
      }
    } catch (err) {
      console.error('Failed to update profile:', err);
    } finally {
      setUpdating(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New password and confirm password do not match');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters');
      return;
    }

    setChangingPassword(true);
    try {
      const res = await api.patch('/auth/me/password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      });

      if (res.success) {
        setPasswordSuccess('Password updated successfully');
        setPasswordForm({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
        setTimeout(() => {
          setShowPasswordModal(false);
          setPasswordSuccess('');
        }, 2000);
      } else {
        setPasswordError(res.error?.message || 'Failed to update password');
      }
    } catch (err) {
      setPasswordError('Failed to update password');
    } finally {
      setChangingPassword(false);
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'owner': return 'Owner';
      case 'pm': return 'Project Manager';
      case 'employee': return 'Software Engineer';
      default: return role;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        Failed to load profile
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>Profile</h1>
        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            className={styles.editButton}
          >
            <Edit size={16} />
            Edit Profile
          </button>
        ) : (
          <div className={styles.editActions}>
            <button
              onClick={handleSaveProfile}
              disabled={updating}
              className={`${styles.saveButton} ${updating ? styles.disabled : ''}`}
            >
              <Save size={16} />
              Save Changes
            </button>
            <button
              onClick={() => {
                setIsEditing(false);
                setEditForm({
                  name: profile.name,
                  phone: profile.phone || '',
                  address: profile.address || ''
                });
              }}
              className={styles.cancelButton}
            >
              <X size={16} />
              Cancel
            </button>
          </div>
        )}
      </div>

      <div className={styles.content}>
        {/* Main Profile Card */}
        <div className={styles.mainCard}>
          {/* Profile Header */}
          <div className={styles.profileHeader}>
            <div className={styles.avatarWrapper}>
              <div className={styles.avatar}>
                <User size={48} className={styles.avatarIcon} />
              </div>
            </div>
            <div className={styles.profileInfo}>
              <h2 className={styles.name}>{isEditing ? editForm.name : profile.name}</h2>
              <p className={styles.role}>{getRoleLabel(profile.role)}</p>
            </div>
          </div>

          {/* Personal Information */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>
              <User size={18} className={styles.sectionIcon} />
              Personal Information
            </div>

            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Full Name</label>
                {isEditing ? (
                  <input
                    type="text"
                    name="name"
                    value={editForm.name}
                    onChange={handleEditChange}
                    className={styles.input}
                    placeholder="Enter your full name"
                  />
                ) : (
                  <div className={styles.readOnlyValue}>{profile.name}</div>
                )}
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Email</label>
                <div className={styles.readOnlyValue}>{profile.email}</div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Phone Number</label>
                {isEditing ? (
                  <input
                    type="tel"
                    name="phone"
                    value={editForm.phone}
                    onChange={handleEditChange}
                    className={styles.input}
                    placeholder="Enter your phone number"
                  />
                ) : (
                  <div className={styles.readOnlyValue}>{profile.phone || '—'}</div>
                )}
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Address</label>
                {isEditing ? (
                  <textarea
                    name="address"
                    value={editForm.address}
                    onChange={handleEditChange}
                    className={styles.textarea}
                    placeholder="Enter your address"
                    rows={3}
                  />
                ) : (
                  <div className={styles.readOnlyValue}>{profile.address || '—'}</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Cards */}
        <div className={styles.sidebar}>
          {/* Account Security */}
          <div className={styles.sidebarCard}>
            <div className={styles.sectionTitle}>
              <Shield size={18} className={styles.sectionIcon} />
              Account Security
            </div>

            <div className={styles.securitySection}>
              <div className={styles.securityItem}>
                <label className={styles.label}>Email</label>
                <div className={styles.readOnlyValue}>{profile.email}</div>
              </div>

              <div className={styles.securityItem}>
                <label className={styles.label}>Password</label>
                <div className={styles.readOnlyValue}>••••••••</div>
              </div>

              <button
                onClick={() => setShowPasswordModal(true)}
                className={styles.changePasswordButton}
              >
                <Edit size={14} />
                Change Password
              </button>
            </div>
          </div>

          {/* Work Information */}
          <div className={styles.sidebarCard}>
            <div className={styles.sectionTitle}>
              <Briefcase size={18} className={styles.sectionIcon} />
              Work Information
            </div>

            <div className={styles.workSection}>
              <div className={styles.workItem}>
                <label className={styles.label}>Position</label>
                <div className={styles.readOnlyValue}>{getRoleLabel(profile.role)}</div>
              </div>

              <div className={styles.workItem}>
                <label className={styles.label}>Account Status</label>
                <div className={styles.readOnlyValue}>
                  <div className={`${styles.statusBadge} ${styles[`status${profile.status.charAt(0).toUpperCase() + profile.status.slice(1)}`]}`}>
                    {profile.status}
                  </div>
                </div>
              </div>

              <div className={styles.workItem}>
                <label className={styles.label}>Joined</label>
                <div className={styles.readOnlyValue}>{formatDate(profile.createdAt)}</div>
              </div>
            </div>
          </div>

          {/* Logout Card */}
          <div className={styles.sidebarCard}>
            <button
              onClick={logout}
              className={styles.logoutButton}
            >
              <LogOut size={16} />
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div className={styles.modalOverlay} onClick={() => setShowPasswordModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Change Password</h3>
              <button
                onClick={() => setShowPasswordModal(false)}
                className={styles.modalClose}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleChangePassword} className={styles.passwordForm}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Current Password</label>
                <input
                  type="password"
                  name="currentPassword"
                  value={passwordForm.currentPassword}
                  onChange={handlePasswordChange}
                  className={styles.input}
                  placeholder="Enter current password"
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>New Password</label>
                <input
                  type="password"
                  name="newPassword"
                  value={passwordForm.newPassword}
                  onChange={handlePasswordChange}
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
                  name="confirmPassword"
                  value={passwordForm.confirmPassword}
                  onChange={handlePasswordChange}
                  className={styles.input}
                  placeholder="Confirm new password"
                  minLength={6}
                  required
                />
              </div>

              {passwordError && (
                <div className={styles.errorMessage}>{passwordError}</div>
              )}

              {passwordSuccess && (
                <div className={styles.successMessage}>{passwordSuccess}</div>
              )}

              <div className={styles.modalActions}>
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className={styles.modalCancelButton}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={changingPassword}
                  className={`${styles.modalSaveButton} ${changingPassword ? styles.disabled : ''}`}
                >
                  {changingPassword ? 'Changing...' : 'Change Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
