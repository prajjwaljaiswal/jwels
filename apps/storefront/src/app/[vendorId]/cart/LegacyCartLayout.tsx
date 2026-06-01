'use client';
import { useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useCart } from '@/lib/cart';
import { useWishlist } from '@/lib/wishlist';
import { useVendor } from '@/lib/vendor-context';
import { useCurrency, formatPrice } from '@/lib/currency';

export function LegacyVendorCartPage() {
  const router = useRouter();
  const { code } = useCurrency();
  const { vendor, storeKey } = useVendor();
  const { items, setQty, remove } = useCart();
  const addToWishlist = useWishlist((s) => s.add);

  const vendorItems = useMemo(
    () => items.filter((i) => !i.vendorId || i.vendorId === vendor.id),
    [items, vendor.id],
  );

  const subtotal = useMemo(
    () => vendorItems.reduce((s, i) => s + i.price * i.quantity, 0),
    [vendorItems],
  );

  async function saveForLater(productId: string, variationComboId?: string) {
    const t = typeof window !== 'undefined' ? window.localStorage.getItem('token') : null;
    if (!t) { toast.error('Sign in to save items for later'); return; }
    await addToWishlist(productId);
    remove(productId, variationComboId);
    toast.success('Moved to wishlist');
  }

  if (vendorItems.length === 0) {
    return (
      <div className="max-w-6xl mx-auto px-5 py-16 text-center">
        <p className="font-display text-3xl mb-2">Your cart is empty</p>
        <p className="text-sm text-ink-700 mb-6">Find a piece you love from {vendor.shopName}.</p>
        <Link href={`/${storeKey}/products`} className="btn-primary inline-flex">Browse {vendor.shopName}</Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-5 py-8">
      <div className="flex items-baseline justify-between gap-4 mb-6">
        <h1 className="font-display text-3xl">Your cart</h1>
        <Link href={`/${storeKey}/products`} className="text-sm hover:underline">Continue shopping →</Link>
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-8 items-start">
        <section className="bg-surface border border-line rounded-md shadow-card">
          <ul className="divide-y divide-line">
            {vendorItems.map((i) => (
              <li key={`${i.productId}::${i.variationComboId ?? ''}`} className="p-5 flex gap-4">
                <div className="h-24 w-24 rounded-md bg-canvas overflow-hidden shrink-0">
                  {i.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={i.image} alt="" className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <Link href={`/${storeKey}/products/${i.productId}`} className="font-semibold line-clamp-2 hover:underline">
                    {i.name}
                  </Link>
                  {i.variationLabel && <p className="text-xs text-ink-700 mt-0.5">{i.variationLabel}</p>}
                  <p className="text-xs text-ink-500 mt-0.5">by {i.vendorName}</p>
                  <div className="mt-3 flex items-center gap-3 flex-wrap">
                    <div className="inline-flex items-center border border-line rounded-pill overflow-hidden">
                      <button onClick={() => setQty(i.productId, Math.max(1, i.quantity - 1), i.variationComboId)} className="w-9 h-9 hover:bg-canvas">−</button>
                      <span className="w-10 text-center text-sm font-semibold">{i.quantity}</span>
                      <button onClick={() => setQty(i.productId, i.quantity + 1, i.variationComboId)} className="w-9 h-9 hover:bg-canvas">+</button>
                    </div>
                    <button onClick={() => saveForLater(i.productId, i.variationComboId)} className="text-xs text-ink-500 hover:text-ink-900 underline underline-offset-4">Save for later</button>
                    <button onClick={() => remove(i.productId, i.variationComboId)} className="text-xs text-ink-500 hover:text-danger underline underline-offset-4">Remove</button>
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

        <aside className="bg-surface border border-line rounded-md shadow-card p-5 lg:sticky lg:top-24">
          <h2 className="font-display text-xl mb-4">Order summary</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-700">Subtotal ({vendorItems.reduce((n, i) => n + i.quantity, 0)} items)</dt>
              <dd className="font-semibold">{formatPrice(subtotal, code)}</dd>
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

          <div className="border-t border-line my-4" />

          <div className="flex justify-between items-baseline mb-5">
            <span className="font-semibold">Total</span>
            <span className="font-display text-2xl">{formatPrice(subtotal, code)}</span>
          </div>

          <button onClick={() => router.push(`/${storeKey}/checkout`)} className="btn-primary w-full !py-3">
            Proceed to checkout
          </button>
        </aside>
      </div>
    </div>
  );
}
