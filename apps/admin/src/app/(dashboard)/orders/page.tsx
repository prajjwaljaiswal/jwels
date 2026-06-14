'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { PageHeader, Card, StatusPill } from '@/components/dashboard/DashboardShell';
import { useCurrency, formatPrice } from '@/lib/currency';

interface AdminOrder {
  id: string;
  status: string;
  totalAmount: string;
  createdAt: string;
  customer: { name: string; email: string } | null;
  items: { id: string; quantity: number; vendor: { shopName: string } | null }[];
}

const TABS = ['ALL', 'PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'REFUNDED', 'CANCELLED'] as const;

function tone(s: string): 'success' | 'warn' | 'danger' | 'neutral' | 'info' {
  if (s === 'DELIVERED' || s === 'PAID') return 'success';
  if (s === 'SHIPPED') return 'info';
  if (s === 'PENDING') return 'warn';
  if (s === 'REFUNDED' || s === 'CANCELLED') return 'danger';
  return 'neutral';
}

export default function AdminOrdersPage() {
  const { code } = useCurrency();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [filter, setFilter] = useState<typeof TABS[number]>('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (filter !== 'ALL') qs.set('status', filter);
      if (search.trim()) qs.set('search', search.trim());
      const data = await api<{ orders: AdminOrder[] }>(`/api/admin/orders?${qs.toString()}`);
      setOrders(data.orders || []);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  return (
    <div>
      <PageHeader title="Orders" subtitle="Every order across the marketplace. Search by order id or customer email." />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <form onSubmit={(e) => { e.preventDefault(); load(); }} className="flex gap-2">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Order id or email…"
            className="px-3 py-2 rounded-md border border-line text-sm bg-surface w-64" />
          <button className="btn-secondary !px-4 !py-2 text-xs">Search</button>
        </form>
      </div>

      <div className="border-b border-line mb-6">
        <div className="flex gap-5 overflow-x-auto no-scrollbar">
          {TABS.map((t) => {
            const active = t === filter;
            return (
              <button key={t} onClick={() => setFilter(t)}
                className={`relative py-3 text-sm whitespace-nowrap ${active ? 'text-ink-900 font-semibold' : 'text-ink-700 hover:text-ink-900'}`}>
                {t.charAt(0) + t.slice(1).toLowerCase()}
                {active && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-brand-600 rounded-full" />}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 bg-surface border border-line rounded-md animate-pulse" />)}</div>
      ) : orders.length === 0 ? (
        <Card className="p-10 text-center text-ink-700">No orders found.</Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line">
            {orders.map((o) => (
              <li key={o.id}>
                <Link href={`/orders/${o.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-canvas/50">
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-sm text-ink-900">#{o.id.slice(0, 8).toUpperCase()}</p>
                    <p className="text-xs text-ink-500 truncate">
                      {o.customer?.name ?? '—'} · {o.customer?.email ?? '—'} · {o.items.length} item(s)
                      {o.items[0]?.vendor && ` · ${o.items[0].vendor.shopName}`}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-ink-900">{formatPrice(Number(o.totalAmount), code)}</span>
                  <StatusPill tone={tone(o.status)}>{o.status}</StatusPill>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
