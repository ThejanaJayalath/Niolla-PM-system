import { useEffect, useState } from 'react';
import { CheckSquare, X } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { pushSystemToast } from '../lib/systemToast';
import { isProjectUnderDevelopment, normalizeProjectStatus } from '../types/projectLifecycle';
import dialogStyles from './ConfirmDialog.module.css';

export interface AssignModalProject {
  _id: string;
  projectName: string;
  status: string;
  assignedEmployees?: string[];
  assignedEmployeePayouts?: Record<string, number>;
}

interface UserOption {
  _id: string;
  name: string;
  email: string;
}

interface Props {
  open: boolean;
  project: AssignModalProject | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function AssignProjectEmployeesModal({ open, project, onClose, onSaved }: Props) {
  const { user } = useAuth();
  const isOwner = user?.role === 'owner';
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [payouts, setPayouts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!open || !project) return;
    setSelected([...(project.assignedEmployees || [])]);
    setPayouts({ ...(project.assignedEmployeePayouts || {}) });
  }, [open, project?._id]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoadingUsers(true);
      try {
        const res = await api.get<UserOption[]>('/users');
        if (!cancelled && res.success && res.data) setUsers(res.data);
      } finally {
        if (!cancelled) setLoadingUsers(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !project) return null;

  const lifecycle = normalizeProjectStatus(project.status);
  const hadNoAssignees = !(project.assignedEmployees && project.assignedEmployees.length > 0);
  const firstAssign = selected.length > 0 && hadNoAssignees;
  const needPayouts =
    selected.length > 0 &&
    (firstAssign || (isOwner && isProjectUnderDevelopment(lifecycle)));

  const toggle = (empId: string) => {
    setSelected((prev) => {
      if (prev.includes(empId)) {
        setPayouts((p) => {
          const next = { ...p };
          delete next[empId];
          return next;
        });
        return prev.filter((id) => id !== empId);
      }
      return [...prev, empId];
    });
  };

  const handleSave = async () => {
    if (needPayouts) {
      const missing = selected.filter((id) => {
        const n = Number(payouts[id]);
        return !Number.isFinite(n) || n <= 0;
      });
      if (missing.length > 0) {
        pushSystemToast(
          'Enter a valid payout for each assigned developer (required when moving the project to under development).',
          'warning'
        );
        return;
      }
    }
    setSaving(true);
    try {
      const res = await api.patch(`/projects/${project._id}`, {
        assignedEmployees: selected,
        assignedEmployeePayouts: payouts,
        ...(firstAssign ? { status: 'under_development' } : {}),
      });
      if (res.success) {
        pushSystemToast('Assignments saved.', 'success');
        onSaved();
        onClose();
      } else {
        pushSystemToast(res.error?.message ?? 'Could not save assignments.', 'error');
      }
    } catch {
      pushSystemToast('Could not save assignments.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={dialogStyles.overlay} onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl border border-black/5 max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Close"
          className="absolute top-4 right-4 p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800"
          onClick={onClose}
        >
          <X size={20} />
        </button>
        <h2 className="text-lg font-bold text-gray-900 pr-10 mb-1">Assign employees</h2>
        <p className="text-sm text-gray-600 mb-4">{project.projectName}</p>

        <div className="flex flex-col gap-2 p-3 bg-gray-50 border border-gray-200 rounded-xl overflow-y-auto max-h-52 mb-4">
          {loadingUsers ? (
            <p className="text-sm text-gray-500">Loading employees…</p>
          ) : users.length === 0 ? (
            <p className="text-sm text-gray-500">No users found.</p>
          ) : (
            users.map((u) => {
              const isAssigned = selected.includes(u._id);
              return (
                <button
                  key={u._id}
                  type="button"
                  onClick={() => toggle(u._id)}
                  className={`flex items-center gap-3 p-2 rounded-lg text-left w-full transition-colors cursor-pointer hover:bg-gray-100 ${
                    isAssigned ? 'bg-orange-50/80' : ''
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${
                      isAssigned ? 'bg-orange-500 border-orange-500 text-white' : 'border-gray-300 bg-white'
                    }`}
                  >
                    {isAssigned && <CheckSquare size={14} />}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-800">{u.name}</div>
                    <div className="text-xs text-gray-500">{u.email}</div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {needPayouts && selected.length > 0 ? (
          <div className="mb-4">
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">
              Payout (per developer)
            </label>
            <div className="flex flex-col gap-2 p-3 bg-gray-50 border border-gray-200 rounded-xl">
              {selected.map((empId) => {
                const person = users.find((x) => x._id === empId);
                return (
                  <div key={empId} className="grid grid-cols-[1fr_140px] gap-2 items-center">
                    <div className="text-sm font-medium text-gray-700 truncate">{person?.name || 'Developer'}</div>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="Amount"
                      value={payouts[empId] ?? ''}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setPayouts((prev) => {
                          const next = { ...prev };
                          if (!raw) delete next[empId];
                          else next[empId] = Number(raw);
                          return next;
                        });
                      }}
                      className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="flex gap-2 justify-end pt-2 border-t border-gray-100">
          <button
            type="button"
            className={dialogStyles.cancelBtn}
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className={`${dialogStyles.alertOkBtn} disabled:opacity-50 disabled:cursor-not-allowed`}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
