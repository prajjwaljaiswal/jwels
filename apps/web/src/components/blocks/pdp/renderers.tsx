'use client';

// Live renderers for the 11 PDP blocks. Each consumes <PdpProvider> via usePdp().
// Inside the page-editor preview (no provider) they render a labelled fallback
// so vendors still see structure.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { ProductGallery } from '@/components/products/ProductGallery';
import { ProductCard, Stars } from '@/components/storefront/ProductCard';
import { usePdp, PdpFallback } from './PdpContext';
import { useCurrency, formatPrice } from '@/lib/currency';

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

// ── Gallery ─────────────────────────────────────────────────────────────────
export function PdpGalleryRenderer({ settings }: { settings: any; ctx: any }) {
  const pdp = usePdp();
  if (!pdp) return <PdpFallback label="Product gallery" hint="Main image and thumbnails appear here." />;
  return (
    <div className={settings?.position === 'right' ? 'order-2' : ''}>
      <ProductGallery name={pdp.product.name} images={pdp.product.images} videoUrl={pdp.product.videoUrl ?? undefined} />
    </div>
  );
}

// ── Summary (vendor name, title, rating) ────────────────────────────────────
export function PdpSummaryRenderer({ settings }: { settings: any; ctx: any }) {
  const { code } = useCurrency();
  const pdp = usePdp();
  if (!pdp) return <PdpFallback label="Product summary" hint="Title, vendor, rating, price." />;
  const { product, theme, reviewsData } = pdp;
  const avg = reviewsData?.averageRating ?? 0;
  const count = reviewsData?.total ?? 0;
  return (
    <div>
      <div className="flex items-center gap-2 flex-wrap">
        {settings?.showVendor !== false && (
          <span className="text-sm" style={{ color: theme }}>{product.vendor.shopName}</span>
        )}
        {product.shopSection && (
          <>
            <span className="text-ink-400 text-xs">·</span>
            <span className="text-xs text-ink-500">{product.shopSection.name}</span>
          </>
        )}
        {product.featured && (
          <span className="text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full" style={{ background: `${theme}15`, color: theme }}>
            Featured
          </span>
        )}
      </div>
      <h1 className="font-display text-3xl md:text-4xl text-ink-900 mt-2 leading-tight">{product.name}</h1>
      {settings?.showRating !== false && (
        <div className="flex items-center gap-2 mt-2">
          <Stars value={avg} size={16} />
          <span className="text-sm text-ink-700">{avg > 0 ? avg.toFixed(1) : '—'}</span>
          <span className="text-sm text-ink-500">· {count} review{count !== 1 ? 's' : ''}</span>
        </div>
      )}
      <div className="flex items-baseline gap-3 mt-4">
        <span className="text-3xl font-bold text-ink-900">{formatPrice(pdp.effectivePrice, code)}</span>
        <span className="text-sm text-ink-500">incl. of all taxes</span>
      </div>
    </div>
  );
}

// ── Variants ────────────────────────────────────────────────────────────────
export function PdpVariantsRenderer({ settings }: { settings: any; ctx: any }) {
  const pdp = usePdp();
  if (!pdp) return <PdpFallback label="Variant picker" hint="Size/metal/stone selector." />;
  const { product, theme, selectedOpts, setSelectedOpts } = pdp;
  const variations = product.variations ?? [];
  if (variations.length === 0) return null;
  return (
    <div className="space-y-3 mt-5">
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
              const wouldBe = { ...selectedOpts, [v.id]: o.id };
              const reachable = product.variationCombos?.some((c) =>
                variations.every((vv) => {
                  const wantedId = wouldBe[vv.id];
                  return wantedId ? c.optionIds.includes(wantedId) : true;
                }) && c.stock > 0,
              );
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setSelectedOpts({ ...selectedOpts, [v.id]: o.id })}
                  disabled={!reachable}
                  className="rounded-pill border bg-white px-4 py-1.5 text-sm font-medium transition disabled:opacity-40 disabled:line-through"
                  style={active
                    ? { borderColor: theme, color: theme, background: `${theme}10`, borderWidth: 2 }
                    : { borderColor: '#e5e7eb', color: '#374151' }}
                >
                  {o.value}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {settings?.showSizeGuide && settings?.sizeGuideUrl && (
        <a href={settings.sizeGuideUrl} target="_blank" rel="noreferrer" className="text-xs underline" style={{ color: theme }}>
          Size guide
        </a>
      )}
    </div>
  );
}

