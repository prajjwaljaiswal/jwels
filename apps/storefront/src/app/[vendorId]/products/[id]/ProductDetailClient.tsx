'use client';

// Storefront PDP route — chooses between the block-rendered PDP (when the
// vendor has a published system PDP page) and the legacy hard-coded layout.
//
// The system-page payload is the same shape returned by /api/storefront-pages.
// If it's missing (most vendors will not have one initially), we fall back to
// LegacyVendorProductDetailPage without changing any UX.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { addToCartWithVendorGuard } from '@/lib/cart';
import { useVendor, useStoreReveal } from '@/lib/vendor-context';
import { BlockRenderer } from '@/components/blocks/BlockRenderer';
import { PdpProvider, type PdpProduct, type PdpReviewsData } from '@/components/blocks/pdp/PdpContext';
import { LegacyVendorProductDetailPage } from './LegacyPdpLayout';

interface SystemPagePayload {
  id: string;
  vendorId: string;
  blocks: any[];
}

export default function VendorProductDetailRoute({ params }: { params: { vendorId: string; id: string } }) {
  const [systemPage, setSystemPage] = useState<SystemPagePayload | null | undefined>(undefined);
  const { vendor } = useVendor();

  // Probe once for a published PDP system page using the vendor UUID (more reliable than the URL slug).
  useEffect(() => {
    if (!vendor?.id) return;
    api<SystemPagePayload>(
      `/api/storefront-pages/${vendor.id}/system/PDP`,
      { auth: false, silent: true },
    )
      .then((p) => setSystemPage(p))
      .catch(() => setSystemPage(null));
  }, [vendor?.id]);

  // undefined = probe in flight → cheap skeleton (avoids legacy fetching + remount)
  if (systemPage === undefined) {
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
  // null = no published PDP layout → legacy hard-coded design
  if (systemPage === null) {
    return <LegacyVendorProductDetailPage params={params} />;
  }
  return <BlockRenderedPdp params={params} blocks={systemPage.blocks} />;
}

function BlockRenderedPdp({
  params,
  blocks,
}: {
  params: { vendorId: string; id: string };
  blocks: any[];
}) {
  const router = useRouter();
  const { vendor, theme, themeConfig, storeKey } = useVendor();
  const reveal = useStoreReveal();
  const [product, setProduct] = useState<PdpProduct | null>(null);
  const [reviewsData, setReviewsData] = useState<PdpReviewsData | null>(null);
  const [canReview, setCanReview] = useState(false);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);

  const reloadReviews = useCallback(async () => {
    const data = await api<PdpReviewsData>(`/api/reviews/product/${params.id}`, { auth: false });
    setReviewsData(data);
  }, [params.id]);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    api<PdpProduct>(`/api/products/${params.id}`, { auth: false })
      .then(setProduct)
      .catch(() => router.push(`/${params.vendorId}`));
    reloadReviews().catch(() => {});
    if (token) {
      api<{ canReview: boolean; alreadyReviewed: boolean }>(`/api/reviews/can-review/${params.id}`)
        .then((d) => { setCanReview(d.canReview); setAlreadyReviewed(d.alreadyReviewed); })
        .catch(() => {});
    }
  }, [params.id, params.vendorId, router, reloadReviews]);

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

  function handleAddToCart({
    qty,
    selectedCombo,
    variationLabel,
    buyNow,
  }: {
    qty: number;
    selectedCombo: any;
    variationLabel: string | undefined;
    personalizationText: string;
    buyNow: boolean;
  }) {
    if (!product) return;
    const variations = product.variations ?? [];
    if (variations.length > 0 && !selectedCombo) {
      toast.error('Please select all variations');
      return;
    }
    const effectivePrice = selectedCombo?.price != null ? Number(selectedCombo.price) : Number(product.price ?? 0);
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

  const WIDE_BLOCKS = new Set(['pdpReviews', 'pdpRelatedProducts', 'richText', 'faq']);
  const splitIdx = blocks.findIndex((b) => WIDE_BLOCKS.has(b.type));
  const heroBlocks = splitIdx === -1 ? blocks : blocks.slice(0, splitIdx);
  const wideBlocks = splitIdx === -1 ? [] : blocks.slice(splitIdx);

  const galleryBlocks = heroBlocks.filter((b) => b.type === 'pdpGallery');
  const infoBlocks = heroBlocks.filter((b) => b.type !== 'pdpGallery');

  const ctx = { scope: 'vendor' as const, vendorId: vendor.id, pageKind: 'PDP' as const };

  return (
    <PdpProvider
      product={product}
      theme={theme}
      themeConfig={themeConfig}
      storeKey={storeKey}
      reviewsData={reviewsData}
      canReview={canReview}
      alreadyReviewed={alreadyReviewed}
      reloadReviews={reloadReviews}
      markReviewed={() => { setCanReview(false); setAlreadyReviewed(true); }}
      addToCart={handleAddToCart}
    >
      <div className="max-w-6xl mx-auto px-6 py-8">
        <nav className="text-xs text-ink-500 mb-5">
          <Link href={`/${storeKey}`} className="hover:opacity-70" style={{ color: theme }}>{vendor.shopName}</Link>
          <span className="mx-1.5">/</span>
          <span className="text-ink-700">{product.category.name}</span>
          <span className="mx-1.5">/</span>
          <span className="text-ink-900">{product.name}</span>
        </nav>

        <div className="grid lg:grid-cols-[1fr_440px] gap-10">
          <div>
            <BlockRenderer blocks={galleryBlocks} ctx={ctx} />
          </div>
          <div className="self-start space-y-2">
            <BlockRenderer blocks={infoBlocks} ctx={ctx} />
          </div>
        </div>

        {wideBlocks.length > 0 && (
          <div className="mt-10">
            {/* Reveal the below-the-fold sections (reviews, related, FAQ); the
                gallery + buy box above stay instant so the product is never hidden. */}
            <BlockRenderer blocks={wideBlocks} ctx={ctx} reveal={reveal} />
          </div>
        )}
      </div>
    </PdpProvider>
  );
}
