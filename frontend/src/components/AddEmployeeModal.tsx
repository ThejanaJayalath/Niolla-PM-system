import { useState } from 'react';
import { X, User, Mail, Phone, MapPin, Briefcase, Lock } from 'lucide-react';
import { api } from '../api/client';
import styles from './AddEmployeeModal.module.css';

interface AddEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddEmployeeModal({ isOpen, onClose, onSuccess }: AddEmployeeModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    role: 'employee' as 'pm' | 'employee',
    password: '',
    autoGenerate: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const password = formData.autoGenerate ? generatePassword() : formData.password;
      
      const res = await api.post('/users', {
        ...formData,
        password,
      });

      if (res.success) {
        onSuccess();
        onClose();
        resetForm();
      } else {
        setError(res.error?.message || 'Failed to create user');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      address: '',
      role: 'employee',
      password: '',
      autoGenerate: true,
    });
  };

  const handleClose = () => {
    setError('');
    resetForm();
    onClose();
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>Add New Employee</h2>
          <button type="button" onClick={handleClose} className={styles.closeBtn} aria-label="Close">
            <X size={22} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && (
            <div className={styles.errorBox}>
              <p>{error}</p>
            </div>
          )}

          <div className={styles.formGroup}>
            <label>
              <User size={18} />
              Full Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={styles.input}
              placeholder="Enter Full Name"
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label>
              <Mail size={18} />
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className={styles.input}
              placeholder="Enter Email Address"
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label>
              <Phone size={18} />
              Phone Number
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className={styles.input}
              placeholder="Enter Phone Number"
            />
          </div>

          <div className={styles.formGroup}>
            <label>
              <MapPin size={18} />
              Address
            </label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className={styles.input}
              placeholder="Enter Address"
            />
          </div>

          <div className={styles.formGroup}>
            <label>
              <Briefcase size={18} />
              Position
            </label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as 'pm' | 'employee' })}
              className={styles.input}
              required
            >
              <option value="employee">Software Engineer</option>
              <option value="pm">Project Manager</option>
            </select>
          </div>

          <div className={styles.radioGroup}>
            <div className={styles.radioRow}>
              <input
                type="radio"
                id="autoGenerate"
                name="passwordOption"
                checked={formData.autoGenerate}
                onChange={() => setFormData({ ...formData, autoGenerate: true })}
              />
              <label htmlFor="autoGenerate">Auto-generate password</label>
            </div>
            <div className={styles.radioRow}>
              <input
                type="radio"
                id="manualPassword"
                name="passwordOption"
                checked={!formData.autoGenerate}
                onChange={() => setFormData({ ...formData, autoGenerate: false })}
              />
              <label htmlFor="manualPassword">Send invitation email with account setup instructions</label>
            </div>
          </div>

          {!formData.autoGenerate && (
            <div className={styles.formGroup}>
              <label>
                <Lock size={18} />
                Password
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className={styles.input}
                placeholder="Enter Password"
                required
                minLength={6}
              />
            </div>
          )}

          <div className={styles.actions}>
            <button type="submit" disabled={loading} className={styles.submitBtn}>
              {loading ? 'Creating...' : 'Create Employee'}
            </button>
            <button type="button" onClick={handleClose} disabled={loading} className={styles.cancelBtn}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
