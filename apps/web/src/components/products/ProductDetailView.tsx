'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { useCurrency, formatPrice } from '@/lib/currency';
import { useCart, addToCartWithVendorGuard } from '@/lib/cart';
import { Stars } from '@/components/storefront/ProductCard';
import { WishlistButton } from '@/components/WishlistButton';
import { ProductGallery } from '@/components/products/ProductGallery';
import { DeliveryEstimator } from '@/components/products/DeliveryEstimator';
import { ProductRail } from '@/components/products/ProductRail';
import { ProductQA } from '@/components/products/ProductQA';
import type { ProductCardData } from '@/components/storefront/ProductCard';
import { pushRecentlyViewed, getRecentlyViewed } from '@/lib/recently-viewed';

interface VariationOption { id: string; value: string; position: number }
interface Variation { id: string; name: string; position: number; options: VariationOption[] }
interface VariationCombo { id: string; optionIds: string[]; price: string | null; stock: number; sku: string | null }

interface Product {
  id: string;
  slug?: string | null;
  name: string;
  brand?: string | null;
  description: string | null;
  highlights?: string[];
  warranty?: string | null;
  certificateImageUrl?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  category: { id: string; name: string; slug: string };
  metalType: string | null;
  materials?: string[];
  tags?: string[];
  whenMade?: string | null;
  whoMade?: 'I_DID' | 'COLLECTIVE' | 'SOMEONE_ELSE' | 'TEAM' | null;
  productType?: 'FINISHED' | 'SUPPLY' | null;
  acceptsOffers?: boolean;
  featured?: boolean;
  personalization?: { enabled: boolean; instructions: string; charLimit: number } | null;
  price: string;
  stockQuantity: number;
  images: string[];
  imageAlts?: string[];
  videoUrl?: string | null;
  vendor: { id: string; slug?: string | null; shopName: string; shopLogoUrl: string | null };
  attributeValues: { attribute: { id: string; name: string; inputType: string }; value: string }[];
  variations?: Variation[];
  variationCombos?: VariationCombo[];
  returnPolicy?: { id: string; name: string; accepted: boolean; days: number; buyerPaysReturn: boolean; notes: string | null } | null;
  shopSection?: { id: string; name: string; slug: string } | null;
}

const WHO_MADE_LABEL: Record<string, string> = {
  I_DID: 'I made it',
  COLLECTIVE: 'A member of my shop',
  SOMEONE_ELSE: 'Another company or person',
  TEAM: 'My team',
};
const WHEN_MADE_LABEL: Record<string, string> = {
  made_to_order: 'Made to order',
  '2020s': '2020 – present',
  '2010s': '2010 – 2019',
  '2000s': '2000 – 2009',
  before_2000: 'Before 2000',
  vintage: 'Vintage',
};

interface ReviewItem {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  mediaUrls: string[];
  mediaTypes: string[];
  createdAt: string;
  vendorResponse: string | null;
  vendorRespondedAt: string | null;
  customer: { name: string };
}

interface ReviewsData {
  reviews: ReviewItem[];
  total: number;
  averageRating: number;
  ratingBreakdown: Record<number, number>;
  page: number;
  limit: number;
}

function buildHighlights(product: Product): string[] {
  if (product.highlights && product.highlights.length > 0) return product.highlights.slice(0, 8);
  const policy = product.returnPolicy;
  const returnsLine = policy
    ? (policy.accepted ? `${policy.days}-day easy returns` : 'Final sale — no returns')
    : '30-day easy returns';
  return [
    product.warranty || 'BIS-hallmarked materials',
    'Ships in 2 business days',
    returnsLine,
    'Certified vendor',
  ];
}

function StarSelector({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button key={star} type="button" onClick={() => onChange(star)}
          onMouseEnter={() => setHovered(star)} onMouseLeave={() => setHovered(0)}
          className="text-2xl leading-none transition-transform hover:scale-110">
          <span className={(hovered || value) >= star ? 'text-amber-400' : 'text-stone-300'}>★</span>
        </button>
      ))}
    </div>
  );
}

