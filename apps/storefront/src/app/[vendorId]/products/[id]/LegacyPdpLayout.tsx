'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { useCart, addToCartWithVendorGuard } from '@/lib/cart';
import { useVendor } from '@/lib/vendor-context';
import { useCurrency, formatPrice } from '@/lib/currency';
import { Stars } from '@/components/storefront/ProductCard';
import { ProductGallery } from '@/components/products/ProductGallery';

interface VariationOption { id: string; value: string; position: number }
interface Variation { id: string; name: string; position: number; options: VariationOption[] }
interface VariationCombo { id: string; optionIds: string[]; price: string | null; stock: number; sku: string | null }

interface Product {
  id: string;
  name: string;
  description: string | null;
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
  videoUrl?: string | null;
  vendor: { id: string; shopName: string; shopLogoUrl: string | null };
  attributeValues: { attribute: { id: string; name: string; inputType: string }; value: string }[];
  variations?: Variation[];
  variationCombos?: VariationCombo[];
  returnPolicy?: { id: string; name: string; accepted: boolean; days: number; buyerPaysReturn: boolean; notes: string | null } | null;
  shopSection?:  { id: string; name: string; slug: string } | null;
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

const HIGHLIGHTS = [
  'BIS-hallmarked materials',
  'Ships in 2 business days',
  '30-day easy returns',
  'Certified vendor',
];

function StarSelector({ value, onChange, theme }: { value: number; onChange: (v: number) => void; theme: string }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          className="text-2xl leading-none transition-transform hover:scale-110"
        >
          <span style={{ color: (hovered || value) >= star ? '#f59e0b' : '#d6d3d1' }}>★</span>
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

export function LegacyVendorProductDetailPage({ params }: { params: { vendorId: string; id: string } }) {
  const router = useRouter();
  const { code } = useCurrency();
  const { vendor, theme, storeKey, themeConfig } = useVendor();
  const t = themeConfig;
  const [product, setProduct] = useState<Product | null>(null);
  const [qty, setQty] = useState(1);
  const [openSection, setOpenSection] = useState<string>('description');
  // variationId → selected optionId
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

  async function loadReviews(productId: string) {
    const data = await api<ReviewsData>(`/api/reviews/product/${productId}`, { auth: false });
    setReviewsData(data);
  }

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    api<Product>(`/api/products/${params.id}`, { auth: false })
      .then(setProduct)
      .catch(() => router.push(`/${params.vendorId}`));

    loadReviews(params.id);

    if (token) {
      api<{ canReview: boolean; alreadyReviewed: boolean }>(`/api/reviews/can-review/${params.id}`)
        .then((d) => { setCanReview(d.canReview); setAlreadyReviewed(d.alreadyReviewed); })
        .catch(() => {});
    }
  }, [params.id, params.vendorId, router]);

  if (!product) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-10 grid md:grid-cols-2 gap-10">
        <div className="aspect-square bg-stone-100 rounded-md animate-pulse" />
        <div className="space-y-3">
          <div className="h-4 w-32 bg-stone-100 rounded animate-pulse" />
          <div className="h-8 w-3/4 bg-stone-100 rounded animate-pulse" />
          <div className="h-6 w-24 bg-stone-100 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  // Resolved combo from selected options (only relevant when product has variations)
  const variations = product?.variations ?? [];
  const allVariationsPicked = variations.length > 0
    && variations.every((v) => selectedOpts[v.id]);
  const selectedCombo = (product && allVariationsPicked)
    ? product.variationCombos?.find((c) => {
        const wantIds = variations.map((v) => selectedOpts[v.id]);
        return c.optionIds.length === wantIds.length
          && wantIds.every((id) => c.optionIds.includes(id));
      })
    : undefined;

  const effectivePrice = selectedCombo?.price != null
    ? Number(selectedCombo.price)
    : Number(product?.price ?? 0);
  const effectiveStock = variations.length > 0
    ? (selectedCombo?.stock ?? 0)
    : (product?.stockQuantity ?? 0);
  const variationLabel = (() => {
    if (!product || !allVariationsPicked) return undefined;
    return variations.map((v) => {
      const o = v.options.find((opt) => opt.id === selectedOpts[v.id]);
      return `${v.name}: ${o?.value ?? ''}`;
    }).join(' · ');
  })();

