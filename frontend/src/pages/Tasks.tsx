import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ListTodo, ExternalLink, Trash2 } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { pushSystemToast } from '../lib/systemToast';
import styles from './Inquiries.module.css';

interface RequirementTask {
  _id: string;
  projectRef?: string;
  title: string;
  description?: string;
  status: string;
  requirementPayoutValue?: number;
  projectName?: string;
}

interface ProjectRow {
  _id: string;
  projectName: string;
}

interface WorkflowReq {
  _id: string;
  title: string;
  status: string;
}

interface DevOption {
  _id: string;
  name: string;
  email?: string;
}

interface ProjectTaskRow {
  _id: string;
  projectId: string;
  projectName?: string;
  requirementId?: string;
  requirementTitle?: string;
  title: string;
  description?: string;
  assigneeIds: string[];
  completed: boolean;
}

export default function Tasks() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'owner' || user?.role === 'pm';
  const isEmployee = user?.role === 'employee';

  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [adminProjectId, setAdminProjectId] = useState('');
  const [workflowReqs, setWorkflowReqs] = useState<WorkflowReq[]>([]);
  const [devOptions, setDevOptions] = useState<DevOption[]>([]);
  const [projectTasks, setProjectTasks] = useState<ProjectTaskRow[]>([]);
  const [reqTasks, setReqTasks] = useState<RequirementTask[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newReqId, setNewReqId] = useState('');
  const [newAssignees, setNewAssignees] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadProjects = useCallback(async () => {
    const res = await api.get<ProjectRow[]>('/projects');
    if (res.success && res.data) setProjects(res.data);
  }, []);

  const loadAdminProjectData = useCallback(async (projectId: string) => {
    if (!projectId) {
      setWorkflowReqs([]);
      setDevOptions([]);
      setProjectTasks([]);
      return;
    }
    const [wf, tasksRes] = await Promise.all([
      api.get<{ requirements: WorkflowReq[]; employees: DevOption[] }>(`/projects/${projectId}/requirement-workflow`),
      api.get<ProjectTaskRow[]>(`/project-tasks?projectId=${projectId}`),
    ]);
    if (wf.success && wf.data) {
      setWorkflowReqs(wf.data.requirements || []);
      setDevOptions(wf.data.employees || []);
    } else {
      setWorkflowReqs([]);
      setDevOptions([]);
      pushSystemToast(wf.error?.message || 'Could not load project workflow.', 'error');
    }
    if (tasksRes.success && tasksRes.data) setProjectTasks(tasksRes.data);
    else setProjectTasks([]);
  }, []);

  const loadEmployeeData = useCallback(async () => {
    const [pt, rt] = await Promise.all([
      api.get<ProjectTaskRow[]>('/project-tasks'),
      api.get<RequirementTask[]>('/projects/developer/requirement-tasks'),
    ]);
    if (pt.success && pt.data) setProjectTasks(pt.data);
    else setProjectTasks([]);
    if (rt.success && rt.data) setReqTasks(rt.data);
    else setReqTasks([]);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        if (isAdmin) {
          await loadProjects();
        } else if (isEmployee) {
          await loadEmployeeData();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin, isEmployee, loadProjects, loadEmployeeData]);

  useEffect(() => {
    if (!isAdmin || !adminProjectId) return;
    void loadAdminProjectData(adminProjectId);
  }, [isAdmin, adminProjectId, loadAdminProjectData]);

  const createTask = async () => {
    if (!adminProjectId || !newTitle.trim()) {
      pushSystemToast('Choose a project and enter a title.', 'error');
      return;
    }
    setSaving(true);
    const res = await api.post<ProjectTaskRow>('/project-tasks', {
      projectId: adminProjectId,
      title: newTitle.trim(),
      description: newDesc.trim() || undefined,
      requirementId: newReqId || undefined,
      assigneeIds: newAssignees,
    });
    setSaving(false);
    if (res.success && res.data) {
      pushSystemToast('Task created.', 'success');
      setNewTitle('');
      setNewDesc('');
      setNewReqId('');
      setNewAssignees([]);
      await loadAdminProjectData(adminProjectId);
    } else {
      pushSystemToast(res.error?.message || 'Could not create task.', 'error');
    }
  };

  const toggleAssignee = (id: string) => {
    setNewAssignees((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleProjectTaskDone = async (t: ProjectTaskRow) => {
    const res = await api.patch<ProjectTaskRow>(`/project-tasks/${t._id}`, { completed: !t.completed });
    if (res.success && res.data) {
      setProjectTasks((prev) => prev.map((x) => (x._id === t._id ? { ...x, ...res.data! } : x)));
    } else {
      pushSystemToast(res.error?.message || 'Could not update task.', 'error');
    }
  };

  const deleteProjectTask = async (id: string) => {
    if (!confirm('Delete this task?')) return;
    const res = await api.delete(`/project-tasks/${id}`);
    if (res.success !== false) {
      pushSystemToast('Task deleted.', 'success');
      if (adminProjectId) await loadAdminProjectData(adminProjectId);
      else if (isEmployee) await loadEmployeeData();
    } else {
      pushSystemToast(res.error?.message || 'Delete failed.', 'error');
    }
  };

  const markRequirementDone = async (reqId: string) => {
    const res = await api.patch(`/requirements/${reqId}`, { status: 'DONE' });
    if (res.success) {
      pushSystemToast('Marked complete.', 'success');
      setReqTasks((prev) => prev.filter((t) => t._id !== reqId));
    } else {
      pushSystemToast(res.error?.message || 'Could not update.', 'error');
    }
  };

  if (!isAdmin && !isEmployee) {
    return (
      <div className={`${styles.page} font-sans p-8 max-w-2xl`}>
        <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
        <p className="text-gray-600 mt-2">
          Sign in as an admin (owner / PM) to create tasks, or as a developer to complete assigned work.
        </p>
      </div>
    );
  }

  if (loading) {
    return <div className={`${styles.page} font-sans p-8 text-gray-500`}>Loading…</div>;
  }

  return (
    <div className={`${styles.page} font-sans max-w-4xl`}>
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-xl bg-orange-100 text-orange-600">
          <ListTodo size={28} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
          <p className="text-sm text-gray-600 mt-0.5">
            {isAdmin
              ? 'Create tasks for a project, optionally tie them to a software requirement, and assign developers.'
              : 'Tick off project tasks and requirement work assigned to you.'}
          </p>
        </div>
      </div>

      {isAdmin ? (
        <div className="space-y-8">
          <section className="border border-orange-100 rounded-2xl p-5 bg-white shadow-sm">
            <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-3">Add task</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="text-gray-600 font-medium">Project</span>
                <select
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  value={adminProjectId}
                  onChange={(e) => setAdminProjectId(e.target.value)}
                >
                  <option value="">Select project…</option>
                  {projects.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.projectName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-gray-600 font-medium">Software requirement (optional)</span>
                <select
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  value={newReqId}
                  onChange={(e) => setNewReqId(e.target.value)}
                  disabled={!adminProjectId}
                >
                  <option value="">None — general project task</option>
                  {workflowReqs.map((r) => (
                    <option key={r._id} value={r._id}>
                      {r.title} ({r.status})
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block text-sm mt-3">
              <span className="text-gray-600 font-medium">Title</span>
              <input
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Implement reporting dashboard"
              />
            </label>
            <label className="block text-sm mt-3">
              <span className="text-gray-600 font-medium">Description (optional)</span>
              <textarea
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm min-h-[72px]"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
              />
            </label>
            <div className="mt-3">
              <div className="text-sm font-medium text-gray-600 mb-2">Assign developers</div>
              <div className="flex flex-wrap gap-2">
                {devOptions.map((d) => (
                  <label
                    key={d._id}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs cursor-pointer ${
                      newAssignees.includes(d._id)
                        ? 'border-orange-400 bg-orange-50 text-orange-900'
                        : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="rounded border-gray-300"
                      checked={newAssignees.includes(d._id)}
                      onChange={() => toggleAssignee(d._id)}
                    />
                    {d.name}
                  </label>
                ))}
                {adminProjectId && devOptions.length === 0 ? (
                  <span className="text-xs text-gray-500">No developers in directory.</span>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              disabled={saving || !adminProjectId}
              onClick={() => void createTask()}
              className="mt-4 px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary-hover disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Create task'}
            </button>
          </section>

          <section>
            <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-3">
              Tasks for selected project
            </h2>
            {!adminProjectId ? (
              <p className="text-gray-500 text-sm">Select a project above to list tasks.</p>
            ) : projectTasks.length === 0 ? (
              <p className="text-gray-500 text-sm border border-dashed border-gray-200 rounded-xl p-6 text-center">
                No tasks yet for this project.
              </p>
            ) : (
              <ul className="space-y-2">
                {projectTasks.map((t) => (
                  <li
                    key={t._id}
                    className="flex flex-wrap items-center gap-3 border border-gray-100 rounded-xl px-4 py-3 bg-white"
                  >
                    <label className="inline-flex items-center gap-2 text-sm cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 h-4 w-4"
                        checked={t.completed}
                        onChange={() => void toggleProjectTaskDone(t)}
                      />
                      <span className={t.completed ? 'line-through text-gray-400' : 'font-medium text-gray-900'}>
                        {t.title}
                      </span>
                    </label>
                    <span className="text-xs text-gray-500">{t.projectName}</span>
                    {t.requirementTitle ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-900">
                        Req: {t.requirementTitle}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      title="Delete"
                      onClick={() => void deleteProjectTask(t._id)}
                      className="ml-auto p-2 text-gray-400 hover:text-red-600"
                    >
                      <Trash2 size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : (
        <div className="space-y-10">
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">Project tasks</h2>
            <p className="text-sm text-gray-600 mb-4">
              Admin-assigned tasks for your projects. Tick the box when finished.
            </p>
            {projectTasks.length === 0 ? (
              <p className="text-gray-500 text-sm border border-dashed border-gray-200 rounded-xl p-6 text-center">
                No project tasks assigned to you.
              </p>
            ) : (
              <ul className="space-y-3">
                {projectTasks.map((t) => (
                  <li
                    key={t._id}
                    className="border border-orange-100 rounded-xl p-4 bg-white shadow-sm flex flex-wrap items-start gap-3"
                  >
                    <label className="inline-flex items-start gap-3 cursor-pointer min-w-0 flex-1">
                      <input
                        type="checkbox"
                        className="mt-1 rounded border-gray-300 h-5 w-5"
                        checked={t.completed}
                        onChange={() => void toggleProjectTaskDone(t)}
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-orange-600 uppercase">
                          {t.projectName || 'Project'}
                        </div>
                        <div className={`font-semibold ${t.completed ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                          {t.title}
                        </div>
                        {t.description ? (
                          <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{t.description}</p>
                        ) : null}
                        {t.requirementTitle ? (
                          <p className="text-xs text-amber-800 mt-2">
                            Software requirement: <strong>{t.requirementTitle}</strong>
                          </p>
                        ) : null}
                      </div>
                    </label>
                    <Link
                      to={`/projects/${t.projectId}`}
                      className="text-xs font-bold text-orange-700 hover:underline shrink-0"
                    >
                      Open project
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">Software requirements</h2>
            <p className="text-sm text-gray-600 mb-4">
              Requirements you are assigned on projects (from workflow). Mark done when delivered.
            </p>
            {reqTasks.length === 0 ? (
              <p className="text-gray-500 text-sm border border-dashed border-gray-200 rounded-xl p-6 text-center">
                No requirement tasks assigned to you yet.
              </p>
            ) : (
              <ul className="space-y-3">
                {reqTasks.map((t) => (
                  <li
                    key={t._id}
                    className="border border-orange-100 rounded-xl p-4 bg-white shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-orange-600 uppercase">
                        {t.projectName || 'Project'}
                      </div>
                      <div className="font-semibold text-gray-900 mt-0.5">{t.title}</div>
                      {t.description ? (
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2 whitespace-pre-wrap">{t.description}</p>
                      ) : null}
                      <div className="flex flex-wrap gap-2 mt-2 text-xs text-gray-500">
                        <span className="px-2 py-0.5 rounded-full bg-gray-100">{t.status}</span>
                        {t.requirementPayoutValue != null && Number(t.requirementPayoutValue) > 0 ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800">
                            Value LKR {Number(t.requirementPayoutValue).toLocaleString()}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {t.projectRef ? (
                        <Link
                          to={`/projects/${t.projectRef}/requirement-workflow`}
                          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg border border-orange-200 text-orange-700 hover:bg-orange-50"
                        >
                          <ExternalLink size={14} />
                          Workflow
                        </Link>
                      ) : null}
                      {t.status !== 'DONE' && t.status !== 'DEFERRED' ? (
                        <button
                          type="button"
                          onClick={() => void markRequirementDone(t._id)}
                          className="px-3 py-2 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                        >
                          Mark done
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
