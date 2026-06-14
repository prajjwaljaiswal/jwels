'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { PageHeader, KpiCard, StatusPill, Card } from '@/components/dashboard/DashboardShell';
import { useCurrency, formatPrice } from '@/lib/currency';

interface Vendor { id: string; shopName: string; status: string; createdAt: string; user: { name: string; email: string }; }
interface PayoutRow { vendorId: string; shopName: string; payable: number; }
interface Analytics {
  gmv: number; orderCount: number; aov: number; commissionEarned: number;
  conversion: number; refundRate: number; newVendors: number; newCustomers: number;
  topVendors: { vendorId: string; shopName: string; revenue: number }[];
}

export default function AdminOverview() {
  const { code } = useCurrency();
  const [pending, setPending] = useState<Vendor[]>([]);
  const [approved, setApproved] = useState<Vendor[]>([]);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api<Vendor[]>('/api/admin/vendors?status=PENDING').catch(() => []),
      api<Vendor[]>('/api/admin/vendors?status=APPROVED').catch(() => []),
      api<{ vendors: PayoutRow[] }>('/api/admin/payouts').catch(() => ({ vendors: [] as PayoutRow[] })),
      api<Analytics>('/api/admin/analytics?days=30').catch(() => null),
    ]).then(([p, a, payoutRes, an]) => {
      setPending(p);
      setApproved(a);
      setPayouts(payoutRes.vendors || []);
      setAnalytics(an);
      setLoading(false);
    });
  }, []);

  async function setStatus(id: string, status: 'APPROVED' | 'REJECTED') {
    await api(`/api/admin/vendors/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
    toast.success(`Vendor ${status.toLowerCase()}`);
    setPending((arr) => arr.filter((v) => v.id !== id));
  }

  const totalPayable = payouts.reduce((s, p) => s + p.payable, 0);
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

  return (
    <div>
      <PageHeader
        title="Operations overview"
        subtitle="Marketplace health at a glance — review pending shops, payouts, and recent activity."
      />

      {loading ? (
        <div className="grid md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 bg-surface border border-line rounded-md animate-pulse" />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <KpiCard label="Pending approvals" value={pending.length} hint="Vendors awaiting review" accent="warn" />
            <KpiCard label="Active vendors" value={approved.length} hint="Approved shops" accent="success" />
            <KpiCard label="Payouts due" value={formatPrice(totalPayable, code)} hint={`${payouts.length} vendors`} accent="brand" />
            <KpiCard label="GMV (30d)" value={analytics ? formatPrice(analytics.gmv, code) : '—'} hint={analytics ? `${analytics.orderCount} paid orders` : '—'} accent="brand" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <KpiCard label="Commission earned (30d)" value={analytics ? formatPrice(analytics.commissionEarned, code) : '—'} hint="Platform revenue" accent="success" />
            <KpiCard label="Avg order value" value={analytics ? formatPrice(analytics.aov, code) : '—'} hint="Per paid order" />
            <KpiCard label="Refund rate (30d)" value={analytics ? pct(analytics.refundRate) : '—'} hint="Refunded vs paid" accent={analytics && analytics.refundRate > 0.1 ? 'warn' : undefined} />
            <KpiCard label="New customers (30d)" value={analytics ? analytics.newCustomers : '—'} hint={analytics ? `${analytics.newVendors} new vendors` : '—'} />
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Pending approvals */}
            <Card className="lg:col-span-2 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-line">
                <h2 className="font-semibold text-ink-900">Vendors awaiting approval</h2>
                <Link href="/vendors" className="text-sm text-brand-700 hover:underline">See all</Link>
              </div>
              {pending.length === 0 ? (
                <div className="p-8 text-center text-ink-700">All clear — no pending approvals.</div>
              ) : (
                <ul className="divide-y divide-line">
                  {pending.slice(0, 5).map((v) => (
                    <li key={v.id} className="px-5 py-4 flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-brand-50 text-brand-700 font-bold flex items-center justify-center">
                        {v.shopName[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-ink-900 truncate">{v.shopName}</p>
                        <p className="text-xs text-ink-500 truncate">{v.user.name} · {v.user.email}</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setStatus(v.id, 'REJECTED')} className="text-xs px-3 py-1.5 rounded-pill border border-line text-ink-700 hover:border-ink-900">Reject</button>
                        <button onClick={() => setStatus(v.id, 'APPROVED')} className="text-xs px-3 py-1.5 rounded-pill bg-brand-600 text-white hover:bg-brand-700">Approve</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {/* Top payouts */}
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-line">
                <h2 className="font-semibold text-ink-900">Payouts due</h2>
                <Link href="/payouts" className="text-sm text-brand-700 hover:underline">View →</Link>
              </div>
              {payouts.length === 0 ? (
                <div className="p-8 text-center text-ink-700 text-sm">Nothing to pay out yet.</div>
              ) : (
                <ul className="divide-y divide-line">
                  {payouts.slice(0, 5).map((p) => (
                    <li key={p.vendorId} className="px-5 py-3 flex items-center justify-between gap-3">
                      <span className="text-sm text-ink-900 truncate">{p.shopName}</span>
                      <span className="text-sm font-semibold text-ink-900 shrink-0">
                        {formatPrice(p.payable, code)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
