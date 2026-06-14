'use client';
import Link from 'next/link';
import { WishlistButton } from '@/components/WishlistButton';
import { useCurrency, formatPrice } from '@/lib/currency';

export interface ProductCardData {
  id: string;
  slug?: string | null;
  name: string;
  price: string | number;
  mrp?: string | number | null;
  images: string[];
  vendor: { shopName: string; slug?: string | null };
  rating?: number;
  reviewCount?: number;
  freeShipping?: boolean;
  badge?: string | null;
  variationCombos?: { price: string | number | null }[];
}

export function ProductCard({ product }: { product: ProductCardData }) {
  const { code } = useCurrency();
  const rating = product.rating ?? 0;
  const reviews = product.reviewCount ?? 0;
  const hasMrp = product.mrp && Number(product.mrp) > Number(product.price);
  const discount = hasMrp
    ? Math.round(((Number(product.mrp) - Number(product.price)) / Number(product.mrp)) * 100)
    : null;

  // Etsy-style "from ₹X" / "₹X+" when variation combos have multiple prices.
  const comboPrices = (product.variationCombos ?? [])
    .map((c) => (c.price != null ? Number(c.price) : Number(product.price)))
    .filter((n) => Number.isFinite(n) && n > 0);
  const minPrice = comboPrices.length ? Math.min(...comboPrices) : Number(product.price);
  const maxPrice = comboPrices.length ? Math.max(...comboPrices) : Number(product.price);
  const hasVariationRange = comboPrices.length > 0 && minPrice !== maxPrice;
  const displayPrice = hasVariationRange ? minPrice : Number(product.price);

  const storefrontBase = process.env.NEXT_PUBLIC_STOREFRONT_URL || '';
  const productHref = product.vendor.slug && product.slug
    ? `${storefrontBase}/${product.vendor.slug}/${product.slug}`
    : `/products/${product.id}`;

  const img0 = product.images[0];
  const img1 = product.images[1];

  return (
    <Link
      href={productHref}
      className="group relative block transition-all duration-300 ease-out hover:-translate-y-1"
    >
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-gradient-to-br from-stone-100 to-stone-200 shadow-sm transition-shadow duration-300 group-hover:shadow-xl ring-1 ring-black/5">
        {img0 ? (
          <>
            <img
              src={img0}
              alt={product.name}
              loading="lazy"
              className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ease-out ${
                img1 ? 'group-hover:opacity-0' : ''
              } group-hover:scale-[1.06]`}
            />
            {img1 && (
              <img
                src={img1}
                alt=""
                aria-hidden
                loading="lazy"
                className="absolute inset-0 w-full h-full object-cover opacity-0 scale-[1.06] transition-all duration-700 ease-out group-hover:opacity-100 group-hover:scale-100"
              />
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-ink-300 text-xs">No image</div>
        )}

        {/* Discount / custom badge */}
        {(product.badge || discount) && (
          <span className="absolute top-3 left-3 z-10 rounded-full bg-brand-600 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-white shadow-md">
            {product.badge ?? `−${discount}%`}
          </span>
        )}

        {/* Wishlist — frosted circle (component supplies its own styling) */}
        <WishlistButton productId={product.id} className="absolute top-2.5 right-2.5 z-10" />

        {/* "View details" reveal on hover */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-3 translate-y-3 opacity-0 transition-all duration-300 ease-out group-hover:translate-y-0 group-hover:opacity-100">
          <span className="block rounded-full bg-white/90 py-2 text-center text-xs font-semibold tracking-wide text-ink-900 shadow-md backdrop-blur">
            View details
          </span>
        </div>
      </div>

      <div className="pt-3 px-0.5 pb-1">
        <p className="text-[11px] uppercase tracking-wide text-ink-500 truncate">{product.vendor.shopName}</p>
        <h3 className="mt-1 text-sm font-medium leading-snug text-ink-900 line-clamp-2 min-h-[2.5em] group-hover:text-brand-700 transition-colors">
          {product.name}
        </h3>

        {reviews > 0 && (
          <div className="mt-1.5 flex items-center gap-1.5">
            <Stars value={rating} />
            <span className="text-xs text-ink-500">({reviews})</span>
          </div>
        )}

        <div className="mt-1.5 flex items-baseline flex-wrap gap-x-2 gap-y-0.5">
          <span className="text-base font-bold text-ink-900">
            {formatPrice(displayPrice, code)}{hasVariationRange && '+'}
          </span>
          {hasMrp && (
            <span className="text-xs text-ink-500 line-through">{formatPrice(product.mrp!, code)}</span>
          )}
          {discount && (
            <span className="text-[11px] font-semibold text-success">−{discount}%</span>
          )}
        </div>

        {product.freeShipping && (
          <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-success">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 3h15v13H1zM16 8h4l3 3v5h-7M5.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM18.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z" />
            </svg>
            Free shipping
          </p>
        )}
      </div>
    </Link>
  );
}

export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  const full = Math.round(value);
  return (
    <span className="inline-flex" aria-label={`${value} stars`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <svg
          key={i}
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill={i < full ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.6"
          className="text-brand-600"
        >
          <path d="M12 2.5l2.95 6.4 6.55.6-4.95 4.55 1.4 6.45L12 17.6l-5.95 2.9 1.4-6.45L2.5 9.5l6.55-.6L12 2.5z" />
        </svg>
      ))}
    </span>
  );
}

