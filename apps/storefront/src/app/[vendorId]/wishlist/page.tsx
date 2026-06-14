'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useWishlist, type WishlistItem } from '@/lib/wishlist';
import { useVendor } from '@/lib/vendor-context';
import { addToCartWithVendorGuard } from '@/lib/cart';
import { useCurrency, formatPrice } from '@/lib/currency';

export default function VendorWishlistPage() {
  const { vendorId } = useParams<{ vendorId: string }>();
  const router = useRouter();
  const { code } = useCurrency();
  const { vendor, basePath } = useVendor();
  const hydrate = useWishlist((s) => s.hydrate);
  const remove = useWishlist((s) => s.remove);
  const allItems = useWishlist((s) => s.items);
  const [loading, setLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<'shop' | 'all'>('shop');

  useEffect(() => {
    const t = typeof window !== 'undefined' ? window.localStorage.getItem('token') : null;
    if (!t) { router.replace(`/login?next=/${vendorId}/wishlist`); return; }
    hydrate().finally(() => setLoading(false));
  }, [router, vendorId, hydrate]);

  const items = useMemo(() => {
    if (filterMode === 'all') return allItems;
    return allItems.filter((it) => it.product.vendor.id === vendor.id);
  }, [allItems, filterMode, vendor.id]);

  function onMoveToCart(it: WishlistItem) {
    const p = it.product;
    if (!p.isActive || p.status !== 'ACTIVE') { toast.error('This item is no longer available'); return; }
    if (p.stockQuantity <= 0) { toast.error('Out of stock'); return; }
    const ok = addToCartWithVendorGuard({
      productId: p.id, name: p.name, price: p.price, image: p.images[0] ?? '',
      vendorId: p.vendor.id, vendorName: p.vendor.shopName,
    });
    if (ok) { toast.success('Added to cart'); void remove(p.id); }
  }

  return (
    <div className="max-w-6xl mx-auto px-5 py-8">
      <div className="flex items-baseline justify-between gap-4 flex-wrap mb-6">
        <h1 className="font-display text-3xl">Your wishlist</h1>
        <div className="inline-flex bg-canvas border border-line rounded-pill p-1 text-xs font-semibold">
          {(['shop', 'all'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setFilterMode(m)}
              className={`px-3 h-8 rounded-pill ${filterMode === m ? 'bg-surface shadow-card text-ink-900' : 'text-ink-700'}`}
            >
              {m === 'shop' ? `From ${vendor.shopName}` : 'All saved'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-ink-700">Loading…</p>
      ) : items.length === 0 ? (
        <div className="text-center py-16 border border-line rounded-md bg-surface">
          <p className="font-display text-xl mb-1">Nothing saved yet</p>
          <p className="text-sm text-ink-700 mb-5">
            {filterMode === 'shop'
              ? `Tap the heart on any ${vendor.shopName} piece to save it for later.`
              : 'Tap the heart on any piece across the marketplace to save it.'}
          </p>
          <Link href={`${basePath}/products`} className="btn-primary inline-flex">Browse {vendor.shopName}</Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {items.map((it) => {
            const p = it.product;
            const unavailable = !p.isActive || p.status !== 'ACTIVE' || p.stockQuantity <= 0;
            return (
              <div key={it.id} className="bg-surface border border-line rounded-md overflow-hidden flex flex-col">
                <Link href={`${basePath}/products/${(p as any).slug || p.id}`} className="block relative aspect-square overflow-hidden bg-canvas">
                  {p.images[0] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />
                  )}
                  {unavailable && (
                    <span className="absolute top-2 left-2 bg-ink-900/85 text-white text-[11px] uppercase tracking-wide px-2 py-1 rounded-pill">
                      {p.stockQuantity <= 0 ? 'Out of stock' : 'Unavailable'}
                    </span>
                  )}
                </Link>
                <div className="p-3 flex-1 flex flex-col">
                  <Link href={`${basePath}/products/${(p as any).slug || p.id}`} className="text-sm line-clamp-2 hover:underline">{p.name}</Link>
                  <p className="text-xs text-ink-500 mt-0.5">{p.vendor.shopName}</p>
                  <p className="font-display text-lg mt-1">{formatPrice(p.price, code)}</p>
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => onMoveToCart(it)} disabled={unavailable} className="btn-primary flex-1 !py-2 !text-xs disabled:opacity-50">Move to cart</button>
                    <button onClick={() => remove(p.id)} aria-label="Remove" className="w-9 h-9 flex items-center justify-center rounded-md border border-line hover:text-danger hover:border-danger">
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
