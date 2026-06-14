'use client';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { PageHeader, Card, StatusPill } from '@/components/dashboard/DashboardShell';
import { useCurrency, formatPrice } from '@/lib/currency';

interface ReturnRow {
  id: string;
  status: string;
  reason: string;
  description: string | null;
  refundStatus: string;
  refundAmount: string;
  photoUrls: string[];
  createdAt: string;
  orderItem: { id: string; priceAtPurchase: string; quantity: number; product: { name: string; images: string[] } | null } | null;
  customer: { name: string; email: string } | null;
  vendor: { shopName: string } | null;
  order: { id: string; status: string; paymentMethod: string; razorpayPaymentId: string | null } | null;
}
interface DisputeRow {
  id: string; status: string; subject: string; detail: string | null; createdAt: string;
  raisedBy: { name: string; email: string } | null;
  returnRequest: { orderItem: { product: { name: string } | null } | null } | null;
}

function rtone(s: string): 'success' | 'warn' | 'danger' | 'neutral' | 'info' {
  if (s === 'REFUNDED' || s === 'RESOLVED') return 'success';
  if (s === 'REJECTED' || s === 'CANCELLED') return 'danger';
  if (s === 'REQUESTED' || s === 'OPEN') return 'warn';
  return 'info';
}

export default function AdminReturnsPage() {
  const { code } = useCurrency();
  const [tab, setTab] = useState<'returns' | 'disputes'>('returns');
  const [returns, setReturns] = useState<ReturnRow[]>([]);
  const [disputes, setDisputes] = useState<DisputeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [r, d] = await Promise.all([
        api<ReturnRow[]>('/api/returns/admin').catch(() => []),
        api<DisputeRow[]>('/api/returns/disputes').catch(() => []),
      ]);
      setReturns(r); setDisputes(d);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function refund(row: ReturnRow) {
    const lineValue = row.orderItem ? Number(row.orderItem.priceAtPurchase) * row.orderItem.quantity : 0;
    if (!confirm(`Refund ${formatPrice(lineValue, code)} for "${row.orderItem?.product?.name ?? 'item'}"? ${row.order?.razorpayPaymentId ? 'This issues a Razorpay refund.' : 'COD/manual — recorded as a manual refund.'}`)) return;
    setBusy(row.id);
    try {
      await api(`/api/returns/${row.id}/refund`, { method: 'POST', body: JSON.stringify({}) });
      toast.success('Refund issued');
      load();
    } catch (e: any) { toast.error(e?.message || 'Refund failed'); }
    finally { setBusy(null); }
  }

  async function resolveDispute(id: string, status: string) {
    setBusy(id);
    try {
      await api(`/api/returns/disputes/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      toast.success(`Dispute ${status.toLowerCase()}`);
      load();
    } catch (e: any) { toast.error(e?.message || 'Failed'); }
    finally { setBusy(null); }
  }

  return (
    <div>
      <PageHeader title="Returns & disputes" subtitle="Approve refunds and resolve customer disputes." />

      <div className="border-b border-line mb-6">
        <div className="flex gap-6">
          {(['returns', 'disputes'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`relative py-3 text-sm ${tab === t ? 'text-ink-900 font-semibold' : 'text-ink-700 hover:text-ink-900'}`}>
              {t === 'returns' ? `Returns (${returns.length})` : `Disputes (${disputes.length})`}
              {tab === t && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-brand-600 rounded-full" />}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 bg-surface border border-line rounded-md animate-pulse" />)}</div>
      ) : tab === 'returns' ? (
        returns.length === 0 ? <Card className="p-10 text-center text-ink-700">No return requests.</Card> : (
          <div className="space-y-3">
            {returns.map((r) => {
              const lineValue = r.orderItem ? Number(r.orderItem.priceAtPurchase) * r.orderItem.quantity : 0;
              const canRefund = ['APPROVED', 'RECEIVED', 'REQUESTED'].includes(r.status) && r.refundStatus !== 'COMPLETED';
              return (
                <Card key={r.id} className="p-4">
                  <div className="flex flex-wrap items-center gap-4">
                    <img src={r.orderItem?.product?.images?.[0] || '/placeholder.png'} alt="" className="h-14 w-14 rounded object-cover bg-canvas shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-ink-900 truncate">{r.orderItem?.product?.name ?? 'Item'}</p>
                      <p className="text-xs text-ink-700">{r.reason.replace(/_/g, ' ')} · {r.customer?.email ?? '—'} · {r.vendor?.shopName ?? '—'}</p>
                      {r.description && <p className="text-xs text-ink-500 mt-1 line-clamp-2">{r.description}</p>}
                      <p className="text-xs text-ink-500 mt-1">Order #{r.order?.id.slice(0, 8).toUpperCase()} · {r.order?.razorpayPaymentId ? 'Prepaid' : 'COD/manual'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{formatPrice(lineValue, code)}</p>
                      <StatusPill tone={rtone(r.status)}>{r.status}</StatusPill>
                    </div>
                    {canRefund && (
                      <button disabled={busy === r.id} onClick={() => refund(r)} className="btn-primary !px-4 !py-2 text-xs disabled:opacity-50">Issue refund</button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )
      ) : (
        disputes.length === 0 ? <Card className="p-10 text-center text-ink-700">No disputes.</Card> : (
          <div className="space-y-3">
            {disputes.map((d) => (
              <Card key={d.id} className="p-4">
                <div className="flex flex-wrap items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-ink-900">{d.subject}</p>
                      <StatusPill tone={rtone(d.status)}>{d.status}</StatusPill>
                    </div>
                    {d.detail && <p className="text-sm text-ink-700 mt-1">{d.detail}</p>}
                    <p className="text-xs text-ink-500 mt-1">{d.raisedBy?.email ?? '—'} · {d.returnRequest?.orderItem?.product?.name ?? ''} · {new Date(d.createdAt).toLocaleDateString('en-IN')}</p>
                  </div>
                  {!['RESOLVED', 'REJECTED'].includes(d.status) && (
                    <div className="flex gap-2">
                      <button disabled={busy === d.id} onClick={() => resolveDispute(d.id, 'RESOLVED')} className="btn-primary !px-3 !py-2 text-xs disabled:opacity-50">Resolve</button>
                      <button disabled={busy === d.id} onClick={() => resolveDispute(d.id, 'REJECTED')} className="btn-secondary !px-3 !py-2 text-xs disabled:opacity-50">Reject</button>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )
      )}
    </div>
  );
}
