'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { PageHeader, Card, StatusPill } from '@/components/dashboard/DashboardShell';
import { useCurrency, formatPrice } from '@/lib/currency';

export interface ShipmentInfo {
  id: string;
  status: string;
  awb: string | null;
  labelUrl: string | null;
  carrierName?: string | null;
}

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
  shipment: ShipmentInfo | null;
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
  { id: 'NEW',        label: 'New' },
  { id: 'PROCESSING', label: 'Processing' },
  { id: 'DISPATCHED', label: 'Dispatched' },
  { id: 'IN_TRANSIT', label: 'In Transit' },
  { id: 'DELIVERED',  label: 'Delivered' },
  { id: 'RTO',        label: 'RTO' },
  { id: 'CANCELLED',  label: 'Cancelled' },
] as const;

type TabId = typeof TABS[number]['id'];

function tabFor(item: OrderItem): TabId {
  if (item.status === 'CANCELLED') return 'CANCELLED';
  const ss = item.shipment?.status;
  if (!ss) return 'NEW';
  if (ss === 'LABEL_GENERATED') return 'PROCESSING';
  if (['MANIFEST_GENERATED', 'PICKUP_SCHEDULED', 'PICKED_UP'].includes(ss)) return 'DISPATCHED';
  if (['IN_TRANSIT', 'OUT_FOR_DELIVERY'].includes(ss)) return 'IN_TRANSIT';
  if (['DELIVERED', 'COMPLETED'].includes(ss)) return 'DELIVERED';
  if (['RTO_INITIATED', 'RTO_DELIVERED'].includes(ss)) return 'RTO';
  return 'NEW';
}

function statusTone(item: OrderItem): 'success' | 'info' | 'danger' | 'warn' | 'neutral' {
  const ss = item.shipment?.status;
  if (item.status === 'CANCELLED') return 'danger';
  if (!ss) return 'warn';
  if (['DELIVERED', 'COMPLETED'].includes(ss)) return 'success';
  if (['IN_TRANSIT', 'OUT_FOR_DELIVERY', 'PICKED_UP'].includes(ss)) return 'info';
  if (['RTO_INITIATED', 'RTO_DELIVERED'].includes(ss)) return 'danger';
  return 'warn';
}

function displayStatus(item: OrderItem) {
  const ss = item.shipment?.status;
  if (item.status === 'CANCELLED') return 'CANCELLED';
  if (!ss) return item.status === 'PAID' ? 'NEW ORDER' : item.status;
  return ss.replace(/_/g, ' ');
}

export default function VendorOrdersPage() {
  const { code } = useCurrency();
  const [items, setItems]     = useState<OrderItem[]>([]);
  const [tab, setTab]         = useState<TabId>('NEW');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<OrderItem[]>('/api/vendors/me/orders')
      .then(setItems)
      .finally(() => setLoading(false));
  }, []);

  const counts = useMemo(() => {
    const c: Record<TabId, number> = { NEW: 0, PROCESSING: 0, DISPATCHED: 0, IN_TRANSIT: 0, DELIVERED: 0, RTO: 0, CANCELLED: 0 };
    items.forEach((i) => { c[tabFor(i)] += 1; });
    return c;
  }, [items]);

  const visible = items.filter((i) => tabFor(i) === tab);

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
                {counts[t.id] > 0 && (
                  <span className={`ml-2 text-[11px] px-1.5 py-0.5 rounded-full ${active ? 'bg-brand-50 text-brand-700' : 'bg-canvas text-ink-700'}`}>
                    {counts[t.id]}
                  </span>
                )}
                {active && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-brand-600 rounded-full" />}
                <span className="mx-2" />
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
            const labelUrl = it.shipment?.labelUrl ?? it.labelUrl;
            return (
              <Link key={it.id} href={`/orders/${it.id}`} className="block">
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
                    {it.shipment?.awb && (
                      <p className="text-xs text-ink-500 font-mono mt-0.5">AWB: {it.shipment.awb}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <StatusPill tone={statusTone(it)}>{displayStatus(it)}</StatusPill>
                    {labelUrl ? (
                      <a
                        href={labelUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs font-medium text-brand-700 hover:text-brand-900 hover:underline"
                      >
                        ↓ Download label
                      </a>
                    ) : it.shipment ? (
                      <a
                        href={`/orders/${it.id}/label`}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs font-medium text-brand-700 hover:text-brand-900 hover:underline"
                      >
                        🖨 Print label
                      </a>
                    ) : (
                      <span className="text-xs text-brand-700">View details →</span>
                    )}
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