  function addToCart(buyNow = false) {
    if (!product) return;
    if (variations.length > 0 && !allVariationsPicked) {
      toast.error('Please select all variations');
      return;
    }
    if (variations.length > 0 && !selectedCombo) {
      toast.error('That combination is unavailable');
      return;
    }
    const ok = addToCartWithVendorGuard(
      {
        productId: product.id,
        name: product.name,
        price: effectivePrice,
        image: product.images[0] || '',
        vendorId: vendor.id,
        vendorName: vendor.shopName,
        variationComboId: selectedCombo?.id,
        variationLabel,
      },
      qty,
    );
    if (!ok) return;
    if (buyNow) router.push(`/${storeKey}/checkout`);
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

  return (
    <div className="max-w-6xl mx-auto px-6 py-8" style={{ color: t.colors.text }}>
      <nav className="text-xs text-ink-500 mb-5">
        <Link href={`/${storeKey}`} className="hover:opacity-70" style={{ color: theme }}>{vendor.shopName}</Link>
        <span className="mx-1.5">/</span>
        <span className="text-ink-700">{product.category.name}</span>
        <span className="mx-1.5">/</span>
        <span className="text-ink-900">{product.name}</span>
      </nav>

      <div className="grid lg:grid-cols-[1fr_440px] gap-10">
        {/* GALLERY */}
        <ProductGallery name={product.name} images={product.images} videoUrl={product.videoUrl} />

        {/* INFO */}
        <div className="lg:sticky lg:top-32 self-start space-y-5 rounded-xl p-5"
          style={{ background: t.colors.background, color: t.colors.text }}>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm" style={{ color: theme }}>{vendor.shopName}</span>
              {product.shopSection && (
                <>
                  <span className="text-ink-400 text-xs">·</span>
                  <span className="text-xs text-ink-500">{product.shopSection.name}</span>
                </>
              )}
              {product.featured && (
                <span className="text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full" style={{ background: `${theme}15`, color: theme }}>Featured</span>
              )}
              {product.acceptsOffers && (
                <span className="text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Accepts offers</span>
              )}
            </div>
            <h1 className="font-display text-3xl md:text-4xl text-ink-900 mt-2 leading-tight">{product.name}</h1>
            <div className="flex items-center gap-2 mt-2">
              <Stars value={avgRating} size={16} />
              <span className="text-sm text-ink-700">{avgRating > 0 ? avgRating.toFixed(1) : '—'}</span>
              <span className="text-sm text-ink-500">· {reviewCount} review{reviewCount !== 1 ? 's' : ''}</span>
            </div>
          </div>

          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold text-ink-900">{formatPrice(effectivePrice, code)}</span>
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
                      // Disable options that have no in-stock combo when paired with current other selections
                      const wouldBeSelection = { ...selectedOpts, [v.id]: o.id };
                      const reachable = product.variationCombos?.some((c) => {
                        return variations.every((vv) => {
                          const wantedId = wouldBeSelection[vv.id];
                          return wantedId ? c.optionIds.includes(wantedId) : true;
                        }) && c.stock > 0;
                      });
                      return (
                        <button
                          key={o.id}
                          type="button"
                          onClick={() => setSelectedOpts({ ...selectedOpts, [v.id]: o.id })}
                          disabled={!reachable}
                          className="rounded-pill border px-4 py-1.5 text-sm font-medium transition disabled:opacity-40 disabled:line-through"
                          style={active
                            ? { borderColor: theme, color: theme, background: `${theme}18`, borderWidth: 2 }
                            : { borderColor: `color-mix(in srgb, ${t.colors.text} 20%, transparent)`, color: t.colors.text, background: t.colors.background }}
                        >
                          {o.value}
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
                  <button className="rounded-pill border bg-white px-4 py-1.5 text-sm font-medium" style={{ borderColor: theme, color: theme }}>{av.value}</button>
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
              <textarea
                className="input-field h-20 py-2"
                maxLength={product.personalization.charLimit}
                placeholder={`Up to ${product.personalization.charLimit} characters`}
                value={personalizationText}
                onChange={(e) => setPersonalizationText(e.target.value)}
              />
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
            <p className="text-xs mt-2" style={{ color: inStock ? '#059669' : '#dc2626' }}>
              {variations.length > 0 && !allVariationsPicked
                ? 'Select all variations to see stock'
                : inStock ? `${effectiveStock} in stock — ready to ship` : 'Out of stock'}
            </p>
          </div>

          <div className="space-y-2 pt-2">
            <button
              onClick={() => addToCart(false)}
              disabled={!inStock}
              className="w-full py-3 rounded-pill text-white font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: theme }}
            >
              Add to cart
            </button>
            <button
              onClick={() => addToCart(true)}
              disabled={!inStock}
              className="w-full py-3 rounded-pill bg-white border-2 font-semibold transition-colors hover:bg-canvas disabled:opacity-50"
              style={{ borderColor: theme, color: theme }}
            >
              Buy it now
            </button>
          </div>

          <ul className="space-y-2 pt-2">
            {HIGHLIGHTS.map((h) => (
              <li key={h} className="flex items-center gap-2 text-sm text-ink-700">
                <span style={{ color: theme }}>
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
              { id: 'materials', title: 'Materials', body: (product.materials && product.materials.length > 0)
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

      {/* REVIEWS */}
      <div className="mt-16 border-t border-line pt-10">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-display text-ink-900">
            Customer Reviews
            {reviewCount > 0 && <span className="ml-2 text-lg text-ink-500 font-normal">({reviewCount})</span>}
          </h2>
          {canReview && !showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="px-5 py-2.5 rounded-pill text-white text-sm font-semibold hover:opacity-90"
              style={{ background: theme }}
            >
              Write a Review
            </button>
          )}
          {alreadyReviewed && (
            <span className="text-sm font-medium" style={{ color: theme }}>✓ You've reviewed this product</span>
          )}
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
          <div className="mb-10 p-6 border border-line rounded-lg" style={{ background: t.colors.background }}>
            <h3 className="font-semibold text-ink-900 mb-4">Your Review</h3>
            <form onSubmit={submitReview} className="space-y-4">
              <div>
                <label className="block text-xs uppercase tracking-wide font-semibold text-ink-700 mb-2">Rating *</label>
                <StarSelector value={reviewForm.rating} onChange={(v) => setReviewForm({ ...reviewForm, rating: v })} theme={theme} />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wide font-semibold text-ink-700 mb-1.5">Title</label>
                <input
                  className="input-field"
                  placeholder="Summarise your experience"
                  maxLength={120}
                  value={reviewForm.title}
                  onChange={(e) => setReviewForm({ ...reviewForm, title: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wide font-semibold text-ink-700 mb-1.5">Review</label>
                <textarea
                  className="input-field h-28 py-3"
                  placeholder="What did you like or dislike?"
                  maxLength={2000}
                  value={reviewForm.body}
                  onChange={(e) => setReviewForm({ ...reviewForm, body: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wide font-semibold text-ink-700 mb-1.5">
                  Photos / Videos <span className="font-normal text-ink-500">(up to 4)</span>
                </label>
                <label className="block border-2 border-dashed border-line rounded-md p-4 text-center cursor-pointer hover:opacity-80 transition">
                  <input
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    className="hidden"
                    onChange={(e) => setReviewFiles(Array.from(e.target.files || []).slice(0, 4))}
                  />
                  <p className="text-sm text-ink-700">
                    <span className="font-semibold" style={{ color: theme }}>Click to upload</span> images or videos
                  </p>
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
                        <button
                          type="button"
                          onClick={() => setReviewFiles((arr) => arr.filter((_, j) => j !== i))}
                          className="absolute top-0.5 right-0.5 w-5 h-5 bg-white/90 rounded-full text-xs text-ink-900"
                        >×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {reviewErr && <p className="text-sm" style={{ color: '#dc2626' }}>{reviewErr}</p>}
              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={reviewLoading}
                  className="px-6 py-2.5 rounded-pill text-white font-semibold hover:opacity-90 disabled:opacity-50"
                  style={{ background: theme }}
                >
                  {reviewLoading ? 'Submitting…' : 'Submit Review'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setReviewErr(''); }}
                  className="px-6 py-2.5 rounded-pill bg-white border-2 font-semibold hover:bg-canvas"
                  style={{ borderColor: theme, color: theme }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {reviewSuccess && (
          <div className="mb-6 p-4 rounded-md text-sm" style={{ background: `${theme}15`, color: theme, border: `1px solid ${theme}40` }}>
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
                  <div
                    className="w-10 h-10 rounded-full font-bold flex items-center justify-center shrink-0 text-sm text-white"
                    style={{ background: theme }}
                  >
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
                  <div className="flex gap-2 flex-wrap pl-13 ml-13">
                    {review.mediaUrls.map((url, i) => (
                      <div key={i} className="w-24 h-24 rounded-md overflow-hidden bg-canvas border border-line">
                        {review.mediaTypes[i] === 'video' ? (
                          <video src={url} controls className="w-full h-full object-cover" />
                        ) : (
                          <img src={url} alt="" className="w-full h-full object-cover" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
