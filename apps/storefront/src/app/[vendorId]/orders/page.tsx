'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useVendor } from '@/lib/vendor-context';
import { useCurrency, formatPrice } from '@/lib/currency';

interface OrderItem {
  id: string;
  vendorId: string;
  quantity: number;
  priceAtPurchase: string;
  status: string;
  shippingCarrier: string | null;
  shippingService: string | null;
  trackingNumber: string | null;
  product: { name: string; images: string[] };
  vendor: { id?: string; shopName: string };
}

interface Order {
  id: string;
  totalAmount: string;
  shippingTotal: string | null;
  status: string;
  createdAt: string;
  items: OrderItem[];
}

export default function VendorOrdersPage() {
  const router = useRouter();
  const { code } = useCurrency();
  const { vendor, theme, basePath } = useVendor();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = typeof window !== 'undefined' ? window.localStorage.getItem('token') : null;
    const next = `${basePath}/orders`;
    if (!t) { router.replace(`/login?next=${encodeURIComponent(next)}`); return; }
    api<Order[]>('/api/orders/me', { silent: true })
      .then((d) => { setOrders(d); setLoading(false); })
      .catch(() => router.replace(`/login?next=${encodeURIComponent(next)}`));
  }, [router, vendor.id]);

  // Filter to orders that contain at least one item from this vendor
  // and project each order down to only this vendor's items.
  const vendorOrders = useMemo(() => {
    return orders
      .map((o) => {
        const items = o.items.filter((it) => it.vendorId === vendor.id || it.vendor?.id === vendor.id);
        if (items.length === 0) return null;
        const itemSubtotal = items.reduce((s, it) => s + Number(it.priceAtPurchase) * it.quantity, 0);
        return { ...o, items, itemSubtotal };
      })
      .filter(Boolean) as (Order & { itemSubtotal: number })[];
  }, [orders, vendor.id]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="h-8 w-40 rounded animate-pulse bg-canvas mb-6" />
        <div className="space-y-4">
          {[0, 1].map((i) => <div key={i} className="h-32 rounded-md animate-pulse bg-surface border border-line" />)}
        </div>
      </div>
    );
  }

  if (vendorOrders.length === 0) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-16 text-center">
        <div
          className="inline-flex w-16 h-16 rounded-full items-center justify-center mb-4 text-white"
          style={{ background: theme }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>
          </svg>
        </div>
        <h1 className="text-2xl text-ink-900">No orders from {vendor.shopName} yet</h1>
        <p className="text-sm text-ink-500 mt-1.5">When you place an order with this shop, it'll show up here.</p>
        <Link href={(basePath || '/')}
          className="inline-block mt-6 px-5 py-2.5 rounded-pill text-white font-semibold hover:opacity-90"
          style={{ background: theme }}
        >
          Continue shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <nav className="text-xs text-ink-500 mb-3">
        <Link href={(basePath || '/')} className="hover:opacity-70" style={{ color: theme }}>{vendor.shopName}</Link>
        <span className="mx-1.5">/</span>
        <span className="text-ink-900">My orders</span>
      </nav>

      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-3xl text-ink-900">My orders</h1>
          <p className="text-sm text-ink-500 mt-1">
            {vendorOrders.length} order{vendorOrders.length === 1 ? '' : 's'} from <span className="font-semibold" style={{ color: theme }}>{vendor.shopName}</span>
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {vendorOrders.map((o) => {
          const itemCount = o.items.reduce((n, i) => n + i.quantity, 0);
          const previewImgs = o.items.slice(0, 4).map((it) => it.product.images?.[0]).filter(Boolean) as string[];
          const extraCount = Math.max(0, o.items.length - previewImgs.length);
          const itemStatuses = Array.from(new Set(o.items.map((it) => it.status)));
          const displayStatus = itemStatuses.length === 1 ? itemStatuses[0] : o.status;

          return (
            <div key={o.id} className="bg-surface border border-line rounded-md shadow-card overflow-hidden hover:shadow-card-hover transition">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3 bg-canvas border-b border-line text-xs">
                <div>
                  <p className="text-ink-500 uppercase tracking-wide">Placed</p>
                  <p className="text-ink-900 font-medium">{new Date(o.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                </div>
                <div>
                  <p className="text-ink-500 uppercase tracking-wide">From this shop</p>
                  <p className="text-ink-900 font-medium">{formatPrice(o.itemSubtotal, code)}</p>
                </div>
                <div className="hidden sm:block">
                  <p className="text-ink-500 uppercase tracking-wide">Order #</p>
                  <p className="text-ink-700 font-mono">{o.id.slice(0, 8).toUpperCase()}</p>
                </div>
                <div className="ml-auto">
                  <ThemedStatusPill status={displayStatus} accent={theme} />
                </div>
              </div>

              <div className="p-5 flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex -space-x-2">
                  {previewImgs.map((src, idx) => (
                    <img key={idx} src={src} alt="" className="w-14 h-14 rounded-md object-cover border-2 border-surface bg-canvas" />
                  ))}
                  {extraCount > 0 && (
                    <div className="w-14 h-14 rounded-md bg-canvas border-2 border-surface text-xs font-semibold text-ink-700 flex items-center justify-center">
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
                    {itemCount} item{itemCount === 1 ? '' : 's'}
                    {o.items.some((it) => it.trackingNumber) && ' · tracking available'}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Link href={`${basePath}/orders/${o.id}`}
                    className="px-4 py-2 rounded-pill border font-semibold text-sm transition-colors hover:bg-canvas"
                    style={{ borderColor: theme, color: theme }}
                  >
                    View details
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ThemedStatusPill({ status, accent }: { status: string; accent: string }) {
  const ok = ['PAID', 'DELIVERED'].includes(status);
  const bad = ['CANCELLED', 'REFUNDED'].includes(status);
  const warn = status === 'PENDING';
  const tint =
    ok   ? { bg: '#ecfdf5', fg: '#047857', bd: '#a7f3d0' }
    : bad  ? { bg: '#fef2f2', fg: '#b91c1c', bd: '#fecaca' }
    : warn ? { bg: '#fffbeb', fg: '#b45309', bd: '#fde68a' }
    : { bg: `${accent}10`, fg: accent, bd: `${accent}40` };
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full border"
      style={{ background: tint.bg, color: tint.fg, borderColor: tint.bd }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: tint.fg, opacity: 0.7 }} />
      {status}
    </span>
  );
}
