'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { useVendor } from '@/lib/vendor-context';
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

export default function StorefrontSupportPage() {
  const router = useRouter();
  const { vendor, theme, basePath } = useVendor();
  const [rows, setRows] = useState<SupportTicketDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = typeof window !== 'undefined' ? window.localStorage.getItem('token') : null;
    const next = `${basePath}/account/support`;
    if (!t) { router.replace(`/login?next=${encodeURIComponent(next)}`); return; }
    // Only this seller's conversations (this is their branded storefront).
    api<SupportTicketDTO[]>('/api/support/tickets', { silent: true })
      .then((all) => setRows(all.filter((x) => x.vendorId === vendor.id)))
      .catch((e) => toast.error(e?.message || 'Could not load your messages'))
      .finally(() => setLoading(false));
  }, [router, vendor.id, basePath]);

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl text-ink-900">Messages</h1>
          <p className="text-sm text-ink-500 mt-1">Your conversations with {vendor.shopName}</p>
        </div>
        <div className="flex items-center gap-2">
          {pushSupported() && (
            <button
              onClick={() => enablePush(`${window.location.origin}${basePath}/account/support/{id}`)
                .then(() => toast.success('Notifications enabled'))
                .catch((e) => toast.error(e?.message || 'Could not enable notifications'))}
              className="px-4 py-2 rounded-pill border font-semibold text-sm"
              style={{ borderColor: theme, color: theme }}>
              🔔 Notify me
            </button>
          )}
          <Link href={`${basePath}/account/support/new`}
            className="px-4 py-2 rounded-pill font-semibold text-sm text-white"
            style={{ backgroundColor: theme }}>
            New request
          </Link>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-ink-500">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="bg-surface border border-line rounded-md p-8 text-center shadow-card">
          <p className="text-ink-700">You have no messages yet.</p>
          <Link href={`${basePath}/account/support/new`} className="inline-block mt-4 px-4 py-2 rounded-pill border font-semibold text-sm"
            style={{ borderColor: theme, color: theme }}>
            Contact {vendor.shopName}
          </Link>
        </div>
      ) : (
        <ul className="bg-surface border border-line rounded-md shadow-card divide-y divide-line overflow-hidden">
          {rows.map((t) => (
            <li key={t.id}>
              <Link href={`${basePath}/account/support/${t.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-canvas">
                {t.unread > 0 && <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: theme }} />}
                <div className="min-w-0 flex-1">
                  <p className={`truncate ${t.unread > 0 ? 'font-semibold text-ink-900' : 'text-ink-800'}`}>{t.subject}</p>
                  <p className="text-xs text-ink-500 truncate">{CATEGORY_LABELS[t.category]} · {t.ticketNumber}</p>
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
