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

  const productHref = product.vendor.slug && product.slug
    ? `/store/${product.vendor.slug}/${product.slug}`
    : `/products/${product.id}`;

  return (
    <Link
      href={productHref}
      className="group relative block rounded-md overflow-hidden bg-transparent transition hover:shadow-pop"
    >
      <div className="relative aspect-square bg-stone-100 rounded-md overflow-hidden">
        {product.images[0] ? (
          <img
            src={product.images[0]}
            alt={product.name}
            className="w-full h-full object-cover transition group-hover:scale-[1.02]"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-ink-300 text-xs">No image</div>
        )}

        {(product.badge || discount) && (
          <span className="absolute top-2 left-2 badge-sale">
            {product.badge ?? `Sale −${discount}%`}
          </span>
        )}

        <WishlistButton productId={product.id} className="absolute top-2 right-2" />
      </div>

      <div className="pt-3 px-1 pb-3">
        <p className="text-xs text-ink-500 truncate">{product.vendor.shopName}</p>
        <h3 className="text-sm text-ink-900 mt-0.5 line-clamp-2 min-h-[2.5em]">{product.name}</h3>
        <div className="flex items-center gap-1.5 mt-1">
          <Stars value={rating} />
          <span className="text-xs text-ink-500">({reviews})</span>
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-base font-bold text-ink-900">
            {formatPrice(displayPrice, code)}{hasVariationRange && '+'}
          </span>
          {hasMrp && (
            <span className="text-xs text-ink-500 line-through">{formatPrice(product.mrp!, code)}</span>
          )}
        </div>
        {product.freeShipping && (
          <p className="text-xs text-success font-medium mt-0.5">Free shipping</p>
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

