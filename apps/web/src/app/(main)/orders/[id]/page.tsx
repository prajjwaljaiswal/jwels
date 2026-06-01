'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useCurrency, formatPrice } from '@/lib/currency';

interface OrderItem {
  id: string;
  quantity: number;
  priceAtPurchase: string;
  status: string;
  shippingCarrier: string | null;
  shippingService: string | null;
  shippingCost: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  dispatchedAt: string | null;
  deliveredAt: string | null;
  product: { id: string; name: string; images: string[] };
  vendor: { id: string; shopName: string };
}

interface ShippingAddress {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
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

interface TrackingEvent {
  status: string;
  description?: string;
  location?: string;
  timestamp: string;
}

interface TrackResponse {
  awb: string | null;
  carrier: string | null;
  trackingUrl: string | null;
  events: TrackingEvent[];
}

const STATUS_TONE: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  PAID: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  SHIPPED: 'bg-blue-50 text-blue-700 border-blue-200',
  DELIVERED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CANCELLED: 'bg-red-50 text-red-700 border-red-200',
  REFUNDED: 'bg-stone-100 text-stone-700 border-stone-200',
};

const TIMELINE: { key: string; label: string }[] = [
  { key: 'PENDING', label: 'Placed' },
  { key: 'PAID', label: 'Confirmed' },
  { key: 'SHIPPED', label: 'Shipped' },
  { key: 'DELIVERED', label: 'Delivered' },
];

function StatusPill({ status }: { status: string }) {
  const tone = STATUS_TONE[status] || 'bg-stone-100 text-stone-700 border-stone-200';
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full border ${tone}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {status}
    </span>
  );
}

