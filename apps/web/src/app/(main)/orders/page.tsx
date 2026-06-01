'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useCurrency, formatPrice } from '@/lib/currency';

interface OrderItem {
  id: string;
  quantity: number;
  priceAtPurchase: string;
  status: string;
  shippingCarrier: string | null;
  shippingService: string | null;
  trackingNumber: string | null;
  product: { name: string; images: string[] };
  vendor: { shopName: string };
}

interface Order {
  id: string;
  totalAmount: string;
  shippingTotal: string | null;
  status: string;
  createdAt: string;
  items: OrderItem[];
}

const STATUS_TONE: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  PAID: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  SHIPPED: 'bg-blue-50 text-blue-700 border-blue-200',
  DELIVERED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CANCELLED: 'bg-red-50 text-red-700 border-red-200',
  REFUNDED: 'bg-stone-100 text-stone-700 border-stone-200',
};

function StatusPill({ status }: { status: string }) {
  const tone = STATUS_TONE[status] || 'bg-stone-100 text-stone-700 border-stone-200';
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full border ${tone}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {status}
    </span>
  );
}

export default function OrdersPage() {
  const router = useRouter();
  const { code } = useCurrency();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = typeof window !== 'undefined' ? window.localStorage.getItem('token') : null;
    if (!t) { router.replace('/login?next=/orders'); return; }
    api<Order[]>('/api/orders/me', { silent: true })
      .then((d) => { setOrders(d); setLoading(false); })
      .catch(() => { router.replace('/login?next=/orders'); });
  }, [router]);

  if (loading) {
    return (
      <div className="max-w-container mx-auto px-6 py-10">
        <div className="h-8 w-40 bg-stone-100 rounded animate-pulse mb-6" />
        <div className="space-y-4">
          {[0, 1].map((i) => <div key={i} className="h-32 bg-stone-100 rounded-md animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="max-w-container mx-auto px-6 py-16 text-center">
        <div className="inline-flex w-16 h-16 rounded-full bg-brand-50 text-brand-600 items-center justify-center mb-4">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
        </div>
        <h1 className="font-display text-2xl text-ink-900">No orders yet</h1>
        <p className="text-sm text-ink-500 mt-1.5">When you place your first order, it'll show up here.</p>
        <Link href="/products" className="btn-primary inline-block mt-6">Start shopping</Link>
      </div>
    );
  }

  return (
    <div className="max-w-container mx-auto px-6 py-10">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-ink-900">My orders</h1>
          <p className="text-sm text-ink-500 mt-1">{orders.length} order{orders.length === 1 ? '' : 's'}</p>
        </div>
      </div>

      <div className="space-y-4">
        {orders.map((o) => {
          const itemCount = o.items.reduce((n, i) => n + i.quantity, 0);
          const previewImgs = o.items.slice(0, 4).map((it) => it.product.images?.[0]).filter(Boolean) as string[];
          const extraCount = Math.max(0, o.items.length - previewImgs.length);

          return (
            <div key={o.id} className="bg-surface border border-line rounded-md shadow-card overflow-hidden hover:shadow-card-hover transition">
              {/* Header strip */}
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3 bg-canvas border-b border-line text-xs">
                <div>
                  <p className="text-ink-500 uppercase tracking-wide">Order placed</p>
                  <p className="text-ink-900 font-medium">{new Date(o.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                </div>
                <div>
                  <p className="text-ink-500 uppercase tracking-wide">Total</p>
                  <p className="text-ink-900 font-medium">{formatPrice(o.totalAmount, code)}</p>
                </div>
                <div className="hidden sm:block">
                  <p className="text-ink-500 uppercase tracking-wide">Order #</p>
                  <p className="text-ink-700 font-mono">{o.id.slice(0, 8).toUpperCase()}</p>
                </div>
                <div className="ml-auto"><StatusPill status={o.status} /></div>
              </div>

              {/* Body */}
              <div className="p-5 flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex -space-x-2">
                  {previewImgs.map((src, idx) => (
                    <img key={idx} src={src} alt="" className="w-14 h-14 rounded-md object-cover border-2 border-surface bg-stone-100" />
                  ))}
                  {extraCount > 0 && (
                    <div className="w-14 h-14 rounded-md bg-stone-100 border-2 border-surface text-xs font-semibold text-ink-700 flex items-center justify-center">
                      +{extraCount}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm text-ink-900 truncate">
                    {o.items[0].product.name}
                    {o.items.length > 1 && <span className="text-ink-500"> + {o.items.length - 1} more</span>}
                  </p>
                  <p className="text-xs text-ink-500 mt-0.5">
                    {itemCount} item{itemCount === 1 ? '' : 's'} · from {o.items[0].vendor.shopName}
                    {o.shippingTotal && Number(o.shippingTotal) > 0 && (
                      <> · incl. {formatPrice(o.shippingTotal, code)} shipping</>
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Link href={`/orders/${o.id}`} className="btn-secondary !py-2 !px-4 text-sm">View details</Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
