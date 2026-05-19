'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useCart } from '@/lib/cart';
import { useWishlist } from '@/lib/wishlist';
import { useCurrency, formatPrice } from '@/lib/currency';

export default function CartPage() {
  const router = useRouter();
  const { code } = useCurrency();
  const { items, setQty, remove, total } = useCart();
  const addToWishlist = useWishlist((s) => s.add);

  async function saveForLater(productId: string, variationComboId?: string) {
    const t = typeof window !== 'undefined' ? window.localStorage.getItem('token') : null;
    if (!t) { toast.error('Sign in to save items for later'); return; }
    await addToWishlist(productId);
    remove(productId, variationComboId);
    toast.success('Moved to wishlist');
  }

  if (items.length === 0) {
    return (
      <div className="max-w-container mx-auto px-6 py-16 text-center">
        <p className="font-display text-3xl text-ink-900 mb-2">Your cart is empty</p>
        <p className="text-sm text-ink-700 mb-6">Browse handcrafted jewelry from independent makers.</p>
        <Link href="/products" className="btn-primary inline-flex">Start shopping</Link>
      </div>
    );
  }

  const subtotal = total();

  return (
    <div className="max-w-container mx-auto px-6 py-8">
      <div className="flex items-baseline justify-between gap-4 mb-6">
        <h1 className="font-display text-3xl text-ink-900">Your cart</h1>
        <Link href="/products" className="text-sm text-brand-700 hover:underline">Continue shopping →</Link>
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-8 items-start">
        <section className="bg-surface border border-line rounded-md shadow-card">
          <ul className="divide-y divide-line">
            {items.map((i) => (
              <li key={`${i.productId}::${i.variationComboId ?? ''}`} className="p-5 flex gap-4">
                <div className="h-24 w-24 rounded-md bg-canvas overflow-hidden shrink-0">
                  {i.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={i.image} alt="" className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <Link href={`/products/${i.productId}`} className="font-semibold text-ink-900 line-clamp-2 hover:underline">
                    {i.name}
                  </Link>
                  {i.variationLabel && <p className="text-xs text-ink-700 mt-0.5">{i.variationLabel}</p>}
                  <p className="text-xs text-ink-500 mt-0.5">by {i.vendorName}</p>
                  <div className="mt-3 flex items-center gap-3 flex-wrap">
                    <div className="inline-flex items-center border border-line rounded-pill overflow-hidden">
                      <button
                        onClick={() => setQty(i.productId, Math.max(1, i.quantity - 1), i.variationComboId)}
                        className="w-9 h-9 hover:bg-canvas text-ink-700"
                        aria-label="Decrease quantity"
                      >−</button>
                      <span className="w-10 text-center text-sm font-semibold">{i.quantity}</span>
                      <button
                        onClick={() => setQty(i.productId, i.quantity + 1, i.variationComboId)}
                        className="w-9 h-9 hover:bg-canvas text-ink-700"
                        aria-label="Increase quantity"
                      >+</button>
                    </div>
                    <button
                      onClick={() => saveForLater(i.productId, i.variationComboId)}
                      className="text-xs text-ink-500 hover:text-ink-900 underline underline-offset-4"
                    >
                      Save for later
                    </button>
                    <button
                      onClick={() => remove(i.productId, i.variationComboId)}
                      className="text-xs text-ink-500 hover:text-danger underline underline-offset-4"
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-ink-900">{formatPrice(i.price * i.quantity, code)}</p>
                  {i.quantity > 1 && (
                    <p className="text-xs text-ink-500 mt-0.5">
                      {formatPrice(i.price, code)} × {i.quantity}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <aside className="bg-surface border border-line rounded-md shadow-card p-5 lg:sticky lg:top-24">
          <h2 className="font-display text-xl text-ink-900 mb-4">Order summary</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-700">Subtotal ({items.reduce((n, i) => n + i.quantity, 0)} items)</dt>
              <dd className="font-semibold text-ink-900">{formatPrice(subtotal, code)}</dd>
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
            <span className="font-semibold text-ink-900">Total</span>
            <span className="font-display text-2xl text-ink-900">{formatPrice(subtotal, code)}</span>
          </div>

          <button onClick={() => router.push('/checkout')} className="btn-primary w-full !py-3">
            Proceed to checkout
          </button>

          <ul className="mt-5 space-y-2 text-xs text-ink-700">
            <li className="flex items-center gap-2">
              <span className="text-success">✓</span> Free 30-day returns
            </li>
            <li className="flex items-center gap-2">
              <span className="text-success">✓</span> Hallmarked &amp; certified
            </li>
            <li className="flex items-center gap-2">
              <span className="text-success">✓</span> Tracked shipping across India
            </li>
          </ul>
        </aside>
      </div>
    </div>
  );
}
