'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { PageHeader, Card, KpiCard, StatusPill } from '@/components/dashboard/DashboardShell';
import { useCurrency, formatPrice } from '@/lib/currency';

interface PayoutItem {
  orderItemId: string;
  orderId: string;
  orderCreatedAt: string;
  status: 'PAID' | 'SHIPPED' | 'DELIVERED' | string;
  product: { id: string; name: string; images: string[] };
  quantity: number;
  gross: number;
  commission: number;
  payout: number;
}

interface Settlement {
  id: string;
  periodStart: string;
  periodEnd: string;
  netAmount: string;
  status: string;
  utr: string | null;
  processedAt: string | null;
}

interface Payouts {
  commissionRate: number;
  payable: number;
  settled: number;
  pipeline: number;
  lifetimeGross: number;
  lifetimeCommission: number;
  lifetimePayout: number;
  bank: { accountName: string | null; accountNumber: string | null; ifsc: string | null };
  items: PayoutItem[];
  settlements: Settlement[];
}

export default function VendorPayoutsPage() {
  const [data, setData] = useState<Payouts | null>(null);
  const [loading, setLoading] = useState(true);
  const { code } = useCurrency();
  const fmt = (n: number) => formatPrice(Math.round(n), code);

  useEffect(() => {
    api<Payouts>('/api/vendors/me/payouts')
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-28 bg-surface border border-line rounded-md animate-pulse" />
        ))}
      </div>
    );
  }
  if (!data) return null;

  const hasBank = data.bank.accountNumber;

  return (
    <div>
      <PageHeader
        title="Payouts"
        subtitle={`Earnings are settled weekly to your registered bank account, after our ${(data.commissionRate * 100).toFixed(0)}% platform fee.`}
      />

      {!hasBank && (
        <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 p-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-ink-900">No bank account on file</p>
            <p className="text-sm text-ink-700 mt-0.5">Add your bank details to receive payouts.</p>
          </div>
          <Link href="/settings?tab=bank" className="btn-primary text-sm">Add bank</Link>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <KpiCard
          label="Payable now"
          value={fmt(data.payable)}
          hint="Delivered orders, ready for next payout"
          accent="success"
        />
        <KpiCard
          label="In pipeline"
          value={fmt(data.pipeline)}
          hint="Orders paid or shipped — pays out once delivered"
          accent="warn"
        />
        <KpiCard
          label="Lifetime payout"
          value={fmt(data.lifetimePayout)}
          hint={`${fmt(data.lifetimeGross)} gross · ${fmt(data.lifetimeCommission)} commission`}
          accent="brand"
        />
      </div>

      {hasBank && (
        <Card className="p-5 mb-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide font-semibold text-ink-700 mb-1.5">Settlements go to</p>
              <p className="font-semibold text-ink-900">{data.bank.accountName ?? '—'}</p>
              <p className="text-sm text-ink-700 font-mono mt-0.5">
                {data.bank.accountNumber} · {data.bank.ifsc ?? '—'}
              </p>
            </div>
            <Link href="/settings?tab=bank" className="btn-secondary text-sm">Update</Link>
          </div>
        </Card>
      )}

      {data.settlements && data.settlements.length > 0 && (
        <Card className="overflow-hidden mb-8">
          <div className="px-5 py-4 border-b border-line">
            <h2 className="font-semibold text-ink-900">Settlements</h2>
            <p className="text-xs text-ink-500 mt-0.5">Payout runs created from your delivered orders.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-canvas text-left text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Period</th>
                  <th className="px-5 py-3 font-semibold text-right">Net amount</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">UTR</th>
                  <th className="px-5 py-3 font-semibold">Paid on</th>
                </tr>
              </thead>
              <tbody>
                {data.settlements.map((s) => (
                  <tr key={s.id} className="border-t border-line">
                    <td className="px-5 py-3 text-ink-700 whitespace-nowrap">
                      {new Date(s.periodStart).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – {new Date(s.periodEnd).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </td>
                    <td className="px-5 py-3 text-right font-semibold font-mono">{fmt(Number(s.netAmount))}</td>
                    <td className="px-5 py-3"><StatusPill tone={s.status === 'PAID' ? 'success' : s.status === 'PENDING' ? 'warn' : 'neutral'}>{s.status}</StatusPill></td>
                    <td className="px-5 py-3 font-mono text-xs text-ink-500">{s.utr || '—'}</td>
                    <td className="px-5 py-3 text-ink-700">{s.processedAt ? new Date(s.processedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-line">
          <h2 className="font-semibold text-ink-900">Earning history</h2>
          <p className="text-xs text-ink-500 mt-0.5">Per-item breakdown across paid, shipped, and delivered orders.</p>
        </div>
        {data.items.length === 0 ? (
          <div className="p-10 text-center">
            <p className="font-semibold text-ink-900">No earnings yet</p>
            <p className="text-sm text-ink-700 mt-1 mb-5">
              You'll see earnings here as orders move through paid → shipped → delivered.
            </p>
            <Link href="/products/new" className="btn-primary">Add your first listing</Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-canvas text-left text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Order date</th>
                  <th className="px-5 py-3 font-semibold">Product</th>
                  <th className="px-5 py-3 font-semibold">Qty</th>
                  <th className="px-5 py-3 font-semibold text-right">Gross</th>
                  <th className="px-5 py-3 font-semibold text-right">Commission</th>
                  <th className="px-5 py-3 font-semibold text-right">Payout</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((it) => (
                  <tr key={it.orderItemId} className="border-t border-line">
                    <td className="px-5 py-3 text-ink-700 whitespace-nowrap">
                      {new Date(it.orderCreatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-md bg-canvas overflow-hidden shrink-0">
                          {it.product.images[0] && <img src={it.product.images[0]} alt="" className="w-full h-full object-cover" />}
                        </div>
                        <Link href={`/orders`} className="font-medium text-ink-900 hover:text-brand-700 line-clamp-1">
                          {it.product.name}
                        </Link>
                      </div>
                    </td>
                    <td className="px-5 py-3">{it.quantity}</td>
                    <td className="px-5 py-3 text-right font-mono">{fmt(it.gross)}</td>
                    <td className="px-5 py-3 text-right font-mono text-ink-500">−{fmt(it.commission)}</td>
                    <td className="px-5 py-3 text-right font-semibold font-mono">{fmt(it.payout)}</td>
                    <td className="px-5 py-3">
                      <StatusPill tone={it.status === 'DELIVERED' ? 'success' : it.status === 'SHIPPED' ? 'info' : 'warn'}>
                        {it.status}
                      </StatusPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
