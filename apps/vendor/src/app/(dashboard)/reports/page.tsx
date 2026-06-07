'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { PageHeader, Card, KpiCard, StatusPill } from '@/components/dashboard/DashboardShell';
import type { ShipmentWithOrderItem, ShippingReportSummary } from '@/types/fulfillment';

type RangeKey = '7d' | '30d' | '90d';

const RANGES: { key: RangeKey; label: string; days: number }[] = [
  { key: '7d',  label: '7 days',  days: 7 },
  { key: '30d', label: '30 days', days: 30 },
  { key: '90d', label: '90 days', days: 90 },
];

type ReportTab = 'summary' | 'transit' | 'rto';

function statusTone(s: string): 'success' | 'info' | 'warn' | 'danger' {
  if (['DELIVERED', 'COMPLETED'].includes(s)) return 'success';
  if (['IN_TRANSIT', 'OUT_FOR_DELIVERY', 'PICKED_UP'].includes(s)) return 'info';
  if (['RTO_INITIATED', 'RTO_DELIVERED'].includes(s)) return 'danger';
  return 'warn';
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function downloadCsv(url: string, filename: string) {
  const a = document.createElement('a');
  a.href = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}${url}`;
  a.download = filename;
  a.click();
}

export default function ReportsPage() {
  const [tab, setTab]             = useState<ReportTab>('summary');
  const [range, setRange]         = useState<RangeKey>('30d');
  const [summary, setSummary]     = useState<ShippingReportSummary | null>(null);
  const [transitItems, setTransitItems] = useState<ShipmentWithOrderItem[]>([]);
  const [rtoItems, setRtoItems]   = useState<ShipmentWithOrderItem[]>([]);
  const [loading, setLoading]     = useState(true);
  const [transitPage, setTransitPage] = useState(1);
  const [rtoPage, setRtoPage]     = useState(1);
  const [transitTotal, setTransitTotal] = useState(0);
  const [rtoTotal, setRtoTotal]   = useState(0);
  const PAGE_SIZE = 20;

  useEffect(() => {
    const days = RANGES.find((r) => r.key === range)!.days;
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const to   = new Date().toISOString();

    setLoading(true);
    Promise.all([
      api<ShippingReportSummary>(`/api/fulfillment/reports/shipping?from=${from}&to=${to}`),
      api<{ shipments: ShipmentWithOrderItem[]; total: number }>(`/api/fulfillment/reports/transit?page=1&limit=${PAGE_SIZE}`),
      api<{ shipments: ShipmentWithOrderItem[]; total: number }>(`/api/fulfillment/reports/rto?page=1&limit=${PAGE_SIZE}`),
    ]).then(([s, t, r]) => {
      setSummary(s);
      setTransitItems(t.shipments); setTransitTotal(t.total);
      setRtoItems(r.shipments);     setRtoTotal(r.total);
      setTransitPage(1); setRtoPage(1);
    }).finally(() => setLoading(false));
  }, [range]);

  async function loadTransitPage(page: number) {
    const data = await api<{ shipments: ShipmentWithOrderItem[]; total: number }>(
      `/api/fulfillment/reports/transit?page=${page}&limit=${PAGE_SIZE}`,
    );
    setTransitItems(data.shipments);
    setTransitPage(page);
  }

  async function loadRtoPage(page: number) {
    const data = await api<{ shipments: ShipmentWithOrderItem[]; total: number }>(
      `/api/fulfillment/reports/rto?page=${page}&limit=${PAGE_SIZE}`,
    );
    setRtoItems(data.shipments);
    setRtoPage(page);
  }

  const TABS: { id: ReportTab; label: string }[] = [
    { id: 'summary', label: 'Shipping Summary' },
    { id: 'transit', label: 'In Transit' },
    { id: 'rto',     label: 'RTO' },
  ];

  return (
    <div>
      <PageHeader title="Reports" subtitle="Shipping analytics and fulfillment performance." />

      {/* Range selector */}
      <div className="flex gap-2 mb-6">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={[
              'text-sm px-4 py-1.5 rounded-full border transition',
              range === r.key
                ? 'bg-brand-600 text-white border-brand-600'
                : 'border-line text-ink-700 hover:border-brand-400',
            ].join(' ')}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div className="border-b border-line mb-6">
        <div className="flex gap-2">
          {TABS.map((t) => {
            const active = t.id === tab;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={[
                  'relative px-1 py-3 text-sm whitespace-nowrap transition',
                  active ? 'text-ink-900 font-semibold' : 'text-ink-700 hover:text-ink-900',
                ].join(' ')}
              >
                {t.label}
                {active && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-brand-600 rounded-full" />}
                <span className="mx-3" />
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 bg-canvas rounded-md animate-pulse" />)}
        </div>
      ) : (
        <>
          {/* Summary tab */}
          {tab === 'summary' && summary && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <KpiCard label="Total dispatched" value={String(summary.total)} />
                <KpiCard label="In transit now" value={String(summary.inTransit)} accent="brand" />
                <KpiCard label="Delivered" value={String(summary.delivered)} accent="success" />
                <KpiCard label="RTO orders" value={String(summary.rto)} accent="warn" />
                <KpiCard label="Avg transit days" value={`${summary.avgTransitDays}d`} />
                <KpiCard label="Delivery rate" value={`${summary.deliveryRate}%`} accent="success" />
              </div>
            </div>
          )}

          {/* In Transit tab */}
          {tab === 'transit' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-ink-700">{transitTotal} shipment{transitTotal !== 1 ? 's' : ''} in transit</p>
                <button
                  onClick={() => {
                    const token = typeof localStorage !== 'undefined' ? localStorage.getItem(process.env.NEXT_PUBLIC_TOKEN_KEY || 'token') : '';
                    downloadCsv(`/api/fulfillment/reports/transit?format=csv`, 'transit-report.csv');
                  }}
                  className="btn-secondary text-sm !py-1.5 !px-3"
                >
                  Export CSV ↓
                </button>
              </div>
              <ShipmentTable shipments={transitItems} />
              <Pagination
                page={transitPage}
                total={transitTotal}
                pageSize={PAGE_SIZE}
                onPage={loadTransitPage}
              />
            </div>
          )}

          {/* RTO tab */}
          {tab === 'rto' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-ink-700">{rtoTotal} RTO order{rtoTotal !== 1 ? 's' : ''}</p>
                <button
                  onClick={() => downloadCsv(`/api/fulfillment/reports/rto?format=csv`, 'rto-report.csv')}
                  className="btn-secondary text-sm !py-1.5 !px-3"
                >
                  Export CSV ↓
                </button>
              </div>
              <ShipmentTable shipments={rtoItems} />
              <Pagination
                page={rtoPage}
                total={rtoTotal}
                pageSize={PAGE_SIZE}
                onPage={loadRtoPage}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ShipmentTable({ shipments }: { shipments: ShipmentWithOrderItem[] }) {
  if (!shipments.length) {
    return (
      <Card className="p-8 text-center">
        <p className="text-ink-700">No shipments to show.</p>
      </Card>
    );
  }

  function fmtDate(d: string) {
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function statusTone(s: string): 'success' | 'info' | 'warn' | 'danger' {
    if (['DELIVERED', 'COMPLETED'].includes(s)) return 'success';
    if (['IN_TRANSIT', 'OUT_FOR_DELIVERY', 'PICKED_UP'].includes(s)) return 'info';
    if (['RTO_INITIATED', 'RTO_DELIVERED'].includes(s)) return 'danger';
    return 'warn';
  }

  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line">
              <th className="text-left text-xs uppercase tracking-wide text-ink-500 px-5 py-3">AWB</th>
              <th className="text-left text-xs uppercase tracking-wide text-ink-500 px-5 py-3">Carrier</th>
              <th className="text-left text-xs uppercase tracking-wide text-ink-500 px-5 py-3">Customer</th>
              <th className="text-left text-xs uppercase tracking-wide text-ink-500 px-5 py-3">Destination</th>
              <th className="text-left text-xs uppercase tracking-wide text-ink-500 px-5 py-3">Order</th>
              <th className="text-left text-xs uppercase tracking-wide text-ink-500 px-5 py-3">Dispatched</th>
              <th className="text-left text-xs uppercase tracking-wide text-ink-500 px-5 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {shipments.map((s) => {
              const addr = s.orderItem.order.shippingAddress;
              return (
                <tr key={s.id} className="border-t border-line hover:bg-canvas/50">
                  <td className="px-5 py-3 font-mono text-xs">{s.awb ?? '—'}</td>
                  <td className="px-5 py-3">{s.carrierName}</td>
                  <td className="px-5 py-3">{s.orderItem.order.customer.name}</td>
                  <td className="px-5 py-3 text-ink-700">{addr?.city}, {addr?.state}</td>
                  <td className="px-5 py-3 font-mono text-xs">{s.orderItem.order.id.slice(-8).toUpperCase()}</td>
                  <td className="px-5 py-3 text-ink-700">{fmtDate(s.createdAt)}</td>
                  <td className="px-5 py-3">
                    <StatusPill tone={statusTone(s.status)}>{s.status.replace(/_/g, ' ')}</StatusPill>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Pagination({ page, total, pageSize, onPage }: {
  page: number; total: number; pageSize: number; onPage: (p: number) => void;
}) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between text-sm text-ink-700">
      <span>Page {page} of {totalPages} ({total} total)</span>
      <div className="flex gap-2">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className="btn-secondary text-xs !py-1.5 !px-3 disabled:opacity-40"
        >
          ← Prev
        </button>
        <button
          onClick={() => onPage(page + 1)}
          disabled={page >= totalPages}
          className="btn-secondary text-xs !py-1.5 !px-3 disabled:opacity-40"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