function RatingBar({ star, count, total }: { star: number; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-4 text-right text-ink-700">{star}</span>
      <span className="text-amber-400 text-xs">★</span>
      <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden">
        <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 text-xs text-ink-500 text-right">{pct}%</span>
    </div>
  );
}

export function ProductDetailView({ productId }: { productId: string }) {
  const router = useRouter();
  const { code } = useCurrency();
  const [product, setProduct] = useState<Product | null>(null);
  const [qty, setQty] = useState(1);
  const ctaRef = useRef<HTMLDivElement>(null);
  const [stickyVisible, setStickyVisible] = useState(false);

  useEffect(() => {
    const el = ctaRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setStickyVisible(!entry.isIntersecting),
      { rootMargin: '0px', threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [product]);

  const [related, setRelated] = useState<ProductCardData[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<ProductCardData[]>([]);
  const [openSection, setOpenSection] = useState<string>('description');
  const [selectedOpts, setSelectedOpts] = useState<Record<string, string>>({});
  const [personalizationText, setPersonalizationText] = useState('');

  const [reviewsData, setReviewsData] = useState<ReviewsData | null>(null);
  const [canReview, setCanReview] = useState(false);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [reviewForm, setReviewForm] = useState({ rating: 5, title: '', body: '' });
  const [reviewFiles, setReviewFiles] = useState<File[]>([]);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewErr, setReviewErr] = useState('');
  const [reviewSuccess, setReviewSuccess] = useState(false);

  async function loadReviews(id: string) {
    const data = await api<ReviewsData>(`/api/reviews/product/${id}`, { auth: false });
    setReviewsData(data);
  }

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

    api<Product>(`/api/products/${productId}`, { auth: false })
      .then((p) => {
        setProduct(p);
        if (typeof document !== 'undefined') {
          document.title = p.seoTitle || `${p.name} — ${p.vendor.shopName}`;
          const desc = p.seoDescription || (p.description ?? '').slice(0, 200);
          let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
          if (!meta) { meta = document.createElement('meta'); meta.name = 'description'; document.head.appendChild(meta); }
          meta.content = desc;
        }
      })
      .catch(() => router.push('/products'));

    loadReviews(productId);

    api<{ items: ProductCardData[] }>(`/api/products/${productId}/related`, { auth: false, silent: true })
      .then((r) => setRelated(r.items)).catch(() => {});

    const recentIds = getRecentlyViewed().filter((id) => id !== productId);
    if (recentIds.length > 0) {
      api<{ items: ProductCardData[] }>('/api/products/by-ids', {
        method: 'POST', auth: false, silent: true, body: JSON.stringify({ ids: recentIds }),
      }).then((r) => setRecentlyViewed(r.items)).catch(() => {});
    }
    pushRecentlyViewed(productId);

    if (token) {
      api<{ canReview: boolean; alreadyReviewed: boolean }>(`/api/reviews/can-review/${productId}`)
        .then((d) => { setCanReview(d.canReview); setAlreadyReviewed(d.alreadyReviewed); })
        .catch(() => {});
    }
  }, [productId, router]);

  if (!product) {
    return (
      <div className="max-w-container mx-auto px-6 py-10 grid md:grid-cols-2 gap-10">
        <div className="aspect-square bg-stone-100 rounded-md animate-pulse" />
        <div className="space-y-3">
          <div className="h-4 w-32 bg-stone-100 rounded animate-pulse" />
          <div className="h-8 w-3/4 bg-stone-100 rounded animate-pulse" />
          <div className="h-6 w-24 bg-stone-100 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  const variations = product?.variations ?? [];
  const allVariationsPicked = variations.length > 0 && variations.every((v) => selectedOpts[v.id]);
  const selectedCombo = (product && allVariationsPicked)
    ? product.variationCombos?.find((c) => {
        const wantIds = variations.map((v) => selectedOpts[v.id]);
        return c.optionIds.length === wantIds.length && wantIds.every((id) => c.optionIds.includes(id));
      })
    : undefined;

  const basePrice = Number(product?.price ?? 0);
  const effectivePrice = selectedCombo?.price != null ? Number(selectedCombo.price) : basePrice;
  const effectiveStock = variations.length > 0 ? (selectedCombo?.stock ?? 0) : (product?.stockQuantity ?? 0);

  const comboPrices = (product?.variationCombos ?? [])
    .map((c) => (c.price != null ? Number(c.price) : basePrice))
    .filter((n) => Number.isFinite(n) && n > 0);
  const minComboPrice = comboPrices.length ? Math.min(...comboPrices) : basePrice;
  const maxComboPrice = comboPrices.length ? Math.max(...comboPrices) : basePrice;
  const hasPriceRange = variations.length > 0 && minComboPrice !== maxComboPrice;

  function priceForOption(variationId: string, optionId: string): number | null {
    if (variations.length !== 1 || !product) return null;
    const combo = product.variationCombos?.find((c) => c.optionIds.includes(optionId));
    if (!combo) return null;
    return combo.price != null ? Number(combo.price) : basePrice;
  }

  const variationLabel = (() => {
    if (!product || !allVariationsPicked) return undefined;
    return variations.map((v) => {
      const o = v.options.find((opt) => opt.id === selectedOpts[v.id]);
      return `${v.name}: ${o?.value ?? ''}`;
    }).join(' · ');
  })();

  function addToCart(buyNow = false) {
    if (!product) return;
    if (variations.length > 0 && !allVariationsPicked) { toast.error('Please select all variations'); return; }
    if (variations.length > 0 && !selectedCombo) { toast.error('That combination is unavailable'); return; }
    const ok = addToCartWithVendorGuard(
      { productId: product.id, name: product.name, price: effectivePrice, image: product.images[0] || '',
        vendorId: product.vendor.id, vendorName: product.vendor.shopName,
        variationComboId: selectedCombo?.id, variationLabel },
      qty,
    );
    if (!ok) return;
    if (buyNow) router.push('/checkout');
    else toast.success(`${product.name} added to cart`);
  }

  async function submitReview(e: React.FormEvent) {
    e.preventDefault();
    setReviewErr('');
    setReviewLoading(true);
    try {
      const fd = new FormData();
      fd.append('productId', product!.id);
      fd.append('rating', String(reviewForm.rating));
      if (reviewForm.title) fd.append('title', reviewForm.title);
      if (reviewForm.body) fd.append('body', reviewForm.body);
      reviewFiles.forEach((f) => fd.append('media', f));
      await api('/api/reviews', { method: 'POST', body: fd });
      toast.success('Review published — thank you!');
      setReviewSuccess(true);
      setShowForm(false);
      setCanReview(false);
      setAlreadyReviewed(true);
      await loadReviews(product!.id);
    } catch (e: any) {
      setReviewErr(e.message);
    } finally {
      setReviewLoading(false);
    }
  }

  const inStock = effectiveStock > 0;
  const avgRating = reviewsData?.averageRating ?? 0;
  const reviewCount = reviewsData?.total ?? 0;

  // Vendor storefront link: prefer /{vendorSlug}/{productSlug}, fall back to /products/{id}
  const vendorHref = product.vendor.slug
    ? `/store/${product.vendor.slug}`
    : `/products?vendor=${product.vendor.id}`;

  return (
    <div className="max-w-container mx-auto px-6 py-8">
      <nav className="text-xs text-ink-500 mb-5">
        <Link href="/" className="hover:text-brand-700">Home</Link>
        <span className="mx-1.5">/</span>
        <Link href="/products" className="hover:text-brand-700">Jewelry</Link>
        <span className="mx-1.5">/</span>
        <Link href={`/products?category=${product.category.slug}`} className="hover:text-brand-700">{product.category.name}</Link>
        <span className="mx-1.5">/</span>
        <span className="text-ink-900">{product.name}</span>
      </nav>

      <div className="grid lg:grid-cols-[1fr_440px] gap-10">
        <ProductGallery name={product.name} images={product.images} imageAlts={product.imageAlts} videoUrl={product.videoUrl} />

        <div className="lg:sticky lg:top-32 self-start space-y-5">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <Link href={vendorHref} className="text-sm text-ink-500 hover:text-brand-700 underline underline-offset-2">
                {product.vendor.shopName}
              </Link>
              {product.brand && <><span className="text-ink-400 text-xs">·</span><span className="text-xs font-semibold text-ink-700">{product.brand}</span></>}
              {product.shopSection && <><span className="text-ink-400 text-xs">·</span><span className="text-xs text-ink-500">{product.shopSection.name}</span></>}
              {product.featured && <span className="text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full bg-brand-50 text-brand-700">Featured</span>}
              {product.acceptsOffers && <span className="text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Accepts offers</span>}
            </div>
            <h1 className="font-display text-3xl md:text-4xl text-ink-900 mt-2 leading-tight">{product.name}</h1>
            <div className="flex items-center gap-2 mt-2">
              <Stars value={avgRating} size={16} />
              <span className="text-sm text-ink-700">{avgRating > 0 ? avgRating.toFixed(1) : '—'}</span>
              <span className="text-sm text-ink-500">· {reviewCount} review{reviewCount !== 1 ? 's' : ''}</span>
            </div>
          </div>

          <div className="flex items-baseline gap-3 flex-wrap">
            {selectedCombo || !hasPriceRange ? (
              <span className="text-3xl font-bold text-ink-900">{formatPrice(effectivePrice, code)}</span>
            ) : (
              <>
                <span className="text-3xl font-bold text-ink-900">
                  {formatPrice(minComboPrice, code)}<span className="text-ink-500 font-normal"> – </span>{formatPrice(maxComboPrice, code)}
                </span>
                <span className="text-xs text-ink-500">price varies by option</span>
              </>
            )}
            <span className="text-sm text-ink-500">incl. of all taxes</span>
          </div>

          {variations.length > 0 && (
            <div className="space-y-3">
              {variations.map((v) => (
                <div key={v.id}>
                  <p className="text-xs uppercase tracking-wide font-semibold text-ink-700 mb-2">
                    {v.name}
                    {selectedOpts[v.id] && (
                      <span className="ml-2 text-ink-500 normal-case font-normal tracking-normal">
                        · {v.options.find((o) => o.id === selectedOpts[v.id])?.value}
                      </span>
                    )}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {v.options.map((o) => {
                      const active = selectedOpts[v.id] === o.id;
                      const wouldBeSelection = { ...selectedOpts, [v.id]: o.id };
                      const reachable = product.variationCombos?.some((c) =>
                        variations.every((vv) => {
                          const wantedId = wouldBeSelection[vv.id];
                          return wantedId ? c.optionIds.includes(wantedId) : true;
                        }) && c.stock > 0,
                      );
                      const optPrice = priceForOption(v.id, o.id);
                      return (
                        <button key={o.id} type="button"
                          onClick={() => setSelectedOpts({ ...selectedOpts, [v.id]: o.id })}
                          disabled={!reachable}
                          className={`rounded-pill border bg-white px-4 py-1.5 text-sm font-medium transition disabled:opacity-40 disabled:line-through inline-flex items-baseline gap-1.5 ${
                            active ? 'border-ink-900 ring-1 ring-ink-900' : 'border-line hover:border-ink-400'
                          }`}
                        >
                          <span>{o.value}</span>
                          {optPrice != null && <span className="text-xs text-ink-500 font-normal">{formatPrice(optPrice, code)}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {product.attributeValues.length > 0 && (
            <div className="space-y-3">
              {product.attributeValues.slice(0, 2).map((av) => (
                <div key={av.attribute.id}>
                  <p className="text-xs uppercase tracking-wide font-semibold text-ink-700 mb-2">{av.attribute.name}</p>
                  <button className="rounded-pill border border-ink-900 bg-white px-4 py-1.5 text-sm font-medium">{av.value}</button>
                </div>
              ))}
            </div>
          )}

          {product.personalization?.enabled && (
            <div>
              <p className="text-xs uppercase tracking-wide font-semibold text-ink-700 mb-2">
                Personalization <span className="text-ink-500 normal-case font-normal tracking-normal">(optional)</span>
              </p>
              <p className="text-xs text-ink-500 mb-2">{product.personalization.instructions}</p>
              <textarea className="input-field h-20 py-2"
                maxLength={product.personalization.charLimit}
                placeholder={`Up to ${product.personalization.charLimit} characters`}
                value={personalizationText}
                onChange={(e) => setPersonalizationText(e.target.value)} />
              <p className="text-[11px] text-ink-500 mt-1 text-right">
                {personalizationText.length} / {product.personalization.charLimit}
              </p>
            </div>
          )}

          <div>
            <p className="text-xs uppercase tracking-wide font-semibold text-ink-700 mb-2">Quantity</p>
            <div className="inline-flex items-center border border-line rounded-pill overflow-hidden">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-10 h-10 hover:bg-canvas">−</button>
              <span className="w-10 text-center text-sm font-semibold">{qty}</span>
              <button onClick={() => setQty((q) => Math.min(effectiveStock || 99, q + 1))} className="w-10 h-10 hover:bg-canvas">+</button>
            </div>
            <p className={`text-xs mt-2 font-semibold ${
              !inStock ? 'text-danger'
                : variations.length > 0 && !allVariationsPicked ? 'text-ink-700'
                : effectiveStock <= 5 ? 'text-amber-700'
                : 'text-success'
            }`}>
              {variations.length > 0 && !allVariationsPicked
                ? 'Select all variations to see stock'
                : !inStock ? 'Out of stock'
                : effectiveStock === 1 ? '⚡ Only 1 left — order soon!'
                : effectiveStock <= 5 ? `⚡ Only ${effectiveStock} left — order soon!`
                : `${effectiveStock} in stock — ready to ship`}
            </p>
          </div>

          <div ref={ctaRef} className="space-y-2 pt-2">
            <button onClick={() => addToCart(false)} disabled={!inStock} className="btn-primary w-full">Add to cart</button>
            <button onClick={() => addToCart(true)} disabled={!inStock} className="btn-secondary w-full">Buy it now</button>
            <WishlistButton productId={product.id} variant="pill" className="w-full justify-center" />
            <Link
              href={`/account/support/new?vendor=${product.vendor.id}&product=${product.id}`}
              className="block text-center text-sm text-ink-500 hover:text-brand-700 underline underline-offset-2 pt-1"
            >
              Contact seller
            </Link>
          </div>

          <DeliveryEstimator productId={product.id} />

          <ul className="space-y-2 pt-2">
            {buildHighlights(product).map((h) => (
              <li key={h} className="flex items-center gap-2 text-sm text-ink-700">
                <span className="text-success">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m5 12 4 4L19 6" />
                  </svg>
                </span>
                {h}
              </li>
            ))}
          </ul>

          <div className="pt-2 border-t border-line">
            {[
              { id: 'description', title: 'Description', body: product.description ?? 'No description provided.' },
              { id: 'materials', title: 'Materials',
                body: (product.materials && product.materials.length > 0)
                  ? product.materials.join(', ')
                  : (product.metalType ?? 'See product specifications.') },
              { id: 'details', title: 'Item details', body: [
                  product.whoMade && `Made by: ${WHO_MADE_LABEL[product.whoMade] ?? product.whoMade}`,
                  product.whenMade && `Made: ${WHEN_MADE_LABEL[product.whenMade] ?? product.whenMade}`,
                  product.productType && `Type: ${product.productType === 'FINISHED' ? 'Finished product' : 'Supply / material'}`,
                  product.shopSection && `Section: ${product.shopSection.name}`,
                ].filter(Boolean).join('\n') || 'No additional details.' },
              { id: 'shipping', title: 'Shipping & returns', body: product.returnPolicy
                  ? (product.returnPolicy.accepted
                      ? `${product.returnPolicy.days}-day returns from delivery${product.returnPolicy.buyerPaysReturn ? ' · buyer pays return shipping' : ' · seller pays return shipping'}.${product.returnPolicy.notes ? `\n\n${product.returnPolicy.notes}` : ''}`
                      : `This shop does not accept returns on this item.${product.returnPolicy.notes ? `\n\n${product.returnPolicy.notes}` : ''}`)
                  : 'Ships in 2 business days.' },
              ...(product.warranty ? [{ id: 'warranty', title: 'Warranty', body: product.warranty }] : []),
            ].map((s) => (
              <div key={s.id} className="border-b border-line">
                <button onClick={() => setOpenSection((o) => (o === s.id ? '' : s.id))}
                  className="w-full flex items-center justify-between py-3.5 text-sm font-semibold text-ink-900">
                  {s.title}
                  <span className="text-ink-500">{openSection === s.id ? '−' : '+'}</span>
                </button>
                {openSection === s.id && (
                  <p className="pb-4 text-sm text-ink-700 whitespace-pre-line">{s.body}</p>
                )}
              </div>
            ))}
          </div>

          {product.certificateImageUrl && (
            <div className="pt-3">
              <a href={product.certificateImageUrl} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-line bg-canvas text-sm font-semibold text-ink-900 hover:border-brand-700 hover:text-brand-700 transition">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M9 9h6M9 13h6M9 17h4" />
                </svg>
                View certificate ↗
              </a>
            </div>
          )}

          {product.tags && product.tags.length > 0 && (
            <div className="pt-3">
              <p className="text-xs uppercase tracking-wide font-semibold text-ink-700 mb-2">Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {product.tags.map((t) => (
                  <span key={t} className="text-xs px-2.5 py-1 rounded-full bg-canvas border border-line text-ink-700">#{t}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Reviews */}
      <div className="mt-16 border-t border-line pt-10">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-display text-ink-900">
            Customer Reviews
            {reviewCount > 0 && <span className="ml-2 text-lg text-ink-500 font-normal">({reviewCount})</span>}
          </h2>
          {canReview && !showForm && (
            <button onClick={() => setShowForm(true)} className="btn-primary !px-5 !py-2.5 text-sm">Write a Review</button>
          )}
          {alreadyReviewed && <span className="text-sm text-success font-medium">✓ You've reviewed this product</span>}
        </div>

        {reviewsData && reviewCount > 0 && (
          <div className="grid md:grid-cols-[200px_1fr] gap-8 mb-10 p-6 bg-canvas rounded-lg border border-line">
            <div className="text-center">
              <p className="text-5xl font-bold text-ink-900">{avgRating.toFixed(1)}</p>
              <Stars value={avgRating} size={20} />
              <p className="text-sm text-ink-500 mt-1">{reviewCount} review{reviewCount !== 1 ? 's' : ''}</p>
            </div>
            <div className="space-y-2 justify-center flex flex-col">
              {[5, 4, 3, 2, 1].map((star) => (
                <RatingBar key={star} star={star} count={reviewsData.ratingBreakdown[star] ?? 0} total={reviewCount} />
              ))}
            </div>
          </div>
        )}

        {showForm && (
          <div className="mb-10 p-6 bg-white border border-line rounded-lg">
            <h3 className="font-semibold text-ink-900 mb-4">Your Review</h3>
            <form onSubmit={submitReview} className="space-y-4">
              <div>
                <label className="block text-xs uppercase tracking-wide font-semibold text-ink-700 mb-2">Rating *</label>
                <StarSelector value={reviewForm.rating} onChange={(v) => setReviewForm({ ...reviewForm, rating: v })} />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wide font-semibold text-ink-700 mb-1.5">Title</label>
                <input className="input-field" placeholder="Summarise your experience" maxLength={120}
                  value={reviewForm.title} onChange={(e) => setReviewForm({ ...reviewForm, title: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wide font-semibold text-ink-700 mb-1.5">Review</label>
                <textarea className="input-field h-28 py-3" placeholder="What did you like or dislike? How was the quality?"
                  maxLength={2000} value={reviewForm.body} onChange={(e) => setReviewForm({ ...reviewForm, body: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wide font-semibold text-ink-700 mb-1.5">
                  Photos / Videos <span className="font-normal text-ink-500">(up to 4)</span>
                </label>
                <label className="block border-2 border-dashed border-line rounded-md p-4 text-center cursor-pointer hover:border-brand-600 transition">
                  <input type="file" accept="image/*,video/*" multiple className="hidden"
                    onChange={(e) => setReviewFiles(Array.from(e.target.files || []).slice(0, 4))} />
                  <p className="text-sm text-ink-700"><span className="text-brand-700 font-semibold">Click to upload</span> images or videos</p>
                  <p className="text-xs text-ink-500 mt-0.5">JPG, PNG, MP4 · Max 50 MB each</p>
                </label>
                {reviewFiles.length > 0 && (
                  <div className="mt-2 flex gap-2 flex-wrap">
                    {reviewFiles.map((f, i) => (
                      <div key={i} className="relative w-20 h-20 bg-canvas rounded-md overflow-hidden border border-line">
                        {f.type.startsWith('video/') ? (
                          <video src={URL.createObjectURL(f)} className="w-full h-full object-cover" />
                        ) : (
                          <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
                        )}
                        <button type="button" onClick={() => setReviewFiles((arr) => arr.filter((_, j) => j !== i))}
                          className="absolute top-0.5 right-0.5 w-5 h-5 bg-white/90 rounded-full text-xs text-ink-900">×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {reviewErr && <p className="text-danger text-sm">{reviewErr}</p>}
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={reviewLoading} className="btn-primary !px-6">
                  {reviewLoading ? 'Submitting…' : 'Submit Review'}
                </button>
                <button type="button" onClick={() => { setShowForm(false); setReviewErr(''); }} className="btn-secondary !px-6">Cancel</button>
              </div>
            </form>
          </div>
        )}

        {reviewSuccess && (
          <div className="mb-6 p-4 bg-green-50 border border-green-100 rounded-md text-success text-sm">
            ✓ Your review has been published. Thank you!
          </div>
        )}

        {reviewCount === 0 && !showForm ? (
          <div className="text-center py-12 text-ink-500">
            <p className="text-lg mb-1">No reviews yet</p>
            <p className="text-sm">Be the first to share your experience with this product.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {reviewsData?.reviews.map((review) => (
              <div key={review.id} className="border-b border-line pb-6 last:border-0">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-brand-50 text-brand-700 font-bold flex items-center justify-center shrink-0 text-sm">
                    {review.customer.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-semibold text-sm text-ink-900">{review.customer.name.split(' ')[0]}</span>
                      <Stars value={review.rating} size={14} />
                      <span className="text-xs text-ink-500">
                        {new Date(review.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                    {review.title && <p className="font-semibold text-sm text-ink-900 mt-1">{review.title}</p>}
                    {review.body && <p className="text-sm text-ink-700 mt-1 whitespace-pre-line">{review.body}</p>}
                  </div>
                </div>
                {review.mediaUrls.length > 0 && (
                  <div className="flex gap-2 flex-wrap ml-13 pl-13">
                    {review.mediaUrls.map((url, i) => (
                      <div key={i} className="w-24 h-24 rounded-md overflow-hidden bg-canvas border border-line">
                        {review.mediaTypes[i] === 'video'
                          ? <video src={url} controls className="w-full h-full object-cover" />
                          : <img src={url} alt="" className="w-full h-full object-cover" />}
                      </div>
                    ))}
                  </div>
                )}
                {review.vendorResponse && (
                  <div className="mt-3 ml-13 pl-3 border-l-2 border-brand-200">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs uppercase tracking-wide font-semibold text-brand-700">
                        Response from {product.vendor.shopName}
                      </span>
                      {review.vendorRespondedAt && (
                        <span className="text-xs text-ink-500">
                          · {new Date(review.vendorRespondedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-ink-700 whitespace-pre-line">{review.vendorResponse}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <ProductQA productId={product.id} />
      <ProductRail title="You may also like" subtitle="More from the same category" items={related} />
      <ProductRail title="Recently viewed" items={recentlyViewed} />

      <div className={`md:hidden fixed inset-x-0 bottom-0 z-40 bg-surface border-t border-line shadow-pop transition-transform ${stickyVisible ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="px-4 py-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-ink-500">Price</p>
            <p className="font-bold text-ink-900 truncate">{formatPrice(effectivePrice, code)}</p>
          </div>
          <button onClick={() => addToCart(false)} disabled={!inStock} className="btn-primary !py-2 !px-4 text-sm">Add</button>
          <button onClick={() => addToCart(true)} disabled={!inStock} className="btn-secondary !py-2 !px-4 text-sm">Buy now</button>
        </div>
      </div>
    </div>
  );
}
