'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
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
  shippingCost: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  product: { id: string; name: string; images: string[] };
  vendor: { id?: string; shopName: string };
}

interface ShippingAddress {
  name: string; line1: string; line2?: string;
  city: string; state: string; pincode: string; phone: string;
}

interface Order {
  id: string;
  totalAmount: string;
  shippingTotal: string | null;
  status: string;
  paymentMethod: string;
  razorpayPaymentId: string | null;
  shippingAddress: ShippingAddress;
  createdAt: string;
  items: OrderItem[];
}

interface TrackingEvent { status: string; description?: string; location?: string; timestamp: string }
interface TrackResponse { awb: string | null; carrier: string | null; trackingUrl: string | null; events: TrackingEvent[] }

const TIMELINE: { key: string; label: string }[] = [
  { key: 'PENDING',   label: 'Placed' },
  { key: 'PAID',      label: 'Confirmed' },
  { key: 'SHIPPED',   label: 'Shipped' },
  { key: 'DELIVERED', label: 'Delivered' },
];

export default function VendorOrderDetailPage() {
  const router = useRouter();
  const { code } = useCurrency();
  const params = useParams<{ vendorId: string; id: string }>();
  const id = params?.id;
  const { vendor, theme, storeKey } = useVendor();

  const [order, setOrder]       = useState<Order | null>(null);
  const [loading, setLoading]   = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [openTrack, setOpenTrack] = useState<string | null>(null);
  const [trackData, setTrackData] = useState<Record<string, TrackResponse | 'loading' | 'error'>>({});

  useEffect(() => {
    if (!id) return;
    const t = typeof window !== 'undefined' ? window.localStorage.getItem('token') : null;
    const next = `/${storeKey}/orders/${id}`;
    if (!t) { router.replace(`/login?next=${encodeURIComponent(next)}`); return; }
    api<Order>(`/api/orders/me/${id}`, { silent: true })
      .then((o) => { setOrder(o); setLoading(false); })
      .catch(() => { setNotFound(true); setLoading(false); });
  }, [id, router, vendor.id]);

  // Project order down to only items belonging to this vendor.
  const scoped = useMemo(() => {
    if (!order) return null;
    const items = order.items.filter((it) => it.vendorId === vendor.id || it.vendor?.id === vendor.id);
    if (items.length === 0) return null;
    const goodsTotal = items.reduce((n, it) => n + Number(it.priceAtPurchase) * it.quantity, 0);
    const shipping  = items.reduce((n, it) => n + Number(it.shippingCost || 0), 0);
    const statuses  = Array.from(new Set(items.map((it) => it.status)));
    const status    = statuses.length === 1 ? statuses[0] : order.status;
    return { items, goodsTotal, shipping, status };
  }, [order, vendor.id]);

  async function toggleTrack(itemId: string) {
    if (openTrack === itemId) { setOpenTrack(null); return; }
    setOpenTrack(itemId);
    if (trackData[itemId] && trackData[itemId] !== 'error') return;
    setTrackData((p) => ({ ...p, [itemId]: 'loading' }));
    try {
      const r = await api<TrackResponse>(`/api/shipping/orders/items/${itemId}/track`, { silent: true });
      setTrackData((p) => ({ ...p, [itemId]: r }));
    } catch {
      setTrackData((p) => ({ ...p, [itemId]: 'error' }));
    }
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="h-8 w-48 rounded animate-pulse bg-canvas mb-6" />
        <div className="h-64 rounded-md animate-pulse bg-surface border border-line" />
      </div>
    );
  }

  if (notFound || !order || !scoped) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-16 text-center">
        <h1 className="text-2xl text-ink-900">Order not found</h1>
        <p className="text-sm text-ink-500 mt-1.5">We couldn't find that order from {vendor.shopName}.</p>
        <Link href={`/${storeKey}/orders`}
          className="inline-block mt-6 px-5 py-2.5 rounded-pill text-white font-semibold hover:opacity-90"
          style={{ background: theme }}
        >
          Back to my orders
        </Link>
      </div>
    );
  }

  const addr = order.shippingAddress;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <nav className="text-xs mb-3">
        <Link href={`/${storeKey}`} className="hover:opacity-70" style={{ color: theme }}>{vendor.shopName}</Link>
        <span className="mx-1.5 text-ink-500">/</span>
        <Link href={`/${storeKey}/orders`} className="text-ink-500 hover:text-ink-900">My orders</Link>
        <span className="mx-1.5 text-ink-500">/</span>
        <span className="text-ink-900">#{order.id.slice(0, 8).toUpperCase()}</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl text-ink-900">Order details</h1>
          <p className="text-sm text-ink-500 mt-1">
            Placed on {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
            <span className="mx-2">·</span>
            <span className="font-mono">#{order.id.slice(0, 8).toUpperCase()}</span>
          </p>
        </div>
        <ThemedStatusPill status={scoped.status} accent={theme} />
      </div>

      <div className="bg-surface border border-line rounded-md shadow-card p-6 mb-6">
        <Timeline status={scoped.status} accent={theme} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-surface border border-line rounded-md shadow-card">
            <div className="px-5 py-3 border-b border-line">
              <h2 className="text-sm font-semibold text-ink-900">
                Items from {vendor.shopName} ({scoped.items.length})
              </h2>
            </div>
            <ul className="divide-y divide-line">
              {scoped.items.map((it) => {
                const trk = trackData[it.id];
                const productHref = `/${storeKey}/products/${(it.product as any).slug || it.product.id}`;
                return (
                  <li key={it.id} className="p-5">
                    <div className="flex gap-4">
                      <Link href={productHref} className="shrink-0">
                        {it.product.images?.[0]
                          ? <img src={it.product.images[0]} alt="" className="w-20 h-20 rounded-md object-cover bg-canvas" />
                          : <div className="w-20 h-20 rounded-md bg-canvas" />}
                      </Link>
                      <div className="flex-1 min-w-0">
                        <Link href={productHref} className="text-sm font-medium text-ink-900 hover:underline line-clamp-2" style={{ textDecorationColor: theme }}>
                          {it.product.name}
                        </Link>
                        <p className="text-xs text-ink-500 mt-0.5">Qty {it.quantity} · {formatPrice(it.priceAtPurchase, code)} each</p>
                        {it.shippingCarrier && (
                          <p className="text-xs text-ink-500 mt-1.5">
                            <span className="text-ink-700 font-medium">Shipping:</span> {it.shippingCarrier}
                            {it.shippingService ? ` · ${it.shippingService}` : ''}
                            {it.trackingNumber ? ` · AWB ${it.trackingNumber}` : ''}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-ink-900">{formatPrice(Number(it.priceAtPurchase) * it.quantity, code)}</p>
                        <div className="mt-1.5"><ThemedStatusPill status={it.status} accent={theme} /></div>
                      </div>
                    </div>

                    {it.trackingNumber && (
                      <div className="mt-3 flex gap-3 text-xs">
                        <button onClick={() => toggleTrack(it.id)} className="hover:underline font-medium" style={{ color: theme }}>
                          {openTrack === it.id ? 'Hide tracking' : 'Track shipment'}
                        </button>
                        {it.trackingUrl && (
                          <a href={it.trackingUrl} target="_blank" rel="noreferrer" className="hover:underline font-medium" style={{ color: theme }}>
                            Open carrier page ↗
                          </a>
                        )}
                      </div>
                    )}

                    {openTrack === it.id && (
                      <div className="mt-3 ml-24 pl-4 border-l-2 border-line">
                        {trk === 'loading' && <p className="text-xs text-ink-500">Loading tracking…</p>}
                        {trk === 'error'   && <p className="text-xs" style={{ color: '#dc2626' }}>Failed to load tracking</p>}
                        {trk && trk !== 'loading' && trk !== 'error' && (
                          trk.events.length === 0 ? (
                            <p className="text-xs text-ink-500">No tracking events yet — check back soon.</p>
                          ) : (
                            <ol className="space-y-2">
                              {trk.events.map((ev, idx) => (
                                <li key={idx} className="text-xs">
                                  <p className="font-semibold text-ink-900">{ev.status}</p>
                                  {ev.description && <p className="text-ink-700">{ev.description}</p>}
                                  <p className="text-ink-500">
                                    {ev.location ? `${ev.location} · ` : ''}
                                    {new Date(ev.timestamp).toLocaleString('en-IN')}
                                  </p>
                                </li>
                              ))}
                            </ol>
                          )
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="bg-surface border border-line rounded-md shadow-card p-5">
            <h2 className="text-sm font-semibold text-ink-900 mb-3">Summary</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-ink-700">Items</dt><dd className="text-ink-900">{formatPrice(scoped.goodsTotal, code)}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-700">Shipping</dt><dd className="text-ink-900">{scoped.shipping > 0 ? formatPrice(scoped.shipping, code) : 'Free'}</dd></div>
              <div className="border-t border-line pt-2 mt-2 flex justify-between font-semibold">
                <dt className="text-ink-900">From this shop</dt>
                <dd className="text-ink-900">{formatPrice(scoped.goodsTotal + scoped.shipping, code)}</dd>
              </div>
              {scoped.items.length !== order.items.length && (
                <p className="text-[11px] text-ink-500 pt-1">
                  Your full order total (incl. items from other shops) was {formatPrice(order.totalAmount, code)}.
                </p>
              )}
            </dl>
          </div>

          <div className="bg-surface border border-line rounded-md shadow-card p-5">
            <h2 className="text-sm font-semibold text-ink-900 mb-3">Shipping to</h2>
            <address className="not-italic text-sm text-ink-700 leading-relaxed">
              <p className="text-ink-900 font-medium">{addr.name}</p>
              <p>{addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}</p>
              <p>{addr.city}, {addr.state} {addr.pincode}</p>
              <p className="text-ink-500 mt-1">📞 {addr.phone}</p>
            </address>
          </div>

          <div className="bg-surface border border-line rounded-md shadow-card p-5">
            <h2 className="text-sm font-semibold text-ink-900 mb-3">Payment</h2>
            <p className="text-sm text-ink-700">{order.paymentMethod}</p>
            {order.razorpayPaymentId && (
              <p className="text-xs text-ink-500 mt-1 font-mono break-all">{order.razorpayPaymentId}</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Timeline({ status, accent }: { status: string; accent: string }) {
  if (status === 'CANCELLED' || status === 'REFUNDED') {
    return <p className="text-sm" style={{ color: '#dc2626' }}>Order {status.toLowerCase()}.</p>;
  }
  const idx = TIMELINE.findIndex((t) => t.key === status);
  const activeIdx = idx === -1 ? 0 : idx;
  return (
    <ol className="flex items-center w-full">
      {TIMELINE.map((step, i) => {
        const done = i <= activeIdx;
        const isLast = i === TIMELINE.length - 1;
        return (
          <li key={step.key} className={`flex items-center ${isLast ? '' : 'flex-1'}`}>
            <div className="flex flex-col items-center">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold"
                style={done ? { background: accent, color: '#fff' } : { background: 'var(--store-bg)', color: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,0,0,0.1)' }}
              >
                {done ? '✓' : i + 1}
              </div>
              <span className="mt-1.5 text-[11px] font-medium" style={{ color: done ? 'var(--store-text)' : 'rgba(0,0,0,0.5)' }}>
                {step.label}
              </span>
            </div>
            {!isLast && (
              <div className="flex-1 h-0.5 mx-2" style={{ background: i < activeIdx ? accent : 'rgba(0,0,0,0.1)' }} />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function ThemedStatusPill({ status, accent }: { status: string; accent: string }) {
  const ok   = ['PAID', 'DELIVERED'].includes(status);
  const bad  = ['CANCELLED', 'REFUNDED'].includes(status);
  const warn = status === 'PENDING';
  const tint =
    ok   ? { bg: '#ecfdf5', fg: '#047857', bd: '#a7f3d0' }
    : bad  ? { bg: '#fef2f2', fg: '#b91c1c', bd: '#fecaca' }
    : warn ? { bg: '#fffbeb', fg: '#b45309', bd: '#fde68a' }
    : { bg: `${accent}10`, fg: accent, bd: `${accent}40` };
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full border"
      style={{ background: tint.bg, color: tint.fg, borderColor: tint.bd }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: tint.fg, opacity: 0.7 }} />
      {status}
    </span>
  );
}
