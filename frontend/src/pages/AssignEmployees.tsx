import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

interface ProjectRow {
  _id: string;
  projectName: string;
  status: string;
  assignedEmployees?: string[];
}

interface UserRow {
  _id: string;
  name: string;
  email: string;
  role: 'owner' | 'pm' | 'employee';
}

export default function AssignEmployees() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [projectRes, usersRes] = await Promise.all([
          api.get<ProjectRow[]>('/projects'),
          api.get<UserRow[]>('/users'),
        ]);
        if (projectRes.success && projectRes.data) setProjects(projectRes.data);
        if (usersRes.success && usersRes.data) setUsers(usersRes.data);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const assignments = useMemo(() => {
    const map: Record<string, { user: UserRow; projects: ProjectRow[] }> = {};
    const userById = Object.fromEntries(users.map((u) => [u._id, u]));

    for (const p of projects) {
      for (const uid of p.assignedEmployees || []) {
        const user = userById[uid];
        if (!user || user.role !== 'employee') continue;
        if (!map[uid]) map[uid] = { user, projects: [] };
        map[uid].projects.push(p);
      }
    }

    return Object.values(map).sort((a, b) => a.user.name.localeCompare(b.user.name));
  }, [projects, users]);

  const unassignedProjects = useMemo(
    () => projects.filter((p) => (p.assignedEmployees || []).length === 0),
    [projects]
  );

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Assign Employees</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage assignment from project pages and review assignees here.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowAll((s) => !s)}
            className="px-4 py-2 rounded-lg border border-orange-200 bg-orange-50 text-orange-700 text-sm font-semibold"
          >
            {showAll ? 'Hide All Assignees' : 'View All Assignees & Related Projects'}
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-6">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Unassigned Projects</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left px-4 py-3">Project</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {unassignedProjects.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-gray-500" colSpan={3}>
                  No unassigned projects.
                </td>
              </tr>
            ) : (
              unassignedProjects.map((p) => (
                <tr key={p._id} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-medium text-gray-900">{p.projectName}</td>
                  <td className="px-4 py-3 text-gray-600 capitalize">{p.status}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => navigate(`/projects/${p._id}`)}
                        className="px-3 py-1.5 rounded-md border border-gray-200 bg-white text-xs font-semibold text-gray-700"
                      >
                        Project
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(`/projects/${p._id}?tab=assignments&edit=1`)}
                        className="px-3 py-1.5 rounded-md border border-orange-200 bg-orange-50 text-xs font-semibold text-orange-700"
                      >
                        Assign Employees
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showAll && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-3">Employee</th>
                <th className="text-left px-4 py-3">Email</th>
                <th className="text-left px-4 py-3">Related Projects</th>
              </tr>
            </thead>
            <tbody>
              {assignments.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-gray-500" colSpan={3}>
                    No employee assignments yet.
                  </td>
                </tr>
              ) : (
                assignments.map((row) => (
                  <tr key={row.user._id} className="border-t border-gray-100">
                    <td className="px-4 py-3 font-medium text-gray-900">{row.user.name}</td>
                    <td className="px-4 py-3 text-gray-600">{row.user.email}</td>
                    <td className="px-4 py-3">
                      <ul className="space-y-2">
                        {row.projects.map((p) => (
                          <li
                            key={p._id}
                            className="flex flex-wrap items-center justify-between gap-2 py-1 border-b border-gray-50 last:border-0"
                          >
                            <button
                              type="button"
                              onClick={() => navigate(`/projects/${p._id}`)}
                              className="text-left text-sm text-gray-800 hover:text-orange-700"
                            >
                              {p.projectName}{' '}
                              <span className="text-xs text-gray-500 capitalize">({p.status})</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                navigate(`/projects/${p._id}?tab=assignments&edit=1`)
                              }
                              className="px-2.5 py-1 rounded-md border border-orange-200 bg-orange-50 text-xs font-semibold text-orange-800 shrink-0"
                            >
                              Edit
                            </button>
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

