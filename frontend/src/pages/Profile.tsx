import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import ConfirmDialog from '../components/ConfirmDialog';
import styles from './Profile.module.css';

interface UserItem {
  _id: string;
  email: string;
  name: string;
  role: string;
}

export default function Profile() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Own password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [ownPasswordError, setOwnPasswordError] = useState('');
  const [ownPasswordSuccess, setOwnPasswordSuccess] = useState('');
  const [changingOwn, setChangingOwn] = useState(false);

  // Add user (owner)
  const [addEmail, setAddEmail] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [addName, setAddName] = useState('');
  const [addRole, setAddRole] = useState<'pm' | 'employee'>('employee');
  const [addError, setAddError] = useState('');
  const [adding, setAdding] = useState(false);

  // Remove user
  const [removeTarget, setRemoveTarget] = useState<UserItem | null>(null);
  const [removing, setRemoving] = useState(false);

  // Change other user's password (owner)
  const [passwordTarget, setPasswordTarget] = useState<UserItem | null>(null);
  const [otherNewPassword, setOtherNewPassword] = useState('');
  const [otherConfirmPassword, setOtherConfirmPassword] = useState('');
  const [otherPasswordError, setOtherPasswordError] = useState('');
  const [settingPassword, setSettingPassword] = useState(false);

  const isOwner = currentUser?.role === 'owner';

  useEffect(() => {
    if (isOwner) {
      setLoadingUsers(true);
      api.get<UserItem[]>('/users').then((res) => {
        setLoadingUsers(false);
        if (res.success && res.data) setUsers(Array.isArray(res.data) ? res.data : []);
      });
    }
  }, [isOwner]);

  const handleChangeOwnPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setOwnPasswordError('');
    setOwnPasswordSuccess('');
    if (newPassword !== confirmPassword) {
      setOwnPasswordError('New password and confirm do not match');
      return;
    }
    if (newPassword.length < 6) {
      setOwnPasswordError('New password must be at least 6 characters');
      return;
    }
    setChangingOwn(true);
    const res = await api.patch<unknown>('/auth/me/password', {
      currentPassword,
      newPassword,
    });
    setChangingOwn(false);
    if (res.success) {
      setOwnPasswordSuccess('Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } else {
      setOwnPasswordError(res.error?.message || 'Failed to update password');
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');
    if (addPassword.length < 6) {
      setAddError('Password must be at least 6 characters');
      return;
    }
    setAdding(true);
    const res = await api.post<UserItem>('/users', {
      email: addEmail,
      password: addPassword,
      name: addName,
      role: addRole,
    });
    setAdding(false);
    if (res.success && res.data) {
      setUsers((prev) => [res.data!, ...prev]);
      setAddEmail('');
      setAddPassword('');
      setAddName('');
      setAddRole('employee');
    } else {
      setAddError(res.error?.message || 'Failed to add user');
    }
  };

  const handleConfirmRemove = async () => {
    if (!removeTarget) return;
    setRemoving(true);
    const res = await api.delete(`/users/${removeTarget._id}`);
    setRemoving(false);
    setRemoveTarget(null);
    if (res.success) {
      setUsers((prev) => prev.filter((u) => u._id !== removeTarget._id));
    }
  };

  const handleSetOtherPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordTarget) return;
    setOtherPasswordError('');
    if (otherNewPassword !== otherConfirmPassword) {
      setOtherPasswordError('Passwords do not match');
      return;
    }
    if (otherNewPassword.length < 6) {
      setOtherPasswordError('Password must be at least 6 characters');
      return;
    }
    setSettingPassword(true);
    const res = await api.patch<unknown>(`/users/${passwordTarget._id}/password`, {
      newPassword: otherNewPassword,
    });
    setSettingPassword(false);
    if (res.success) {
      setPasswordTarget(null);
      setOtherNewPassword('');
      setOtherConfirmPassword('');
    } else {
      setOtherPasswordError(res.error?.message || 'Failed to update password');
    }
  };

  const roleClass = (role: string) => {
    if (role === 'owner') return styles.roleOwner;
    if (role === 'pm') return styles.rolePm;
    return styles.roleEmployee;
  };

  return (
    <div>
      <h1 className={styles.title}>User Profile</h1>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>My Profile</h2>
        <div className={styles.profileGrid}>
          <div className={styles.profileRow}>
            <span className={styles.profileLabel}>Name</span>
            <span className={styles.profileValue}>{currentUser?.name ?? '—'}</span>
          </div>
          <div className={styles.profileRow}>
            <span className={styles.profileLabel}>Email</span>
            <span className={styles.profileValue}>{currentUser?.email ?? '—'}</span>
          </div>
          <div className={styles.profileRow}>
            <span className={styles.profileLabel}>Role</span>
            <span className={`${styles.roleBadge} ${roleClass(currentUser?.role ?? '')}`}>
              {currentUser?.role ?? '—'}
            </span>
          </div>
        </div>

        <h3 style={{ marginTop: '1.5rem', marginBottom: '0.75rem', fontSize: '0.9375rem', fontWeight: 600 }}>
          Change my password
        </h3>
        <form onSubmit={handleChangeOwnPassword}>
          <div className={styles.formGroup}>
            <label>Current password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              placeholder="Current password"
              autoComplete="current-password"
            />
          </div>
          <div className={styles.formGroup}>
            <label>New password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
              placeholder="New password"
              autoComplete="new-password"
            />
          </div>
          <div className={styles.formGroup}>
            <label>Confirm new password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              placeholder="Confirm new password"
              autoComplete="new-password"
            />
          </div>
          {ownPasswordError && <div className={styles.error}>{ownPasswordError}</div>}
          {ownPasswordSuccess && <div className={styles.success}>{ownPasswordSuccess}</div>}
          <button type="submit" className={styles.btnPrimary} disabled={changingOwn}>
            {changingOwn ? 'Updating...' : 'Update my password'}
          </button>
        </form>
      </section>

      {isOwner && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>User management</h2>
          <p className="text-sm text-muted" style={{ marginBottom: '1rem' }}>
            Add, remove, and change passwords for PM and employee users.
          </p>

          <form className={styles.addForm} onSubmit={handleAddUser}>
            <div className={styles.formGroup}>
              <label>Email</label>
              <input
                type="email"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                required
                placeholder="user@example.com"
              />
            </div>
            <div className={styles.formGroup}>
              <label>Password</label>
              <input
                type="password"
                value={addPassword}
                onChange={(e) => setAddPassword(e.target.value)}
                required
                minLength={6}
                placeholder="Min 6 characters"
              />
            </div>
            <div className={styles.formGroup}>
              <label>Name</label>
              <input
                type="text"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                required
                placeholder="Full name"
              />
            </div>
            <div className={styles.formGroup}>
              <label>Role</label>
              <select value={addRole} onChange={(e) => setAddRole(e.target.value as 'pm' | 'employee')}>
                <option value="employee">Employee</option>
                <option value="pm">PM</option>
              </select>
            </div>
            <button type="submit" className={styles.btnPrimary} disabled={adding}>
              {adding ? 'Adding...' : 'Add user'}
            </button>
          </form>
          {addError && <div className={styles.error}>{addError}</div>}

          {loadingUsers ? (
            <p className={styles.emptyUsers}>Loading users...</p>
          ) : users.length === 0 ? (
            <p className={styles.emptyUsers}>No users yet. Add one above.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u._id}>
                      <td>{u.name}</td>
                      <td>{u.email}</td>
                      <td>
                        <span className={`${styles.roleBadge} ${roleClass(u.role)}`}>{u.role}</span>
                      </td>
                      <td>
                        <div className={styles.actionsCell}>
                          <button
                            type="button"
                            className={styles.btnSecondary}
                            onClick={() => {
                              setPasswordTarget(u);
                              setOtherNewPassword('');
                              setOtherConfirmPassword('');
                              setOtherPasswordError('');
                            }}
                          >
                            Change password
                          </button>
                          {u._id !== currentUser?._id && (
                            <button
                              type="button"
                              className={styles.btnDanger}
                              onClick={() => setRemoveTarget(u)}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <ConfirmDialog
        open={!!removeTarget}
        title="Remove user"
        message={
          removeTarget
            ? `Are you sure you want to remove ${removeTarget.name} (${removeTarget.email})? They will no longer be able to sign in.`
            : ''
        }
        confirmLabel={removing ? 'Removing...' : 'Remove'}
        cancelLabel="Cancel"
        danger
        onConfirm={handleConfirmRemove}
        onCancel={() => !removing && setRemoveTarget(null)}
      />

      {passwordTarget && (
        <div className={styles.modalOverlay} onClick={() => setPasswordTarget(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Change password for {passwordTarget.name}</h3>
            <form onSubmit={handleSetOtherPassword}>
              <div className={styles.formGroup}>
                <label>New password</label>
                <input
                  type="password"
                  value={otherNewPassword}
                  onChange={(e) => setOtherNewPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="New password"
                  autoComplete="new-password"
                />
              </div>
              <div className={styles.formGroup}>
                <label>Confirm new password</label>
                <input
                  type="password"
                  value={otherConfirmPassword}
                  onChange={(e) => setOtherConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Confirm"
                  autoComplete="new-password"
                />
              </div>
              {otherPasswordError && <div className={styles.error}>{otherPasswordError}</div>}
              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => setPasswordTarget(null)}
                >
                  Cancel
                </button>
                <button type="submit" className={styles.btnPrimary} disabled={settingPassword}>
                  {settingPassword ? 'Updating...' : 'Update password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
