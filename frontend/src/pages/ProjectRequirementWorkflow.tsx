import { useEffect, useState, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { pushSystemToast } from '../lib/systemToast';
import type { ProjectLifecycleStatus } from '../types/projectLifecycle';
import styles from './Inquiries.module.css';

interface ProjectRow {
  _id: string;
  projectName: string;
  assignedEmployees?: string[];
  status: ProjectLifecycleStatus;
  requirementWorkflowLabel?: string;
}

interface RequirementRow {
  _id: string;
  title: string;
  description?: string;
  status: string;
  source: string;
  assignedEmployeeIds?: string[];
  requirementPayoutValue?: number;
}

interface EmployeeOpt {
  _id: string;
  name: string;
  email?: string;
}

export default function ProjectRequirementWorkflow() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [project, setProject] = useState<ProjectRow | null>(null);
  const [requirements, setRequirements] = useState<RequirementRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeOpt[]>([]);
  const [selection, setSelection] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addon, setAddon] = useState<Record<string, { total: string; downPct: string; months: string }>>({});
  const [payoutByReq, setPayoutByReq] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await api.get<{
        project: ProjectRow;
        requirements: RequirementRow[];
        employees: EmployeeOpt[];
      }>(`/projects/${id}/requirement-workflow`);
      if (res.success && res.data) {
        setProject(res.data.project);
        setRequirements(res.data.requirements);
        setEmployees(res.data.employees);
        const init: Record<string, string[]> = {};
        const payoutInit: Record<string, string> = {};
        for (const r of res.data.requirements) {
          init[r._id] = [...(r.assignedEmployeeIds || [])];
          payoutInit[r._id] =
            r.requirementPayoutValue != null && Number(r.requirementPayoutValue) > 0
              ? String(r.requirementPayoutValue)
              : '';
        }
        setSelection(init);
        setPayoutByReq(payoutInit);
      }
    } catch (e) {
      console.error(e);
      pushSystemToast('Could not load workflow.', 'error');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleDev = (reqId: string, empId: string) => {
    if (user?.role === 'employee') return;
    setSelection((prev) => {
      const cur = new Set(prev[reqId] || []);
      if (cur.has(empId)) cur.delete(empId);
      else cur.add(empId);
      return { ...prev, [reqId]: [...cur] };
    });
  };

  const applyProjectTeamToAll = () => {
    if (!project?.assignedEmployees?.length) {
      pushSystemToast('This project has no assigned employees yet. Assign staff on the project first.', 'warning');
      return;
    }
    const next: Record<string, string[]> = { ...selection };
    for (const r of requirements) {
      next[r._id] = [...(project.assignedEmployees || [])];
    }
    setSelection(next);
  };

  const saveAssignments = async () => {
    if (!id || user?.role === 'employee') return;
    setSaving(true);
    try {
      const requirementPayoutValues: Record<string, number | null> = {};
      for (const r of requirements) {
        const raw = (payoutByReq[r._id] || '').trim();
        if (!raw) requirementPayoutValues[r._id] = null;
        else {
          const n = Number(raw);
          requirementPayoutValues[r._id] = Number.isFinite(n) && n >= 0 ? n : null;
        }
      }
      const res = await api.patch<{ project: ProjectRow; requirements: RequirementRow[] }>(
        `/projects/${id}/requirement-workflow/assignments`,
        { assignments: selection, requirementPayoutValues }
      );
      setSaving(false);
      if (res.success && res.data) {
        setProject(res.data.project);
        setRequirements(res.data.requirements);
        const init: Record<string, string[]> = {};
        const payoutInit: Record<string, string> = {};
        for (const r of res.data.requirements) {
          init[r._id] = [...(r.assignedEmployeeIds || [])];
          payoutInit[r._id] =
            r.requirementPayoutValue != null && Number(r.requirementPayoutValue) > 0
              ? String(r.requirementPayoutValue)
              : '';
        }
        setSelection(init);
        setPayoutByReq(payoutInit);
        pushSystemToast('Assignments and values saved.', 'success');
      } else {
        pushSystemToast(res.error?.message || 'Save failed', 'error');
      }
    } catch {
      setSaving(false);
      pushSystemToast('Save failed', 'error');
    }
  };

  const markRequirementDone = async (reqId: string) => {
    const res = await api.patch(`/requirements/${reqId}`, { status: 'DONE' });
    if (res.success) {
      pushSystemToast('Requirement marked done.', 'success');
      await load();
    } else {
      pushSystemToast(res.error?.message || 'Update failed', 'error');
    }
  };

  const createAddonPlan = async (reqId: string) => {
    const f = addon[reqId];
    if (!f?.total || !f?.downPct || !f?.months) {
      pushSystemToast('Enter add-on total, down payment %, and number of installments.', 'warning');
      return;
    }
    const res = await api.post<{ _id?: string }>(`/projects/${id}/requirements/${reqId}/addon-payment-plan`, {
      totalValue: Number(f.total),
      downPaymentPct: Number(f.downPct),
      totalInstallments: Number(f.months),
      serviceFeePct: 0,
    });
    if (res.success) {
      pushSystemToast(
        'Add-on plan created (separate from the main contract). The linked customer was notified. Record payments when received under Installments → filter by this project.',
        'success'
      );
      setAddon((prev) => ({ ...prev, [reqId]: { total: '', downPct: '', months: '' } }));
    } else {
      pushSystemToast(res.error?.message || 'Could not create plan', 'error');
    }
  };

  const isAdmin = user?.role === 'owner' || user?.role === 'pm';
  const myId = user?._id || '';

  if (loading) {
    return (
      <div className={`${styles.page} font-sans p-8 text-gray-500`}>Loading…</div>
    );
  }

  if (!project) {
    return (
      <div className={`${styles.page} font-sans p-8`}>
        <p className="text-gray-600">Project not found.</p>
        <Link to="/projects" className="text-primary font-medium mt-4 inline-block">
          Back to projects
        </Link>
      </div>
    );
  }

  return (
    <div className={`${styles.page} font-sans max-w-4xl`}>
      <div className="mb-6">
        <button
          type="button"
          onClick={() => navigate(`/projects/${id}`)}
          className="text-gray-500 hover:text-gray-900 flex items-center gap-2 text-sm font-medium mb-2"
        >
          <ArrowLeft size={18} />
          Back to project
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Requirement workflow</h1>
        <p className="text-sm text-gray-600 mt-1">
          {project.projectName} — assign developers per requirement, set agreed value per requirement, and create
          add-on payment plans (separate from the main proposal / main contract). When you create an add-on plan, the
          linked customer gets a notification immediately; record each installment as paid under Installments. This tab
          is separate from Assign Employees.
        </p>
      </div>

      {isAdmin && requirements.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={applyProjectTeamToAll}
            className="px-4 py-2 text-sm font-semibold rounded-lg border border-orange-200 bg-white text-gray-800 hover:bg-orange-50"
          >
            Use project assignees for all requirements
          </button>
          <button
            type="button"
            onClick={saveAssignments}
            disabled={saving}
            className="px-4 py-2 text-sm font-bold rounded-lg bg-primary text-white hover:bg-primary-hover flex items-center gap-2 disabled:opacity-50"
          >
            <Save size={16} />
            {saving ? 'Saving…' : 'Save assignments'}
          </button>
        </div>
      )}

      {requirements.length === 0 ? (
        <p className="text-gray-600 text-sm">No software requirements are linked to this project yet.</p>
      ) : (
        <ul className="space-y-6">
          {requirements.map((req) => {
            const picked = selection[req._id] || [];
            const showAddon = isAdmin;
            const canDevComplete =
              user?.role === 'employee' &&
              (req.assignedEmployeeIds || []).includes(myId) &&
              req.status !== 'DONE';

            return (
              <li
                key={req._id}
                className="border border-orange-100 rounded-xl p-4 bg-white shadow-sm"
              >
                <div className="font-semibold text-gray-900">{req.title}</div>
                {req.description && (
                  <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{req.description}</p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  Source: {req.source} · Status: {req.status}
                </p>

                {isAdmin && (
                  <div className="mt-3">
                    <p className="text-xs font-semibold text-gray-700 mb-2">Assign employees</p>
                    <div className="flex flex-wrap gap-2">
                      {employees.map((emp) => (
                        <label
                          key={emp._id}
                          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm cursor-pointer ${
                            picked.includes(emp._id)
                              ? 'border-orange-400 bg-orange-50 text-gray-900'
                              : 'border-gray-200 bg-gray-50 text-gray-600'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="rounded border-gray-300"
                            checked={picked.includes(emp._id)}
                            onChange={() => toggleDev(req._id, emp._id)}
                          />
                          {emp.name}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {canDevComplete && (
                  <button
                    type="button"
                    onClick={() => markRequirementDone(req._id)}
                    className="mt-3 px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    Mark my work complete (done)
                  </button>
                )}

                {showAddon && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-xs font-semibold text-gray-800 mb-2">
                      Add-on payment plan (extra billing — not included in main project contract total)
                    </p>
                    <div className="flex flex-wrap gap-2 items-end">
                      <div>
                        <label className="block text-[10px] uppercase text-gray-500">Total (LKR)</label>
                        <input
                          className="border rounded px-2 py-1 text-sm w-28"
                          value={addon[req._id]?.total ?? ''}
                          onChange={(e) =>
                            setAddon((p) => ({
                              ...p,
                              [req._id]: { ...(p[req._id] || { total: '', downPct: '', months: '' }), total: e.target.value },
                            }))
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase text-gray-500">Down %</label>
                        <input
                          className="border rounded px-2 py-1 text-sm w-20"
                          value={addon[req._id]?.downPct ?? ''}
                          onChange={(e) =>
                            setAddon((p) => ({
                              ...p,
                              [req._id]: { ...(p[req._id] || { total: '', downPct: '', months: '' }), downPct: e.target.value },
                            }))
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase text-gray-500">Installments</label>
                        <input
                          className="border rounded px-2 py-1 text-sm w-20"
                          value={addon[req._id]?.months ?? ''}
                          onChange={(e) =>
                            setAddon((p) => ({
                              ...p,
                              [req._id]: { ...(p[req._id] || { total: '', downPct: '', months: '' }), months: e.target.value },
                            }))
                          }
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => createAddonPlan(req._id)}
                        className="px-3 py-1.5 text-xs font-bold rounded-lg bg-gray-900 text-white hover:bg-gray-800"
                      >
                        Create add-on plan
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
