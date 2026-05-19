'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { PageHeader, Card } from '@/components/dashboard/DashboardShell';

interface AuditEntry {
  id: string;
  action: string;
  target: string | null;
  metadata: any;
  createdAt: string;
  actor: { id: string; name: string; email: string };
}

export default function RbacAuditPage() {
  const [items, setItems] = useState<AuditEntry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  async function load(reset = true) {
    if (reset) { setLoading(true); setItems([]); setCursor(null); }
    else setLoadingMore(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '50');
      if (actionFilter) params.set('action', actionFilter);
      if (!reset && cursor) params.set('cursor', cursor);
      const res = await api<{ items: AuditEntry[]; nextCursor: string | null }>(`/api/admin/rbac/audit?${params}`);
      setItems((prev) => reset ? res.items : [...prev, ...res.items]);
      setCursor(res.nextCursor);
    } finally {
      setLoading(false); setLoadingMore(false);
    }
  }
  useEffect(() => { load(true); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  return (
    <div>
      <PageHeader title="Audit log" subtitle="Every privileged admin action recorded with actor, target, and timestamp." />

      <form
        onSubmit={(e) => { e.preventDefault(); load(true); }}
        className="mb-4 flex gap-2"
      >
        <input
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          placeholder="Filter by action (e.g. rbac.role.create)"
          className="flex-1 rounded-md border border-line px-3 py-2 text-sm font-mono"
        />
        <button className="btn-secondary !px-4 !py-2 text-sm">Filter</button>
      </form>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-12 bg-surface border border-line rounded-md animate-pulse" />)}</div>
      ) : items.length === 0 ? (
        <Card className="p-10 text-center text-ink-700">No audit entries match.</Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-canvas text-ink-700 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-2">When</th>
                <th className="text-left px-4 py-2">Actor</th>
                <th className="text-left px-4 py-2">Action</th>
                <th className="text-left px-4 py-2">Target</th>
                <th className="text-left px-4 py-2">Metadata</th>
              </tr>
            </thead>
            <tbody>
              {items.map((e) => (
                <tr key={e.id} className="border-t border-line align-top">
                  <td className="px-4 py-2 whitespace-nowrap text-ink-700">{new Date(e.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-2">
                    <div>{e.actor.name}</div>
                    <div className="text-xs text-ink-500">{e.actor.email}</div>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{e.action}</td>
                  <td className="px-4 py-2 font-mono text-xs text-ink-700">{e.target ?? '—'}</td>
                  <td className="px-4 py-2 font-mono text-[11px] text-ink-700 max-w-md truncate">
                    {e.metadata ? JSON.stringify(e.metadata) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {cursor && (
        <div className="mt-4 flex justify-center">
          <button onClick={() => load(false)} disabled={loadingMore} className="btn-secondary !px-4 !py-2 text-sm">
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}
