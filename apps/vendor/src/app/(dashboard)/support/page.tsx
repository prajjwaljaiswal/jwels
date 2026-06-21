'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { PageHeader, Card, StatusPill } from '@/components/dashboard/DashboardShell';
import { supportApi } from '@/lib/support/api';
import { CATEGORY_LABELS, STATUS_LABELS } from '@/lib/support/types';
import type { SupportTicketDTO, TicketStatus } from '@/lib/support/types';

function statusTone(s: TicketStatus): 'success' | 'warn' | 'danger' | 'neutral' | 'info' {
  if (s === 'RESOLVED') return 'success';
  if (s === 'OPEN') return 'info';
  if (s === 'PENDING') return 'warn';
  if (s === 'CLOSED') return 'neutral';
  return 'neutral';
}

function fmt(iso: string) {
  try { return new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
}

const TABS = ['OPEN', 'ALL'] as const;

export default function VendorSupportPage() {
  const [rows, setRows] = useState<SupportTicketDTO[]>([]);
  const [tab, setTab] = useState<typeof TABS[number]>('OPEN');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const data = await supportApi.vendorInbox({
        status: tab === 'OPEN' ? 'OPEN,PENDING,AWAITING_CUSTOMER' : undefined,
        unread: unreadOnly || undefined,
      });
      setRows(data);
    } catch (e: any) {
      toast.error(e?.message || 'Could not load tickets');
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tab, unreadOnly]);

  const totalUnread = rows.reduce((n, t) => n + (t.unread || 0), 0);

  return (
    <div>
      <PageHeader title="Support" subtitle="Customer conversations for your shop" />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="inline-flex rounded-md border border-line overflow-hidden">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 h-9 text-sm font-medium ${tab === t ? 'bg-brand-50 text-brand-700' : 'bg-surface text-ink-600 hover:bg-canvas'}`}>
              {t === 'OPEN' ? 'Active' : 'All'}
            </button>
          ))}
        </div>
        <label className="inline-flex items-center gap-1.5 text-sm text-ink-700">
          <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} />
          Unread only
        </label>
        {totalUnread > 0 && <span className="text-sm text-ink-500">{totalUnread} unread message{totalUnread === 1 ? '' : 's'}</span>}
      </div>

      <Card>
        {loading ? (
          <p className="p-6 text-sm text-ink-500">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-ink-500">No conversations {tab === 'OPEN' ? 'need attention' : 'yet'}.</p>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((t) => (
              <li key={t.id}>
                <Link href={`/support/${t.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-canvas">
                  {t.unread > 0 && <span className="h-2 w-2 rounded-full bg-brand-600 shrink-0" title={`${t.unread} unread`} />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className={`truncate ${t.unread > 0 ? 'font-semibold text-ink-900' : 'text-ink-800'}`}>{t.subject}</p>
                      {t.priority === 'URGENT' && <StatusPill tone="danger">Urgent</StatusPill>}
                      {t.priority === 'HIGH' && <StatusPill tone="warn">High</StatusPill>}
                    </div>
                    <p className="text-xs text-ink-500 truncate">
                      {t.ticketNumber} · {t.creatorName || 'Customer'} · {CATEGORY_LABELS[t.category]}
                      {t.productName ? ` · ${t.productName}` : ''}
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
