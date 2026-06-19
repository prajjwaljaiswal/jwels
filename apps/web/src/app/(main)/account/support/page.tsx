'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { supportApi } from '@/lib/support/api';
import { CATEGORY_LABELS, STATUS_LABELS } from '@/lib/support/types';
import type { SupportTicketDTO, TicketStatus } from '@/lib/support/types';
import { enablePush, pushSupported } from '@/lib/realtime/push';

function pill(s: TicketStatus): string {
  if (s === 'RESOLVED') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  if (s === 'OPEN') return 'bg-brand-50 text-brand-700 border-brand-100';
  if (s === 'CLOSED') return 'bg-canvas text-ink-500 border-line';
  return 'bg-amber-50 text-amber-700 border-amber-100';
}
function fmt(iso: string) {
  try { return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); } catch { return ''; }
}

export default function MySupportPage() {
  const router = useRouter();
  const [rows, setRows] = useState<SupportTicketDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = typeof window !== 'undefined' ? window.localStorage.getItem('token') : null;
    if (!t) { router.replace('/login?next=/account/support'); return; }
    supportApi.listMyTickets()
      .then(setRows)
      .catch((e) => toast.error(e?.message || 'Could not load your messages'))
      .finally(() => setLoading(false));
  }, [router]);

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-ink-900">Messages</h1>
          <p className="text-sm text-ink-500 mt-1">Your conversations with sellers and our support team</p>
        </div>
        <div className="flex items-center gap-2">
          {pushSupported() && (
            <button
              onClick={() => enablePush(`${window.location.origin}/account/support/{id}`)
                .then(() => toast.success('Notifications enabled'))
                .catch((e) => toast.error(e?.message || 'Could not enable notifications'))}
              className="btn-secondary !py-2 text-sm"
            >
              🔔 Notify me
            </button>
          )}
          <Link href="/account/support/new" className="btn-primary">New request</Link>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-ink-500">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="bg-surface border border-line rounded-md p-8 text-center shadow-card">
          <p className="text-ink-700">You have no messages yet.</p>
          <Link href="/account/support/new" className="btn-secondary mt-4 inline-block">Start a conversation</Link>
        </div>
      ) : (
        <ul className="bg-surface border border-line rounded-md shadow-card divide-y divide-line overflow-hidden">
          {rows.map((t) => (
            <li key={t.id}>
              <Link href={`/account/support/${t.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-canvas">
                {t.unread > 0 && <span className="h-2 w-2 rounded-full bg-brand-600 shrink-0" />}
                <div className="min-w-0 flex-1">
                  <p className={`truncate ${t.unread > 0 ? 'font-semibold text-ink-900' : 'text-ink-800'}`}>{t.subject}</p>
                  <p className="text-xs text-ink-500 truncate">
                    {t.vendorName || 'Vrindaonline Support'} · {CATEGORY_LABELS[t.category]} · {t.ticketNumber}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className={`inline-block rounded-pill border px-2.5 py-0.5 text-[11px] font-semibold ${pill(t.status)}`}>
                    {STATUS_LABELS[t.status]}
                  </span>
                  <p className="text-[11px] text-ink-400 mt-1">{fmt(t.lastMessageAt)}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