// ── Quantity + Add to cart ──────────────────────────────────────────────────
export function PdpQuantityCartRenderer({ settings }: { settings: any; ctx: any }) {
  const pdp = usePdp();
  if (!pdp) return <PdpFallback label="Quantity + add to cart" hint="Qty stepper, Add to bag, Buy now." />;
  const { product, theme, qty, setQty, effectiveStock, inStock, addToCart } = pdp;
  const variations = product.variations ?? [];
  const allPicked = variations.length === 0 || variations.every((v) => pdp.selectedOpts[v.id]);
  return (
    <div className="mt-5 space-y-3">
      <div>
        <p className="text-xs uppercase tracking-wide font-semibold text-ink-700 mb-2">Quantity</p>
        <div className="inline-flex items-center border border-line rounded-pill overflow-hidden">
          <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-10 h-10 hover:bg-canvas">−</button>
          <span className="w-10 text-center text-sm font-semibold">{qty}</span>
          <button onClick={() => setQty(Math.min(effectiveStock || 99, qty + 1))} className="w-10 h-10 hover:bg-canvas">+</button>
        </div>
        <p className="text-xs mt-2" style={{ color: inStock ? '#059669' : '#dc2626' }}>
          {!allPicked
            ? 'Select all variations to see stock'
            : inStock ? `${effectiveStock} in stock — ready to ship` : 'Out of stock'}
        </p>
      </div>
      <button
        onClick={() => addToCart(false)}
        disabled={!inStock}
        className="w-full py-3 rounded-pill text-white font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ background: theme }}
      >
        {settings?.ctaLabel || 'Add to bag'}
      </button>
      {settings?.showBuyNow !== false && (
        <button
          onClick={() => addToCart(true)}
          disabled={!inStock}
          className="w-full py-3 rounded-pill bg-white border-2 font-semibold transition-colors hover:bg-canvas disabled:opacity-50"
          style={{ borderColor: theme, color: theme }}
        >
          Buy it now
        </button>
      )}
    </div>
  );
}

