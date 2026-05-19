'use client';

// Live renderers for the 5 cart blocks. Each consumes <CartBlockProvider>
// via useCartBlock(). Outside the provider they render labelled fallbacks.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { ProductCard } from '@/components/storefront/ProductCard';
import { useCartBlock, CartFallback } from './CartContext';
import { useCurrency, formatPrice } from '@/lib/currency';

// ── Line items ──────────────────────────────────────────────────────────────
export function CartLineItemsRenderer({ settings }: { settings: any; ctx: any }) {
  const { code } = useCurrency();
  const cart = useCartBlock();
  if (!cart) return <CartFallback label="Cart line items" hint="Item list with qty + remove controls." />;
  if (cart.items.length === 0) {
    return (
      <div className="border border-line rounded-md bg-surface p-8 text-center">
        <p className="font-display text-2xl mb-2">Your cart is empty</p>
        <p className="text-sm text-ink-700 mb-5">Find a piece you love from {cart.vendorName}.</p>
        <Link href={`/store/${cart.storeKey}/products`} className="btn-primary inline-flex">
          Browse {cart.vendorName}
        </Link>
      </div>
    );
  }
  return (
    <section className="bg-surface border border-line rounded-md shadow-card">
      <ul className="divide-y divide-line">
        {cart.items.map((i) => (
          <li key={`${i.productId}::${i.variationComboId ?? ''}`} className="p-5 flex gap-4">
            {settings?.showThumbnail !== false && (
              <div className="h-24 w-24 rounded-md bg-canvas overflow-hidden shrink-0">
                {i.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={i.image} alt="" className="w-full h-full object-cover" />
                )}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <Link href={`/store/${cart.storeKey}/products/${i.productId}`} className="font-semibold line-clamp-2 hover:underline">
                {i.name}
              </Link>
              {i.variationLabel && <p className="text-xs text-ink-700 mt-0.5">{i.variationLabel}</p>}
              <p className="text-xs text-ink-500 mt-0.5">by {i.vendorName}</p>
              <div className="mt-3 flex items-center gap-3 flex-wrap">
                <div className="inline-flex items-center border border-line rounded-pill overflow-hidden">
                  <button
                    onClick={() => cart.setQty(i.productId, Math.max(1, i.quantity - 1), i.variationComboId)}
                    className="w-9 h-9 hover:bg-canvas"
                  >−</button>
                  <span className="w-10 text-center text-sm font-semibold">{i.quantity}</span>
                  <button
                    onClick={() => cart.setQty(i.productId, i.quantity + 1, i.variationComboId)}
                    className="w-9 h-9 hover:bg-canvas"
                  >+</button>
                </div>
                <button
                  onClick={() => cart.saveForLater(i.productId, i.variationComboId)}
                  className="text-xs text-ink-500 hover:text-ink-900 underline underline-offset-4"
                >Save for later</button>
                {settings?.showRemove !== false && (
                  <button
                    onClick={() => cart.remove(i.productId, i.variationComboId)}
                    className="text-xs text-ink-500 hover:text-danger underline underline-offset-4"
                  >Remove</button>
                )}
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="font-bold">{formatPrice(i.price * i.quantity, code)}</p>
              {i.quantity > 1 && (
                <p className="text-xs text-ink-500 mt-0.5">{formatPrice(i.price, code)} × {i.quantity}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── Summary ─────────────────────────────────────────────────────────────────
export function CartSummaryRenderer({ settings }: { settings: any; ctx: any }) {
  const { code } = useCurrency();
  const cart = useCartBlock();
  const [couponOpen, setCouponOpen] = useState(false);
  const [coupon, setCoupon] = useState('');

  if (!cart) return <CartFallback label="Order summary" hint="Subtotal, taxes, coupon, checkout CTA." />;
  if (cart.items.length === 0) return null;

  return (
    <aside className="bg-surface border border-line rounded-md shadow-card p-5 lg:sticky lg:top-24">
      <h2 className="font-display text-xl mb-4">Order summary</h2>
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-ink-700">Subtotal ({cart.itemCount} items)</dt>
          <dd className="font-semibold">{formatPrice(cart.subtotal, code)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink-700">Shipping</dt>
          <dd className="text-ink-500">Calculated at checkout</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink-700">Estimated taxes</dt>
          <dd className="text-ink-500">Included</dd>
        </div>
      </dl>

      {settings?.showCoupon !== false && (
        <div className="mt-4">
          {couponOpen ? (
            <div className="flex gap-2">
              <input
                className="input-field flex-1"
                placeholder="Coupon code"
                value={coupon}
                onChange={(e) => setCoupon(e.target.value.toUpperCase())}
              />
              <button className="btn-secondary text-xs">Apply</button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setCouponOpen(true)}
              className="text-xs underline underline-offset-4 text-ink-700 hover:text-ink-900"
            >Have a coupon?</button>
          )}
        </div>
      )}

      <div className="border-t border-line my-4" />

      <div className="flex justify-between items-baseline mb-5">
        <span className="font-semibold">Total</span>
        <span className="font-display text-2xl">{formatPrice(cart.subtotal, code)}</span>
      </div>

      <button
        onClick={cart.proceedToCheckout}
        className="btn-primary w-full !py-3"
        style={{ background: cart.theme }}
      >
        {settings?.ctaLabel || 'Proceed to checkout'}
      </button>
    </aside>
  );
}

// ── Upsell carousel ─────────────────────────────────────────────────────────
export function CartUpsellRenderer({ settings }: { settings: any; ctx: any }) {
  const cart = useCartBlock();
  const [items, setItems] = useState<any[] | null>(null);

  useEffect(() => {
    if (!cart) return;
    const limit = settings?.limit ?? 6;
    const source = settings?.source ?? 'related';
    let url: string;
    if (source === 'section' && settings?.sectionId) {
      url = `/api/vendors/${cart.vendorId}/sections/${settings.sectionId}/products?limit=${limit}`;
    } else if (source === 'vendor') {
      url = `/api/products?vendorId=${cart.vendorId}&limit=${limit}`;
    } else {
      // related: cross-sell from the first cart item
      const seed = cart.items[0]?.productId;
      if (!seed) { setItems([]); return; }
      url = `/api/products/${seed}/related?limit=${limit}`;
    }
    api(url, { auth: false, silent: true })
      .then((d: any) => setItems(Array.isArray(d) ? d : (d.products ?? d.items ?? [])))
      .catch(() => setItems([]));
  }, [cart?.vendorId, cart?.items.length, settings?.source, settings?.sectionId, settings?.limit]);

  if (!cart) return <CartFallback label="Upsell carousel" hint="Suggested add-ons." />;
  if (!items || items.length === 0) return null;
  return (
    <section className="mt-10">
      <h2 className="font-display text-xl mb-4">{settings?.heading || 'Pairs beautifully with'}</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {items.slice(0, settings?.limit ?? 6).map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}

// ── Trust strip ─────────────────────────────────────────────────────────────
export function CartTrustStripRenderer({ settings }: { settings: any; ctx: any }) {
  const cart = useCartBlock();
  const items: { iconUrl?: string; label: string }[] =
    (settings?.items && settings.items.length > 0)
      ? settings.items
      : [
          { label: 'Secure payment' },
          { label: 'BIS-hallmarked' },
          { label: '30-day returns' },
        ];
  const theme = cart?.theme ?? '#F1641E';
  return (
    <ul className="my-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-ink-700">
      {items.map((it, i) => (
        <li key={i} className="flex items-center gap-2">
          <span style={{ color: theme }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="m5 12 4 4L19 6" />
            </svg>
          </span>
          {it.label}
        </li>
      ))}
    </ul>
  );
}

// ── Announcement bar ────────────────────────────────────────────────────────
export function CartAnnouncementRenderer({ settings }: { settings: any; ctx: any }) {
  const cart = useCartBlock();
  if (!settings?.text) return null;
  const bg = settings.background === 'brand'
    ? (cart?.theme ?? '#F1641E')
    : settings.background === 'canvas' ? '#F8F5EF' : 'transparent';
  const fg = settings.background === 'brand' ? '#FFFFFF' : '#1A1A1A';
  return (
    <div className="text-center text-sm py-2 mb-4 rounded" style={{ background: bg, color: fg }}>
      {settings.text}
    </div>
  );
}
