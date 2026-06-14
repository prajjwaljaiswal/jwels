'use client';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { PageHeader, Card, StatusPill } from '@/components/dashboard/DashboardShell';
import { useCurrency, formatPrice } from '@/lib/currency';

interface VendorReturn {
  id: string;
  status: string;
  reason: string;
  description: string | null;
  photoUrls: string[];
  vendorNote: string | null;
  refundStatus: string;
  createdAt: string;
  orderItem: { id: string; priceAtPurchase: string; quantity: number; product: { name: string; images: string[] } | null } | null;
  customer: { name: string } | null;
  dispute: { id: string; status: string } | null;
}

function rtone(s: string): 'success' | 'warn' | 'danger' | 'neutral' | 'info' {
  if (s === 'REFUNDED') return 'success';
  if (s === 'REJECTED' || s === 'CANCELLED') return 'danger';
  if (s === 'REQUESTED') return 'warn';
  return 'info';
}

const TABS = ['OPEN', 'ALL'] as const;

export default function VendorReturnsPage() {
  const { code } = useCurrency();
  const [rows, setRows] = useState<VendorReturn[]>([]);
  const [tab, setTab] = useState<typeof TABS[number]>('OPEN');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await api<VendorReturn[]>('/api/returns/vendor');
      setRows(data);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function act(id: string, action: 'approve' | 'reject' | 'received') {
    let note: string | undefined;
    if (action === 'reject') {
      const n = window.prompt('Reason for rejecting this return (optional):', '');
      if (n === null) return;
      note = n || undefined;
    }
    setBusy(id);
    try {
      await api(`/api/returns/${id}/vendor`, { method: 'PATCH', body: JSON.stringify({ action, note }) });
      toast.success(action === 'approve' ? 'Return approved' : action === 'reject' ? 'Return rejected' : 'Marked received');
      load();
    } catch (e: any) { toast.error(e?.message || 'Action failed'); }
    finally { setBusy(null); }
  }

  const visible = tab === 'OPEN'
    ? rows.filter((r) => ['REQUESTED', 'APPROVED', 'PICKUP_SCHEDULED'].includes(r.status))
    : rows;

  return (
    <div>
      <PageHeader title="Returns" subtitle="Approve or reject return requests. Once you receive the item back, mark it received — the marketplace then issues the refund." />

      <div className="border-b border-line mb-6">
        <div className="flex gap-6">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`relative py-3 text-sm ${tab === t ? 'text-ink-900 font-semibold' : 'text-ink-700 hover:text-ink-900'}`}>
              {t === 'OPEN' ? 'Open' : 'All'}
              {tab === t && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-brand-600 rounded-full" />}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 bg-surface border border-line rounded-md animate-pulse" />)}</div>
      ) : visible.length === 0 ? (
        <Card className="p-10 text-center text-ink-700">No return requests.</Card>
      ) : (
        <div className="space-y-3">
          {visible.map((r) => {
            const lineValue = r.orderItem ? Number(r.orderItem.priceAtPurchase) * r.orderItem.quantity : 0;
            return (
              <Card key={r.id} className="p-4">
                <div className="flex flex-wrap items-start gap-4">
                  <img src={r.orderItem?.product?.images?.[0] || '/placeholder.png'} alt="" className="h-16 w-16 rounded object-cover bg-canvas shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-ink-900 truncate">{r.orderItem?.product?.name ?? 'Item'}</p>
                      <StatusPill tone={rtone(r.status)}>{r.status}</StatusPill>
                      {r.dispute && <StatusPill tone="danger">Disputed</StatusPill>}
                    </div>
                    <p className="text-sm text-ink-700 mt-0.5">{r.reason.replace(/_/g, ' ')} · {r.customer?.name ?? 'Customer'} · {formatPrice(lineValue, code)}</p>
                    {r.description && <p className="text-sm text-ink-500 mt-1">{r.description}</p>}
                    {r.photoUrls.length > 0 && (
                      <div className="flex gap-2 mt-2">
                        {r.photoUrls.slice(0, 4).map((u, i) => <img key={i} src={u} alt="" className="h-12 w-12 rounded object-cover border border-line" />)}
                      </div>
                    )}
                    {r.vendorNote && <p className="text-xs text-ink-500 mt-1 italic">Your note: {r.vendorNote}</p>}
                  </div>
                  <div className="flex flex-col gap-2 ml-auto">
                    {r.status === 'REQUESTED' && (
                      <>
                        <button disabled={busy === r.id} onClick={() => act(r.id, 'approve')} className="btn-primary !px-4 !py-2 text-xs disabled:opacity-50">Approve</button>
                        <button disabled={busy === r.id} onClick={() => act(r.id, 'reject')} className="btn-secondary !px-4 !py-2 text-xs disabled:opacity-50">Reject</button>
                      </>
                    )}
                    {(r.status === 'APPROVED' || r.status === 'PICKUP_SCHEDULED') && (
                      <button disabled={busy === r.id} onClick={() => act(r.id, 'received')} className="btn-primary !px-4 !py-2 text-xs disabled:opacity-50">Mark received</button>
                    )}
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