// ── Attributes table ────────────────────────────────────────────────────────
export function PdpAttributesRenderer({ settings }: { settings: any; ctx: any }) {
  const pdp = usePdp();
  if (!pdp) return <PdpFallback label="Attribute table" hint="Material, weight, hallmark…" />;
  const items = pdp.product.attributeValues ?? [];
  if (items.length === 0) return null;
  return (
    <div className="mt-6">
      {settings?.heading && <h3 className="text-sm font-semibold text-ink-900 mb-3">{settings.heading}</h3>}
      <dl className="grid grid-cols-2 gap-y-2 text-sm">
        {items.map((av) => (
          <div key={av.attribute.id} className="contents">
            <dt className="text-ink-500">{av.attribute.name}</dt>
            <dd className="text-ink-900">{av.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// ── Description ─────────────────────────────────────────────────────────────
export function PdpDescriptionRenderer({ settings }: { settings: any; ctx: any }) {
  const pdp = usePdp();
  if (!pdp) return <PdpFallback label="Long description" hint="About this piece." />;
  const product = pdp.product;
  const desc = product.description ?? 'No description provided.';
  return (
    <div className="mt-6">
      {settings?.heading && <h3 className="text-sm font-semibold text-ink-900 mb-2">{settings.heading}</h3>}
      <p className="text-sm text-ink-700 whitespace-pre-line">{desc}</p>
      {product.materials && product.materials.length > 0 && (
        <p className="mt-3 text-sm text-ink-700"><strong>Materials:</strong> {product.materials.join(', ')}</p>
      )}
      {product.whoMade && <p className="text-sm text-ink-700"><strong>Made by:</strong> {WHO_MADE_LABEL[product.whoMade] ?? product.whoMade}</p>}
      {product.whenMade && <p className="text-sm text-ink-700"><strong>Made:</strong> {WHEN_MADE_LABEL[product.whenMade] ?? product.whenMade}</p>}
    </div>
  );
}

// ── Personalization ─────────────────────────────────────────────────────────
export function PdpPersonalizationRenderer({ settings }: { settings: any; ctx: any }) {
  const pdp = usePdp();
  if (!pdp) return <PdpFallback label="Personalisation" hint="Engraving / custom requests." />;
  const p = pdp.product.personalization;
  if (!p?.enabled) return null;
  return (
    <div className="mt-5">
      <p className="text-xs uppercase tracking-wide font-semibold text-ink-700 mb-2">
        {settings?.heading || 'Personalisation'}{' '}
        <span className="text-ink-500 normal-case font-normal tracking-normal">(optional)</span>
      </p>
      <p className="text-xs text-ink-500 mb-2">{p.instructions}</p>
      <textarea
        className="input-field h-20 py-2"
        maxLength={p.charLimit}
        placeholder={`Up to ${p.charLimit} characters`}
        value={pdp.personalizationText}
        onChange={(e) => pdp.setPersonalizationText(e.target.value)}
      />
      <p className="text-[11px] text-ink-500 mt-1 text-right">
        {pdp.personalizationText.length} / {p.charLimit}
      </p>
    </div>
  );
}

// ── Reviews list + write form ───────────────────────────────────────────────
function StarSelector({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          className="text-2xl leading-none transition-transform hover:scale-110"
        >
          <span style={{ color: (hover || value) >= star ? '#f59e0b' : '#d6d3d1' }}>★</span>
        </button>
      ))}
    </div>
  );
}

export function PdpReviewsRenderer({ settings }: { settings: any; ctx: any }) {
  const pdp = usePdp();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ rating: 5, title: '', body: '' });
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  if (!pdp) return <PdpFallback label="Reviews" hint="List + write-a-review form." />;
  const { product, theme, reviewsData, canReview, alreadyReviewed, reloadReviews, markReviewed } = pdp;
  const count = reviewsData?.total ?? 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr('');
    try {
      const fd = new FormData();
      fd.append('productId', product.id);
      fd.append('rating', String(form.rating));
      if (form.title) fd.append('title', form.title);
      if (form.body) fd.append('body', form.body);
      files.forEach((f) => fd.append('media', f));
      await api('/api/reviews', { method: 'POST', body: fd });
      toast.success('Review published — thank you!');
      setShowForm(false);
      markReviewed();
      await reloadReviews();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-16 border-t border-line pt-10">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-display text-ink-900">
          {settings?.heading || 'Customer Reviews'}
          {count > 0 && <span className="ml-2 text-lg text-ink-500 font-normal">({count})</span>}
        </h2>
        {settings?.showWriteReview !== false && canReview && !showForm && (
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

      {showForm && (
        <form onSubmit={submit} className="mb-10 p-6 bg-white border border-line rounded-lg space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-wide font-semibold text-ink-700 mb-2">Rating</label>
            <StarSelector value={form.rating} onChange={(v) => setForm({ ...form, rating: v })} />
          </div>
          <input className="input-field" placeholder="Title (optional)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={120} />
          <textarea className="input-field h-28 py-3" placeholder="What did you think?" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} maxLength={2000} />
          <input type="file" multiple accept="image/*,video/*" onChange={(e) => setFiles(Array.from(e.target.files || []).slice(0, 4))} />
          {err && <p className="text-sm text-red-600">{err}</p>}
          <div className="flex gap-3">
            <button type="submit" disabled={loading} className="px-6 py-2.5 rounded-pill text-white font-semibold hover:opacity-90 disabled:opacity-50" style={{ background: theme }}>
              {loading ? 'Submitting…' : 'Submit Review'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-6 py-2.5 rounded-pill bg-white border-2 font-semibold" style={{ borderColor: theme, color: theme }}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {count === 0 ? (
        <div className="text-center py-12 text-ink-500">
          <p className="text-lg mb-1">No reviews yet</p>
          <p className="text-sm">Be the first to share your experience.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {reviewsData!.reviews.map((r) => (
            <div key={r.id} className="border-b border-line pb-6 last:border-0">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-full font-bold flex items-center justify-center shrink-0 text-sm text-white" style={{ background: theme }}>
                  {r.customer.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-semibold text-sm text-ink-900">{r.customer.name.split(' ')[0]}</span>
                    <Stars value={r.rating} size={14} />
                    <span className="text-xs text-ink-500">
                      {new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  {r.title && <p className="font-semibold text-sm text-ink-900 mt-1">{r.title}</p>}
                  {r.body && <p className="text-sm text-ink-700 mt-1 whitespace-pre-line">{r.body}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Related products ────────────────────────────────────────────────────────
export function PdpRelatedProductsRenderer({ settings }: { settings: any; ctx: any }) {
  const pdp = usePdp();
  const [items, setItems] = useState<any[] | null>(null);

  useEffect(() => {
    if (!pdp) return;
    const limit = settings?.limit ?? 8;
    api(`/api/products/${pdp.product.id}/related?limit=${limit}`, { auth: false })
      .then((d: any) => setItems(Array.isArray(d) ? d : (d.products ?? d.items ?? [])))
      .catch(() => setItems([]));
  }, [pdp?.product.id, settings?.limit]);

  if (!pdp) return <PdpFallback label="Related products" hint="Cross-sell strip." />;
  if (!items || items.length === 0) return null;
  const cols = settings?.columns ?? 4;
  const gridCls =
    cols === 2 ? 'grid-cols-2' : cols === 3 ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-2 md:grid-cols-4';
  return (
    <section className="mt-16">
      <h2 className="text-2xl font-display text-ink-900 mb-6">{settings?.heading || 'You may also love'}</h2>
      <div className={`grid ${gridCls} gap-4`}>
        {items.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}

// ── Trust strip ─────────────────────────────────────────────────────────────
export function PdpTrustStripRenderer({ settings }: { settings: any; ctx: any }) {
  const pdp = usePdp();
  const items: { iconUrl?: string; label: string; sublabel?: string }[] =
    (settings?.items && settings.items.length > 0)
      ? settings.items
      : [
          { label: 'BIS-hallmarked' },
          { label: 'Ships in 2 days' },
          { label: '30-day returns' },
          { label: 'Certified vendor' },
        ];
  const theme = pdp?.theme ?? '#F1641E';
  return (
    <ul className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map((it, i) => (
        <li key={i} className="flex items-center gap-2 text-sm text-ink-700">
          <span style={{ color: theme }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="m5 12 4 4L19 6" />
            </svg>
          </span>
          <div>
            <div className="font-medium">{it.label}</div>
            {it.sublabel && <div className="text-xs text-ink-500">{it.sublabel}</div>}
          </div>
        </li>
      ))}
    </ul>
  );
}

// ── Shipping estimator ──────────────────────────────────────────────────────
export function PdpShippingEstimatorRenderer({ settings }: { settings: any; ctx: any }) {
  const pdp = usePdp();
  const [pincode, setPincode] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!pdp) return <PdpFallback label="Delivery estimator" hint="Pincode → ETA widget." />;

  async function check() {
    if (!/^\d{6}$/.test(pincode)) {
      setResult('Please enter a 6-digit pincode');
      return;
    }
    setLoading(true);
    try {
      const r: any = await api(
        `/api/shipping/quote?pincode=${pincode}&productId=${pdp!.product.id}`,
        { auth: false, silent: true },
      ).catch(() => null);
      if (r?.etaDays) setResult(`Delivers in about ${r.etaDays} day${r.etaDays === 1 ? '' : 's'}`);
      else setResult('Delivers in 3–5 business days');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-5 border border-line rounded-md p-4">
      <p className="text-xs uppercase tracking-wide font-semibold text-ink-700 mb-2">
        {settings?.heading || 'Check delivery'}
      </p>
      <div className="flex gap-2">
        <input
          className="input-field flex-1"
          placeholder="Enter pincode"
          maxLength={6}
          value={pincode}
          onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        />
        <button
          onClick={check}
          disabled={loading}
          className="px-4 py-2 rounded-pill text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50"
          style={{ background: pdp.theme }}
        >
          {loading ? '…' : 'Check'}
        </button>
      </div>
      {result && <p className="mt-2 text-sm text-ink-700">{result}</p>}
    </div>
  );
}
