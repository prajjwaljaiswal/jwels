'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { PageHeader, Card, KpiCard, StatusPill } from '@/components/dashboard/DashboardShell';
import { supportApi } from '@/lib/support/api';
import { CATEGORY_LABELS, STATUS_LABELS } from '@/lib/support/types';
import type { SupportTicketDTO, TicketStatus } from '@/lib/support/types';

function statusTone(s: TicketStatus): 'success' | 'warn' | 'danger' | 'neutral' | 'info' {
  if (s === 'RESOLVED') return 'success';
  if (s === 'OPEN') return 'info';
  if (s === 'PENDING') return 'warn';
  return 'neutral';
}
function fmt(iso: string) {
  try { return new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
}

const SCOPES = [
  { key: '', label: 'All' },
  { key: 'platform', label: 'Platform' },
  { key: 'vendor', label: 'Seller' },
] as const;

export default function AdminSupportPage() {
  const [rows, setRows] = useState<SupportTicketDTO[]>([]);
  const [stats, setStats] = useState<{ byStatus: Record<string, number>; unassignedOpen: number } | null>(null);
  const [scope, setScope] = useState<'' | 'platform' | 'vendor'>('');
  const [activeOnly, setActiveOnly] = useState(true);
  const [flagged, setFlagged] = useState(false);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const data = await supportApi.adminQueue({
        scope: scope || undefined,
        status: activeOnly ? 'OPEN,PENDING,AWAITING_CUSTOMER' : undefined,
        flagged: flagged || undefined,
        q: q.trim() || undefined,
      });
      setRows(data);
    } catch (e: any) {
      toast.error(e?.message || 'Could not load queue');
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [scope, activeOnly, flagged]);
  useEffect(() => { supportApi.adminStats().then(setStats).catch(() => {}); }, []);

  return (
    <div>
      <PageHeader title="Support queue" subtitle="All conversations across sellers and platform support" />

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <KpiCard label="Open" value={stats.byStatus.OPEN ?? 0} accent="brand" />
          <KpiCard label="Pending" value={stats.byStatus.PENDING ?? 0} accent="warn" />
          <KpiCard label="Awaiting reply" value={stats.byStatus.AWAITING_CUSTOMER ?? 0} />
          <KpiCard label="Unassigned" value={stats.unassignedOpen} accent={stats.unassignedOpen > 0 ? 'warn' : 'ink'} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="inline-flex rounded-md border border-line overflow-hidden">
          {SCOPES.map((s) => (
            <button key={s.key} onClick={() => setScope(s.key as any)}
              className={`px-4 h-9 text-sm font-medium ${scope === s.key ? 'bg-brand-50 text-brand-700' : 'bg-surface text-ink-600 hover:bg-canvas'}`}>
              {s.label}
            </button>
          ))}
        </div>
        <label className="inline-flex items-center gap-1.5 text-sm text-ink-700">
          <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} /> Active only
        </label>
        <label className="inline-flex items-center gap-1.5 text-sm text-ink-700">
          <input type="checkbox" checked={flagged} onChange={(e) => setFlagged(e.target.checked)} /> ⚠ Flagged
        </label>
        <form onSubmit={(e) => { e.preventDefault(); load(); }} className="ml-auto flex items-center gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search subject / number"
            className="rounded-md border border-line px-3 h-9 text-sm w-56" />
          <button className="h-9 px-3 rounded-md border border-line text-sm hover:bg-canvas">Search</button>
        </form>
      </div>

      <Card>
        {loading ? (
          <p className="p-6 text-sm text-ink-500">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-ink-500">No tickets match.</p>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((t) => (
              <li key={t.id}>
                <Link href={`/support/${t.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-canvas">
                  {t.unread > 0 && <span className="h-2 w-2 rounded-full bg-brand-600 shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium text-ink-900">{t.subject}</p>
                      {t.priority === 'URGENT' && <StatusPill tone="danger">Urgent</StatusPill>}
                      {t.priority === 'HIGH' && <StatusPill tone="warn">High</StatusPill>}
                    </div>
                    <p className="text-xs text-ink-500 truncate">
                      {t.ticketNumber} · {t.creatorName || 'User'} · {t.vendorName || 'Platform'} · {CATEGORY_LABELS[t.category]}
                      {t.assignedToName ? ` · @${t.assignedToName}` : ' · unassigned'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <StatusPill tone={statusTone(t.status)}>{STATUS_LABELS[t.status]}</StatusPill>
                    <p className="text-[11px] text-ink-400 mt-1">{fmt(t.lastMessageAt)}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
