'use client';

// PDP block context — supplies the shared product, theme, ephemeral state
// (qty, selected variation options, personalisation text) and action handlers
// (addToCart, submitReview) to every PDP block rendered inside <PdpProvider>.
//
// Blocks themselves are pure UI consumers: they call usePdp() and render
// against the current shape, falling back to a friendly placeholder when the
// provider is absent (i.e. in the page-editor preview iframe).

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export interface PdpVariationOption { id: string; value: string; position: number }
export interface PdpVariation { id: string; name: string; position: number; options: PdpVariationOption[] }
export interface PdpVariationCombo { id: string; optionIds: string[]; price: string | null; stock: number; sku: string | null }

export interface PdpProduct {
  id: string;
  name: string;
  description: string | null;
  category: { id: string; name: string; slug: string };
  metalType: string | null;
  materials?: string[];
  tags?: string[];
  whenMade?: string | null;
  whoMade?: string | null;
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
  variations?: PdpVariation[];
  variationCombos?: PdpVariationCombo[];
  returnPolicy?: { id: string; name: string; accepted: boolean; days: number; buyerPaysReturn: boolean; notes: string | null } | null;
  shopSection?:  { id: string; name: string; slug: string } | null;
}

export interface PdpReview {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  mediaUrls: string[];
  mediaTypes: string[];
  createdAt: string;
  customer: { name: string };
}

export interface PdpReviewsData {
  reviews: PdpReview[];
  total: number;
  averageRating: number;
  ratingBreakdown: Record<number, number>;
  page: number;
  limit: number;
}

interface PdpState {
  product: PdpProduct;
  theme: string;
  storeKey: string;
  reviewsData: PdpReviewsData | null;
  canReview: boolean;
  alreadyReviewed: boolean;
  qty: number;
  setQty: (n: number) => void;
  selectedOpts: Record<string, string>;
  setSelectedOpts: (next: Record<string, string>) => void;
  personalizationText: string;
  setPersonalizationText: (s: string) => void;
  effectivePrice: number;
  effectiveStock: number;
  variationLabel: string | undefined;
  selectedCombo: PdpVariationCombo | undefined;
  inStock: boolean;
  addToCart: (buyNow?: boolean) => void;
  reloadReviews: () => Promise<void>;
  markReviewed: () => void;
}

const PdpContext = createContext<PdpState | null>(null);

export function usePdp(): PdpState | null {
  return useContext(PdpContext);
}

interface PdpProviderProps {
  product: PdpProduct;
  theme: string;
  storeKey: string;
  reviewsData: PdpReviewsData | null;
  canReview: boolean;
  alreadyReviewed: boolean;
  reloadReviews: () => Promise<void>;
  markReviewed: () => void;
  addToCart: (args: {
    qty: number;
    selectedCombo: PdpVariationCombo | undefined;
    variationLabel: string | undefined;
    personalizationText: string;
    buyNow: boolean;
  }) => void;
  children: ReactNode;
}

export function PdpProvider(props: PdpProviderProps) {
  const { product, theme, storeKey, reviewsData, canReview, alreadyReviewed, reloadReviews, markReviewed, addToCart, children } = props;
  const [qty, setQty] = useState(1);
  const [selectedOpts, setSelectedOpts] = useState<Record<string, string>>({});
  const [personalizationText, setPersonalizationText] = useState('');

  const value: PdpState = useMemo(() => {
    const variations = product.variations ?? [];
    const allPicked = variations.length > 0 && variations.every((v) => selectedOpts[v.id]);
    const selectedCombo = allPicked
      ? product.variationCombos?.find((c) => {
          const want = variations.map((v) => selectedOpts[v.id]);
          return c.optionIds.length === want.length && want.every((id) => c.optionIds.includes(id!));
        })
      : undefined;
    const effectivePrice = selectedCombo?.price != null ? Number(selectedCombo.price) : Number(product.price ?? 0);
    const effectiveStock = variations.length > 0 ? (selectedCombo?.stock ?? 0) : (product.stockQuantity ?? 0);
    const variationLabel = allPicked
      ? variations.map((v) => {
          const o = v.options.find((opt) => opt.id === selectedOpts[v.id]);
          return `${v.name}: ${o?.value ?? ''}`;
        }).join(' · ')
      : undefined;

    return {
      product,
      theme,
      storeKey,
      reviewsData,
      canReview,
      alreadyReviewed,
      qty,
      setQty,
      selectedOpts,
      setSelectedOpts,
      personalizationText,
      setPersonalizationText,
      effectivePrice,
      effectiveStock,
      variationLabel,
      selectedCombo,
      inStock: effectiveStock > 0,
      addToCart: (buyNow = false) =>
        addToCart({ qty, selectedCombo, variationLabel, personalizationText, buyNow }),
      reloadReviews,
      markReviewed,
    };
  }, [product, theme, storeKey, reviewsData, canReview, alreadyReviewed, qty, selectedOpts, personalizationText, addToCart, reloadReviews, markReviewed]);

  return <PdpContext.Provider value={value}>{children}</PdpContext.Provider>;
}

// Tiny helper for blocks that need a fallback when the provider isn't mounted
// (i.e. when rendered inside the page-editor preview).
export function PdpFallback({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="my-2 rounded-md border border-dashed border-ink-200 bg-canvas/40 px-4 py-6 text-sm">
      <div className="font-medium text-ink-800">{label}</div>
      {hint && <div className="mt-1 text-xs text-ink-500">{hint}</div>}
      <div className="mt-2 text-[11px] text-ink-500">Preview will populate from a real product on the storefront.</div>
    </div>
  );
}