function Timeline({ status }: { status: string }) {
  if (status === 'CANCELLED' || status === 'REFUNDED') {
    return <p className="text-sm text-danger">Order {status.toLowerCase()}.</p>;
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
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${done ? 'bg-brand-600 text-white' : 'bg-stone-100 text-stone-400'}`}>
                {done ? '✓' : i + 1}
              </div>
              <span className={`mt-1.5 text-[11px] font-medium ${done ? 'text-ink-900' : 'text-ink-500'}`}>{step.label}</span>
            </div>
            {!isLast && (
              <div className={`flex-1 h-0.5 mx-2 ${i < activeIdx ? 'bg-brand-600' : 'bg-stone-200'}`} />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export default function OrderDetailPage() {
  const router = useRouter();
  const { code } = useCurrency();
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [openTrack, setOpenTrack] = useState<string | null>(null);
  const [trackData, setTrackData] = useState<Record<string, TrackResponse | 'loading' | 'error'>>({});

  useEffect(() => {
    if (!id) return;
    const t = typeof window !== 'undefined' ? window.localStorage.getItem('token') : null;
    if (!t) { router.replace(`/login?next=/orders/${id}`); return; }
    api<Order>(`/api/orders/me/${id}`, { silent: true })
      .then((o) => { setOrder(o); setLoading(false); })
      .catch(() => { setNotFound(true); setLoading(false); });
  }, [id, router]);

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
      <div className="max-w-container mx-auto px-6 py-10">
        <div className="h-8 w-48 bg-stone-100 rounded animate-pulse mb-6" />
        <div className="h-64 bg-stone-100 rounded-md animate-pulse" />
      </div>
    );
  }

  if (notFound || !order) {
    return (
      <div className="max-w-container mx-auto px-6 py-16 text-center">
        <h1 className="font-display text-2xl text-ink-900">Order not found</h1>
        <p className="text-sm text-ink-500 mt-1.5">We couldn't find that order.</p>
        <Link href="/orders" className="btn-primary inline-block mt-6">Back to my orders</Link>
      </div>
    );
  }

  const goodsTotal = order.items.reduce((n, it) => n + Number(it.priceAtPurchase) * it.quantity, 0);
  const shipping = Number(order.shippingTotal || 0);
  const addr = order.shippingAddress;

  return (
    <div className="max-w-container mx-auto px-6 py-8">
      <div className="text-xs mb-3">
        <Link href="/orders" className="text-ink-500 hover:text-ink-900">← Back to orders</Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-3xl text-ink-900">Order details</h1>
          <p className="text-sm text-ink-500 mt-1">
            Placed on {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
            <span className="mx-2">·</span>
            <span className="font-mono">#{order.id.slice(0, 8).toUpperCase()}</span>
          </p>
        </div>
        <StatusPill status={order.status} />
      </div>

      {/* Timeline */}
      <div className="bg-surface border border-line rounded-md shadow-card p-6 mb-6">
        <Timeline status={order.status} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Items + tracking */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-surface border border-line rounded-md shadow-card">
            <div className="px-5 py-3 border-b border-line">
              <h2 className="text-sm font-semibold text-ink-900">Items ({order.items.length})</h2>
            </div>
            <ul className="divide-y divide-line">
              {order.items.map((it) => {
                const trk = trackData[it.id];
                return (
                  <li key={it.id} className="p-5">
                    <div className="flex gap-4">
                      <Link href={`/products/${it.product.id}`} className="shrink-0">
                        {it.product.images?.[0] ? (
                          <img src={it.product.images[0]} alt="" className="w-20 h-20 rounded-md object-cover bg-stone-100" />
                        ) : (
                          <div className="w-20 h-20 rounded-md bg-stone-100" />
                        )}
                      </Link>
                      <div className="flex-1 min-w-0">
                        <Link href={`/products/${it.product.id}`} className="text-sm font-medium text-ink-900 hover:text-brand-700 line-clamp-2">
                          {it.product.name}
                        </Link>
                        <p className="text-xs text-ink-500 mt-0.5">
                          Sold by <span className="text-ink-700">{it.vendor.shopName}</span>
                        </p>
                        <p className="text-xs text-ink-500 mt-0.5">Qty {it.quantity} · {formatPrice(it.priceAtPurchase, code)} each</p>
                        {it.shippingCarrier && (
                          <p className="text-xs text-ink-500 mt-1.5">
                            <span className="text-ink-700 font-medium">Shipping:</span> {it.shippingCarrier}
                            {it.shippingService ? ` · ${it.shippingService}` : ''}
                            {it.trackingNumber ? ` · AWB ${it.trackingNumber}` : ''}
                          </p>
                        )}
                        {it.dispatchedAt && (
                          <p className="text-xs text-ink-500 mt-0.5">
                            <span className="text-ink-700 font-medium">Shipped on:</span>{' '}
                            {new Date(it.dispatchedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        )}
                        {it.deliveredAt && (
                          <p className="text-xs text-emerald-600 font-medium mt-0.5">
                            Delivered on {new Date(it.deliveredAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-ink-900">{formatPrice(Number(it.priceAtPurchase) * it.quantity, code)}</p>
                        <div className="mt-1.5"><StatusPill status={it.status} /></div>
                      </div>
                    </div>

                    {it.trackingNumber && (
                      <div className="mt-3 flex gap-3 text-xs">
                        <button onClick={() => toggleTrack(it.id)} className="text-brand-700 hover:underline font-medium">
                          {openTrack === it.id ? 'Hide tracking' : 'Track shipment'}
                        </button>
                        {it.trackingUrl && (
                          <a href={it.trackingUrl} target="_blank" rel="noreferrer" className="text-brand-700 hover:underline font-medium">
                            Open carrier page ↗
                          </a>
                        )}
                      </div>
                    )}

                    {openTrack === it.id && (
                      <div className="mt-3 ml-24 pl-4 border-l-2 border-stone-200">
                        {trk === 'loading' && <p className="text-xs text-ink-500">Loading tracking…</p>}
                        {trk === 'error' && <p className="text-xs text-danger">Failed to load tracking</p>}
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

        {/* Right rail: summary, address, payment */}
        <aside className="space-y-4">
          <div className="bg-surface border border-line rounded-md shadow-card p-5">
            <h2 className="text-sm font-semibold text-ink-900 mb-3">Order summary</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-ink-700">Items</dt><dd className="text-ink-900">{formatPrice(goodsTotal, code)}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-700">Shipping</dt><dd className="text-ink-900">{shipping > 0 ? formatPrice(shipping, code) : 'Free'}</dd></div>
              <div className="border-t border-line pt-2 mt-2 flex justify-between font-semibold">
                <dt className="text-ink-900">Total</dt>
                <dd className="text-ink-900">{formatPrice(order.totalAmount, code)}</dd>
              </div>
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

          <div className="bg-surface border border-line rounded-md shadow-card p-5">
            <h2 className="text-sm font-semibold text-ink-900 mb-3">Need help?</h2>
            <p className="text-xs text-ink-500 mb-3">Reach out about this order and we'll get back to you.</p>
            <Link href="/help" className="btn-secondary w-full text-center !py-2 text-sm">Contact support</Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
