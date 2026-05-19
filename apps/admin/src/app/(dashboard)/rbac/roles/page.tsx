'use client';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { PERMISSIONS, type Permission } from '@/lib/permissions';
import { PageHeader, Card, StatusPill } from '@/components/dashboard/DashboardShell';

interface AdminRole {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: Permission[];
  _count: { users: number };
}

export default function RbacRolesPage() {
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ name: string; description: string; permissions: Permission[] }>({
    name: '', description: '', permissions: [],
  });
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setRoles(await api<AdminRole[]>('/api/admin/rbac/roles'));
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  function startCreate() {
    setEditingId(null);
    setCreating(true);
    setDraft({ name: '', description: '', permissions: [] });
  }
  function startEdit(r: AdminRole) {
    setCreating(false);
    setEditingId(r.id);
    setDraft({ name: r.name, description: r.description ?? '', permissions: [...r.permissions] });
  }
  function togglePerm(p: Permission) {
    setDraft((d) => ({
      ...d,
      permissions: d.permissions.includes(p) ? d.permissions.filter((x) => x !== p) : [...d.permissions, p],
    }));
  }

  async function save() {
    try {
      if (creating) {
        await api('/api/admin/rbac/roles', {
          method: 'POST',
          body: JSON.stringify({ name: draft.name, description: draft.description || undefined, permissions: draft.permissions }),
        });
        toast.success('Role created');
      } else if (editingId) {
        await api(`/api/admin/rbac/roles/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify({ description: draft.description || null, permissions: draft.permissions }),
        });
        toast.success('Role updated');
      }
      setEditingId(null); setCreating(false);
      load();
    } catch {}
  }

  async function remove(r: AdminRole) {
    if (!confirm(`Delete role "${r.name}"?`)) return;
    try {
      await api(`/api/admin/rbac/roles/${r.id}`, { method: 'DELETE' });
      toast.success('Role deleted');
      load();
    } catch {}
  }

  const editing = creating || editingId !== null;

  return (
    <div>
      <PageHeader
        title="Access control · Roles"
        subtitle="Define admin sub-roles and the permissions they grant. System roles are locked."
        actions={!editing && <button onClick={startCreate} className="btn-primary !px-4 !py-2 text-sm">New role</button>}
      />

      {editing && (
        <Card className="p-5 mb-6">
          <h2 className="font-semibold text-ink-900 mb-3">{creating ? 'New role' : 'Edit role'}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <label className="block">
              <span className="text-xs text-ink-700">Name (UPPER_SNAKE_CASE)</span>
              <input
                disabled={!creating}
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value.toUpperCase() }))}
                className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm disabled:bg-canvas"
                placeholder="VENDOR_MODERATOR"
              />
            </label>
            <label className="block">
              <span className="text-xs text-ink-700">Description</span>
              <input
                value={draft.description}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm"
                placeholder="What this role can do"
              />
            </label>
          </div>

          <div className="mb-4">
            <p className="text-xs text-ink-700 mb-2">Permissions ({draft.permissions.length}/{PERMISSIONS.length})</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {PERMISSIONS.map((p) => (
                <label key={p} className="flex items-center gap-2 text-sm border border-line rounded-md px-3 py-2 hover:bg-canvas cursor-pointer">
                  <input type="checkbox" checked={draft.permissions.includes(p)} onChange={() => togglePerm(p)} />
                  <span className="font-mono text-xs">{p}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={save} className="btn-primary !px-4 !py-2 text-sm">Save</button>
            <button onClick={() => { setEditingId(null); setCreating(false); }} className="btn-secondary !px-4 !py-2 text-sm">Cancel</button>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 bg-surface border border-line rounded-md animate-pulse" />)}</div>
      ) : (
        <div className="space-y-3">
          {roles.map((r) => (
            <Card key={r.id} className="p-5">
              <div className="flex flex-wrap items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-ink-900 font-mono">{r.name}</p>
                    {r.isSystem && <StatusPill tone="info">System</StatusPill>}
                    <StatusPill tone="neutral">{r._count.users} user{r._count.users === 1 ? '' : 's'}</StatusPill>
                  </div>
                  {r.description && <p className="text-sm text-ink-700 mt-1">{r.description}</p>}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {r.permissions.map((p) => (
                      <span key={p} className="text-[10px] font-mono bg-canvas border border-line rounded-pill px-2 py-0.5 text-ink-700">{p}</span>
                    ))}
                    {r.permissions.length === 0 && <span className="text-xs text-ink-500">No permissions</span>}
                  </div>
                </div>
                <div className="flex gap-2 ml-auto">
                  <button onClick={() => startEdit(r)} disabled={r.isSystem} className="btn-secondary !px-4 !py-2 text-xs disabled:opacity-50">Edit</button>
                  <button onClick={() => remove(r)} disabled={r.isSystem || r._count.users > 0} className="text-xs px-4 py-2 rounded-pill bg-red-50 text-danger border border-red-100 disabled:opacity-50">Delete</button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
