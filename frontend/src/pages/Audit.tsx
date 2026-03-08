import { useEffect, useState } from 'react';
import { api } from '../api/client';
import styles from './Inquiries.module.css';

interface AuditLogEntry {
  _id: string;
  userId: string;
  userName?: string;
  action: string;
  tableName: string;
  recordId?: string;
  ipAddress?: string;
  createdAt: string;
}

interface UserOption {
  _id: string;
  name?: string;
  email?: string;
}

export default function Audit() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [userFilter, setUserFilter] = useState<string>('');
  const [actionFilter, setActionFilter] = useState<string>('');
  const [tableFilter, setTableFilter] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const load = () => {
    const params = new URLSearchParams();
    if (userFilter) params.append('userId', userFilter);
    if (actionFilter) params.append('action', actionFilter);
    if (tableFilter) params.append('tableName', tableFilter);
    if (dateFrom) params.append('dateFrom', dateFrom);
    if (dateTo) params.append('dateTo', dateTo);
    const q = params.toString() ? `?${params.toString()}` : '';
    setLoading(true);
    api.get<AuditLogEntry[]>(`/audit${q}`).then((res) => {
      if (res.success && res.data) setEntries(res.data);
      setLoading(false);
    });
  };

  useEffect(() => {
    api.get<UserOption[]>('/users').then((res) => {
      if (res.success && res.data) setUsers(Array.isArray(res.data) ? res.data : []);
    });
  }, []);

  useEffect(() => {
    load();
  }, [userFilter, actionFilter, tableFilter, dateFrom, dateTo]);

  const formatDateTime = (d: string) =>
    new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className={`${styles.page} font-sans`}>
      <div className={styles.headerRow}>
        <h1 className="text-2xl font-bold text-gray-900">Audit log</h1>
      </div>
      <p className="text-gray-600 text-sm mb-4">Chronological trail of actions. Read-only.</p>

      <div className={`${styles.filtersRow} flex-wrap gap-2`}>
        <select
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
          className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary"
        >
          <option value="">All users</option>
          {users.map((u) => (
            <option key={u._id} value={u._id}>{u.name || u.email || u._id}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Action"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary w-32"
        />
        <input
          type="text"
          placeholder="Table"
          value={tableFilter}
          onChange={(e) => setTableFilter(e.target.value)}
          className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary w-32"
        />
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary"
        />
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className="px-6 py-4 text-orange-500 font-bold text-sm">Time</th>
              <th className="px-6 py-4 text-orange-500 font-bold text-sm">User</th>
              <th className="px-6 py-4 text-orange-500 font-bold text-sm">Action</th>
              <th className="px-6 py-4 text-orange-500 font-bold text-sm">Table</th>
              <th className="px-6 py-4 text-orange-500 font-bold text-sm">Record ID</th>
              <th className="px-6 py-4 text-orange-500 font-bold text-sm">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y-0">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">Loading...</td>
              </tr>
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">No audit entries. Actions on key entities will be logged here.</td>
              </tr>
            ) : (
              entries.map((e) => (
                <tr key={e._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-gray-600 text-sm">{formatDateTime(e.createdAt)}</td>
                  <td className="px-6 py-4 font-medium text-gray-900">{e.userName || e.userId}</td>
                  <td className="px-6 py-4 text-gray-700">{e.action}</td>
                  <td className="px-6 py-4 text-gray-600">{e.tableName}</td>
                  <td className="px-6 py-4 text-gray-500 font-mono text-xs">{e.recordId ? e.recordId.slice(-8) : '—'}</td>
                  <td className="px-6 py-4 text-gray-500 text-sm">{e.ipAddress || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
