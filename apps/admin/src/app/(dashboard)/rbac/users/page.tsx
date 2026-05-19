'use client';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { PageHeader, Card, StatusPill } from '@/components/dashboard/DashboardShell';

interface AdminRoleLite { id: string; name: string; isSystem: boolean }
interface AdminUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  adminRoles: Array<{ role: AdminRoleLite }>;
}

export default function RbacUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<AdminRoleLite[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [pendingRole, setPendingRole] = useState<Record<string, string>>({});

  async function load(query = '') {
    setLoading(true);
    try {
      const [u, r] = await Promise.all([
        api<AdminUser[]>(`/api/admin/rbac/users${query ? `?q=${encodeURIComponent(query)}` : ''}`),
        api<AdminRoleLite[]>('/api/admin/rbac/roles'),
      ]);
      setUsers(u);
      setRoles(r);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function assign(userId: string) {
    const roleId = pendingRole[userId];
    if (!roleId) return;
    try {
      await api(`/api/admin/rbac/users/${userId}/roles`, { method: 'POST', body: JSON.stringify({ roleId }) });
      toast.success('Role assigned');
      setPendingRole((s) => ({ ...s, [userId]: '' }));
      load(q);
    } catch {}
  }

  async function revoke(userId: string, roleId: string, roleName: string) {
    if (!confirm(`Revoke "${roleName}" from this user?`)) return;
    try {
      await api(`/api/admin/rbac/users/${userId}/roles/${roleId}`, { method: 'DELETE' });
      toast.success('Role revoked');
      load(q);
    } catch {}
  }

  return (
    <div>
      <PageHeader title="Access control · Admin users" subtitle="Assign roles to admin accounts. Each user inherits the union of their roles' permissions." />

      <form
        onSubmit={(e) => { e.preventDefault(); load(q); }}
        className="mb-4 flex gap-2"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search admin users by name or email"
          className="flex-1 rounded-md border border-line px-3 py-2 text-sm"
        />
        <button className="btn-secondary !px-4 !py-2 text-sm">Search</button>
      </form>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 bg-surface border border-line rounded-md animate-pulse" />)}</div>
      ) : users.length === 0 ? (
        <Card className="p-10 text-center text-ink-700">No admin users found.</Card>
      ) : (
        <div className="space-y-3">
          {users.map((u) => {
            const assigned = new Set(u.adminRoles.map((ur) => ur.role.id));
            const available = roles.filter((r) => !assigned.has(r.id));
            return (
              <Card key={u.id} className="p-5">
                <div className="flex flex-wrap items-start gap-4">
                  <div className="h-10 w-10 rounded-full bg-brand-50 text-brand-700 font-bold flex items-center justify-center shrink-0">
                    {u.name[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-ink-900">{u.name}</p>
                    <p className="text-sm text-ink-700">{u.email}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {u.adminRoles.length === 0 && <span className="text-xs text-ink-500">No roles assigned</span>}
                      {u.adminRoles.map((ur) => (
                        <span key={ur.role.id} className="inline-flex items-center gap-1 text-xs font-mono bg-canvas border border-line rounded-pill pl-2 pr-1 py-0.5">
                          {ur.role.name}
                          {ur.role.isSystem && <StatusPill tone="info">sys</StatusPill>}
                          <button
                            onClick={() => revoke(u.id, ur.role.id, ur.role.name)}
                            className="ml-1 h-4 w-4 rounded-full hover:bg-red-50 text-danger flex items-center justify-center"
                            aria-label="Revoke"
                          >×</button>
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 ml-auto">
                    <select
                      value={pendingRole[u.id] || ''}
                      onChange={(e) => setPendingRole((s) => ({ ...s, [u.id]: e.target.value }))}
                      className="rounded-md border border-line px-2 py-2 text-xs"
                    >
                      <option value="">Add role…</option>
                      {available.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                    <button onClick={() => assign(u.id)} disabled={!pendingRole[u.id]} className="btn-primary !px-4 !py-2 text-xs disabled:opacity-50">Assign</button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
