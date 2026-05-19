'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { PageHeader, Card, StatusPill } from '@/components/dashboard/DashboardShell';
import { useCurrency, formatPrice } from '@/lib/currency';

export interface OrderItem {
  id: string;
  quantity: number;
  priceAtPurchase: string;
  status: string;
  shippingMethodId: string | null;
  shippingCarrier: string | null;
  shippingService: string | null;
  shippingCost: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  labelUrl: string | null;
  waybillUrl: string | null;
  dispatchedAt: string | null;
  deliveredAt: string | null;
  product: { name: string; images: string[] };
  order: {
    id: string;
    createdAt: string;
    paymentMethod: string;
    shippingAddress: any;
    customer: { name: string; email: string; phone: string | null };
  };
}

const TABS = [
  { id: 'TO_SHIP',   label: 'To ship' },
  { id: 'SHIPPED',   label: 'Shipped' },
  { id: 'DELIVERED', label: 'Delivered' },
  { id: 'CANCELLED', label: 'Cancelled' },
] as const;

function statusTone(s: string): 'success' | 'info' | 'danger' | 'warn' {
  if (s === 'DELIVERED') return 'success';
  if (s === 'SHIPPED')   return 'info';
  if (s === 'CANCELLED') return 'danger';
  return 'warn';
}

function statusLabel(s: string) {
  return s === 'PENDING' ? 'COD PENDING' : s;
}

export default function VendorOrdersPage() {
  const { code } = useCurrency();
  const [items, setItems]     = useState<OrderItem[]>([]);
  const [tab, setTab]         = useState<typeof TABS[number]['id']>('TO_SHIP');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<OrderItem[]>('/api/vendors/me/orders')
      .then(setItems)
      .finally(() => setLoading(false));
  }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = { TO_SHIP: 0, SHIPPED: 0, DELIVERED: 0, CANCELLED: 0 };
    items.forEach((i) => {
      if (i.status === 'PAID' || i.status === 'PENDING') c.TO_SHIP += 1;
      else if (c[i.status] !== undefined) c[i.status] += 1;
    });
    return c;
  }, [items]);

  const visible = tab === 'TO_SHIP'
    ? items.filter((i) => i.status === 'PAID' || i.status === 'PENDING')
    : items.filter((i) => i.status === tab);

  return (
    <div>
      <PageHeader title="Orders" subtitle="Manage fulfillment for items sold by your shop." />

      {/* Tabs */}
      <div className="border-b border-line mb-6">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
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
                <span>{t.label}</span>
                <span className={`ml-2 text-[11px] px-1.5 py-0.5 rounded-pill ${active ? 'bg-brand-50 text-brand-700' : 'bg-canvas text-ink-700'}`}>
                  {counts[t.id] || 0}
                </span>
                {active && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-brand-600 rounded-full" />}
                <span className="mx-3" />
              </button>
            );
          })}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 bg-surface border border-line rounded-md animate-pulse" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-ink-700">No {TABS.find((t) => t.id === tab)?.label.toLowerCase()} orders right now.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {visible.map((it) => {
            const addr = it.order.shippingAddress;
            return (
              <Link key={it.id} href={`/orders/${it.id}`}>
                <Card className="p-4 flex gap-4 items-center hover:border-brand-300 transition-colors cursor-pointer">
                  <div className="h-20 w-20 rounded-md bg-canvas overflow-hidden shrink-0">
                    {it.product.images[0] && (
                      <img src={it.product.images[0]} alt="" className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-ink-900 truncate">{it.product.name}</p>
                      {it.order.paymentMethod === 'COD' && (
                        <span className="text-[10px] font-bold uppercase tracking-wide bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full shrink-0">COD</span>
                      )}
                    </div>
                    <p className="text-sm text-ink-700">Qty {it.quantity} · {formatPrice(it.priceAtPurchase, code)}</p>
                    <p className="text-xs text-ink-500 mt-1">
                      {it.order.customer.name} · {it.order.customer.phone || it.order.customer.email}
                    </p>
                    {addr && (
                      <p className="text-xs text-ink-500 truncate">{addr.line1}, {addr.city} – {addr.pincode}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <StatusPill tone={statusTone(it.status)}>{statusLabel(it.status)}</StatusPill>
                    <span className="text-xs text-brand-700">View details →</span>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
