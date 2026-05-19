'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { PageHeader, Card, KpiCard } from '@/components/dashboard/DashboardShell';
import { useCurrency, formatPrice } from '@/lib/currency';

interface Analytics {
  days: number;
  totalRevenue: number;
  totalOrders: number;
  totalUnits: number;
  avgOrderValue: number;
  series: { dateISO: string; revenue: number; orders: number; units: number }[];
  topProducts: { id: string; name: string; image: string | null; revenue: number; units: number }[];
}

const RANGES = [
  { days: 7,  label: '7d' },
  { days: 30, label: '30d' },
  { days: 90, label: '90d' },
] as const;

export default function VendorAnalyticsPage() {
  const { code } = useCurrency();
  const fmt = (n: number) => formatPrice(Math.round(n), code);
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api<Analytics>(`/api/vendors/me/analytics?days=${days}`)
      .then(setData)
      .finally(() => setLoading(false));
  }, [days]);

  return (
    <div>
      <PageHeader
        title="Analytics"
        subtitle="Revenue, orders, and top-selling products across your shop."
        actions={
          <div className="inline-flex items-center bg-canvas border border-line rounded-pill p-0.5">
            {RANGES.map((r) => {
              const active = r.days === days;
              return (
                <button key={r.days} onClick={() => setDays(r.days as 7 | 30 | 90)}
                  className={`h-8 px-3.5 rounded-pill text-sm font-semibold transition ${active ? 'bg-surface text-ink-900 shadow-card' : 'text-ink-700 hover:text-ink-900'}`}>
                  {r.label}
                </button>
              );
            })}
          </div>
        }
      />

      {loading || !data ? (
        <div className="grid md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 bg-surface border border-line rounded-md animate-pulse" />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <KpiCard label="Revenue" value={fmt(data.totalRevenue)} hint={`${data.days} days`} />
            <KpiCard label="Orders" value={data.totalOrders} hint={`${data.totalUnits} units sold`} accent="brand" />
            <KpiCard label="Avg order value" value={fmt(data.avgOrderValue)} hint="Per order" accent="success" />
            <KpiCard label="Daily average" value={fmt(data.totalRevenue / data.days)} hint="Mean per day" accent="warn" />
          </div>

          <Card className="p-5 mb-8">
            <p className="text-xs uppercase tracking-wide font-semibold text-ink-700">Daily revenue</p>
            <RevenueChart series={data.series} />
          </Card>

          <Card className="overflow-hidden">
            <div className="px-5 py-4 border-b border-line">
              <h2 className="font-semibold text-ink-900">Top products</h2>
              <p className="text-xs text-ink-500 mt-0.5">Best sellers by revenue in the selected range.</p>
            </div>
            {data.topProducts.length === 0 ? (
              <div className="p-10 text-center">
                <p className="font-semibold text-ink-900">No sales yet</p>
                <p className="text-sm text-ink-700 mt-1 mb-5">Once buyers start ordering, your top products will appear here.</p>
                <Link href="/products/new" className="btn-primary">Add a listing</Link>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-canvas text-left text-xs uppercase tracking-wide text-ink-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">#</th>
                    <th className="px-5 py-3 font-semibold">Product</th>
                    <th className="px-5 py-3 font-semibold text-right">Units</th>
                    <th className="px-5 py-3 font-semibold text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topProducts.map((p, i) => (
                    <tr key={p.id} className="border-t border-line">
                      <td className="px-5 py-3 text-ink-500 font-mono">{i + 1}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-md bg-canvas overflow-hidden shrink-0">
                            {p.image && <img src={p.image} alt="" className="w-full h-full object-cover" />}
                          </div>
                          <Link href={`/products/${p.id}/edit`} className="font-medium text-ink-900 hover:text-brand-700 line-clamp-1">
                            {p.name}
                          </Link>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right font-mono">{p.units}</td>
                      <td className="px-5 py-3 text-right font-semibold font-mono">{fmt(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function RevenueChart({ series }: { series: Analytics['series'] }) {
    const { code } = useCurrency();
  const fmt = (n: number) => formatPrice(Math.round(n), code);
  const max = Math.max(1, ...series.map((s) => s.revenue));
  // Cap visible x-axis labels so the chart stays readable for 30/90-day ranges.
  const labelEvery = series.length > 30 ? 7 : series.length > 14 ? 3 : 1;
  return (
    <div className="flex items-end gap-1.5 h-48 mt-3">
      {series.map((s, i) => {
        const h = max > 0 ? Math.max(2, (s.revenue / max) * 100) : 2;
        const showLabel = i % labelEvery === 0 || i === series.length - 1;
        return (
          <div key={s.dateISO} className="flex-1 flex flex-col items-center justify-end gap-1.5 group">
            <span className="text-[10px] text-ink-500 opacity-0 group-hover:opacity-100 transition font-mono whitespace-nowrap -mb-1">
              {fmt(s.revenue)}
            </span>
            <span className="block w-full rounded-t bg-brand-600 hover:bg-brand-700 transition" style={{ height: `${h}%` }} />
            <span className="text-[10px] text-ink-500 font-mono" style={{ visibility: showLabel ? 'visible' : 'hidden' }}>
              {s.dateISO.slice(5)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
