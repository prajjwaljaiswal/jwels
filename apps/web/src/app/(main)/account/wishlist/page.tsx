'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useWishlist, type WishlistItem } from '@/lib/wishlist';
import { addToCartWithVendorGuard } from '@/lib/cart';
import { useCurrency, formatPrice } from '@/lib/currency';

export default function WishlistPage() {
  const router = useRouter();
  const { code } = useCurrency();
  const hydrate = useWishlist((s) => s.hydrate);
  const remove = useWishlist((s) => s.remove);
  const items = useWishlist((s) => s.items);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = typeof window !== 'undefined' ? window.localStorage.getItem('token') : null;
    if (!t) { router.replace('/auth/login?next=/account/wishlist'); return; }
    hydrate().finally(() => setLoading(false));
  }, [router, hydrate]);

  function onMoveToCart(it: WishlistItem) {
    const p = it.product;
    if (!p.isActive || p.status !== 'ACTIVE') {
      toast.error('This item is no longer available');
      return;
    }
    if (p.stockQuantity <= 0) {
      toast.error('Out of stock');
      return;
    }
    const ok = addToCartWithVendorGuard({
      productId: p.id,
      name: p.name,
      price: p.price,
      image: p.images[0] ?? '',
      vendorId: p.vendor.id,
      vendorName: p.vendor.shopName,
    });
    if (ok) {
      toast.success('Added to cart');
      void remove(p.id);
    }
  }

  return (
    <div className="max-w-container mx-auto px-6 py-8">
      <div className="flex items-baseline justify-between mb-6">
        <h1 className="font-display text-3xl text-ink-900">Wishlist</h1>
        <span className="text-sm text-ink-700">{items.length} item{items.length === 1 ? '' : 's'}</span>
      </div>

      {loading ? (
        <p className="text-ink-700">Loading…</p>
      ) : items.length === 0 ? (
        <div className="text-center py-20 border border-line rounded-md bg-surface">
          <p className="font-display text-xl text-ink-900 mb-2">Your wishlist is empty</p>
          <p className="text-sm text-ink-700 mb-5">Tap the heart on any piece you love to save it for later.</p>
          <Link href="/products" className="btn-primary inline-flex">Browse jewelry</Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {items.map((it) => {
            const p = it.product;
            const unavailable = !p.isActive || p.status !== 'ACTIVE' || p.stockQuantity <= 0;
            return (
              <div key={it.id} className="bg-surface border border-line rounded-md overflow-hidden flex flex-col">
                <Link href={`/products/${p.id}`} className="block relative aspect-square overflow-hidden bg-canvas">
                  {p.images[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />
                  ) : null}
                  {unavailable && (
                    <span className="absolute top-2 left-2 bg-ink-900/85 text-white text-[11px] uppercase tracking-wide px-2 py-1 rounded-pill">
                      {p.stockQuantity <= 0 ? 'Out of stock' : 'Unavailable'}
                    </span>
                  )}
                </Link>
                <div className="p-3 flex-1 flex flex-col">
                  <Link href={`/products/${p.id}`} className="text-sm text-ink-900 line-clamp-2 hover:underline">{p.name}</Link>
                  <p className="text-xs text-ink-500 mt-0.5">{p.vendor.shopName}</p>
                  <p className="font-display text-lg text-ink-900 mt-1">{formatPrice(p.price, code)}</p>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => onMoveToCart(it)}
                      disabled={unavailable}
                      className="btn-primary flex-1 !py-2 !text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Move to cart
                    </button>
                    <button
                      onClick={() => remove(p.id)}
                      aria-label="Remove from wishlist"
                      className="w-9 h-9 flex items-center justify-center rounded-md border border-line text-ink-700 hover:text-danger hover:border-danger"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
