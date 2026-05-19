'use client';
// Shared factory for PDP / Cart / Checkout block scaffolding.
//
// Each surface-specific block lives here as a small Renderer + Editor pair.
// The renderers do two things:
//   1. If RenderContext supplies real data (product / cart / checkout state),
//      render the live UI.
//   2. Otherwise (in the page editor preview), render a labelled placeholder
//      so vendors can still see the layout structure.
//
// Editors expose only the settings declared in blockSchemas.ts. They use the
// shared <BlockSettingsForm /> patterns wherever possible.

import type { BlockDefinition, BlockType, PageKind, RenderContext } from '../types';
import {
  PdpGalleryRenderer,
  PdpSummaryRenderer,
  PdpVariantsRenderer,
  PdpQuantityCartRenderer,
  PdpAttributesRenderer,
  PdpDescriptionRenderer,
  PdpPersonalizationRenderer,
  PdpReviewsRenderer,
  PdpRelatedProductsRenderer,
  PdpTrustStripRenderer,
  PdpShippingEstimatorRenderer,
} from '../pdp/renderers';
import {
  CartLineItemsRenderer,
  CartSummaryRenderer,
  CartUpsellRenderer,
  CartTrustStripRenderer,
  CartAnnouncementRenderer,
} from '../cart/renderers';
import {
  PdpGalleryEditor, PdpSummaryEditor, PdpVariantsEditor, PdpQuantityCartEditor,
  PdpAttributesEditor, PdpDescriptionEditor, PdpPersonalizationEditor,
  PdpReviewsEditor, PdpRelatedProductsEditor, PdpTrustStripEditor, PdpShippingEstimatorEditor,
  CartLineItemsEditor, CartSummaryEditor, CartUpsellEditor, CartTrustStripEditor, CartAnnouncementEditor,
  CheckoutStepsEditor, CheckoutAddressFormEditor, CheckoutShippingEditor, CheckoutPaymentEditor,
  CheckoutOrderSummaryEditor, CheckoutGiftWrapEditor, CheckoutCustomFieldsEditor,
  CheckoutTrustStripEditor, CheckoutAnnouncementEditor,
} from './editors';
import {
  CheckoutStepsRenderer,
  CheckoutAddressFormRenderer,
  CheckoutShippingRenderer,
  CheckoutPaymentRenderer,
  CheckoutOrderSummaryRenderer,
  CheckoutGiftWrapRenderer,
  CheckoutCustomFieldsRenderer,
  CheckoutTrustStripRenderer,
  CheckoutAnnouncementRenderer,
} from '../checkout/renderers';

function PlaceholderCard({ label, hint, accent = '#F1641E' }: { label: string; hint?: string; accent?: string }) {
  return (
    <div className="my-2 rounded-md border border-dashed border-ink-200 bg-canvas/40 px-4 py-6 text-sm">
      <div className="flex items-center gap-2">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: accent }}
          aria-hidden
        />
        <span className="font-medium text-ink-800">{label}</span>
      </div>
      {hint && <div className="mt-1 text-xs text-ink-500">{hint}</div>}
    </div>
  );
}

// Tiny editor used by stub blocks: lets the vendor edit settings as a flat
// list of key/value pairs based on the current settings object. Until each
// block gets a hand-tailored editor, this keeps things functional.
function GenericKeyValueEditor({
  settings,
  onChange,
}: {
  settings: any;
  onChange: (next: any) => void;
}) {
  const entries = Object.entries(settings ?? {}).filter(([k]) => k !== 'items' && k !== 'fields');
  if (entries.length === 0) {
    return <div className="p-3 text-xs text-ink-500">This block has no settings yet — drag it where you want it on the page.</div>;
  }
  return (
    <div className="space-y-2 p-3">
      {entries.map(([key, value]) => {
        if (typeof value === 'boolean') {
          return (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={value}
                onChange={(e) => onChange({ ...settings, [key]: e.target.checked })}
              />
              <span className="capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
            </label>
          );
        }
        if (typeof value === 'number') {
          return (
            <label key={key} className="block text-sm">
              <span className="capitalize text-ink-700">{key.replace(/([A-Z])/g, ' $1')}</span>
              <input
                type="number"
                className="input-field mt-1 w-full"
                value={value}
                onChange={(e) => onChange({ ...settings, [key]: Number(e.target.value) })}
              />
            </label>
          );
        }
        if (typeof value === 'string') {
          return (
            <label key={key} className="block text-sm">
              <span className="capitalize text-ink-700">{key.replace(/([A-Z])/g, ' $1')}</span>
              <input
                type="text"
                className="input-field mt-1 w-full"
                value={value}
                onChange={(e) => onChange({ ...settings, [key]: e.target.value })}
              />
            </label>
          );
        }
        return null;
      })}
    </div>
  );
}

interface SystemBlockSpec {
  type: BlockType;
  label: string;
  description: string;
  icon: string;
  defaultSettings: () => any;
  allowedKinds: PageKind[];
  requiredOn?: PageKind[];
  Renderer?: React.ComponentType<{ settings: any; ctx: RenderContext }>;
  // Hand-built editor for this block. Falls back to GenericKeyValueEditor.
  Editor?: BlockDefinition['Editor'];
}

function placeholderRendererFor(label: string, hint: string) {
  return function StubRenderer({ ctx }: { settings: any; ctx: RenderContext }) {
    // Live renderers will be wired in a later phase. For now we always show
    // the labelled placeholder so the editor preview is meaningful.
    return <PlaceholderCard label={label} hint={hint} accent={ctx?.pageKind === 'PDP' ? '#0E3B2E' : '#F1641E'} />;
  };
}

function buildDefinition(spec: SystemBlockSpec): BlockDefinition {
  const Renderer = spec.Renderer ?? placeholderRendererFor(spec.label, spec.description);
  return {
    type: spec.type,
    label: spec.label,
    description: spec.description,
    icon: spec.icon,
    defaultSettings: spec.defaultSettings,
    Renderer: Renderer as any,
    Editor: (spec.Editor ?? (GenericKeyValueEditor as unknown)) as BlockDefinition['Editor'],
    allowedKinds: spec.allowedKinds,
    requiredOn: spec.requiredOn,
  };
}

// ── Block specs ─────────────────────────────────────────────────────────────

const PDP: PageKind[] = ['PDP'];
const CART: PageKind[] = ['CART'];
const CHECKOUT: PageKind[] = ['CHECKOUT'];

const specs: SystemBlockSpec[] = [
  // PDP — live renderers + hand-built editors
  { type: 'pdpGallery',           label: 'Product gallery',     description: 'Main image + thumbnails, with optional zoom',                icon: '🖼', allowedKinds: PDP, requiredOn: PDP, defaultSettings: () => ({ position: 'left', zoom: true }), Renderer: PdpGalleryRenderer as any, Editor: PdpGalleryEditor as any },
  { type: 'pdpSummary',           label: 'Product summary',     description: 'Title, vendor, price, rating — usually sticky on scroll',   icon: '📝', allowedKinds: PDP, requiredOn: PDP, defaultSettings: () => ({ showVendor: true, showRating: true, sticky: true }), Renderer: PdpSummaryRenderer as any, Editor: PdpSummaryEditor as any },
  { type: 'pdpVariants',          label: 'Variant picker',      description: 'Size / metal / stone selector with size-guide link',        icon: '🎛', allowedKinds: PDP,                  defaultSettings: () => ({ showSizeGuide: true, sizeGuideUrl: '' }), Renderer: PdpVariantsRenderer as any, Editor: PdpVariantsEditor as any },
  { type: 'pdpQuantityCart',      label: 'Quantity + cart',     description: 'Quantity stepper, Add to bag, Buy now, Wishlist',          icon: '🛒', allowedKinds: PDP, requiredOn: PDP, defaultSettings: () => ({ showBuyNow: true, showWishlist: true, ctaLabel: 'Add to bag' }), Renderer: PdpQuantityCartRenderer as any, Editor: PdpQuantityCartEditor as any },
  { type: 'pdpAttributes',        label: 'Attribute table',     description: 'Material, weight, hallmark, dimensions…',                   icon: '📋', allowedKinds: PDP,                  defaultSettings: () => ({ heading: 'Details' }), Renderer: PdpAttributesRenderer as any, Editor: PdpAttributesEditor as any },
  { type: 'pdpDescription',       label: 'Long description',    description: 'Rich text describing the piece',                            icon: '📰', allowedKinds: PDP,                  defaultSettings: () => ({ heading: 'About this piece', collapsible: false }), Renderer: PdpDescriptionRenderer as any, Editor: PdpDescriptionEditor as any },
  { type: 'pdpPersonalization',   label: 'Personalisation',     description: 'Engraving, custom fields, special requests',                icon: '✒',  allowedKinds: PDP,                  defaultSettings: () => ({ heading: 'Make it yours' }), Renderer: PdpPersonalizationRenderer as any, Editor: PdpPersonalizationEditor as any },
  { type: 'pdpReviews',           label: 'Reviews',             description: 'Review list + write-a-review form',                         icon: '⭐', allowedKinds: PDP,                  defaultSettings: () => ({ heading: 'Reviews', showWriteReview: true }), Renderer: PdpReviewsRenderer as any, Editor: PdpReviewsEditor as any },
  { type: 'pdpRelatedProducts',   label: 'Related products',    description: 'Cross-sell strip — same section, category, or vendor',     icon: '🔗', allowedKinds: PDP,                  defaultSettings: () => ({ heading: 'You may also love', source: 'section', columns: 4, limit: 8 }), Renderer: PdpRelatedProductsRenderer as any, Editor: PdpRelatedProductsEditor as any },
  { type: 'pdpTrustStrip',        label: 'Trust strip',         description: 'Hallmark, returns, secure payment badges',                  icon: '✓',  allowedKinds: PDP,                  defaultSettings: () => ({ items: [] }), Renderer: PdpTrustStripRenderer as any, Editor: PdpTrustStripEditor as any },
  { type: 'pdpShippingEstimator', label: 'Delivery estimator',  description: 'Pincode → ETA widget',                                      icon: '📦', allowedKinds: PDP,                  defaultSettings: () => ({ heading: 'Check delivery' }), Renderer: PdpShippingEstimatorRenderer as any, Editor: PdpShippingEstimatorEditor as any },

  // Cart — live renderers + hand-built editors
  { type: 'cartLineItems',        label: 'Line items',          description: 'Item list with quantity / remove controls',                 icon: '🧾', allowedKinds: CART, requiredOn: CART, defaultSettings: () => ({ showThumbnail: true, showRemove: true }), Renderer: CartLineItemsRenderer as any, Editor: CartLineItemsEditor as any },
  { type: 'cartSummary',          label: 'Cart summary',        description: 'Subtotal, taxes, coupons, checkout button',                 icon: '💰', allowedKinds: CART, requiredOn: CART, defaultSettings: () => ({ showCoupon: true, ctaLabel: 'Checkout' }), Renderer: CartSummaryRenderer as any, Editor: CartSummaryEditor as any },
  { type: 'cartUpsell',           label: 'Upsell carousel',     description: 'Suggested add-ons or related pieces',                       icon: '✨', allowedKinds: CART,                   defaultSettings: () => ({ heading: 'Pairs beautifully with', source: 'related', sectionId: '', limit: 6 }), Renderer: CartUpsellRenderer as any, Editor: CartUpsellEditor as any },
  { type: 'cartTrustStrip',       label: 'Trust strip',         description: 'Hallmark, returns, secure payment badges',                  icon: '✓',  allowedKinds: CART,                   defaultSettings: () => ({ items: [] }), Renderer: CartTrustStripRenderer as any, Editor: CartTrustStripEditor as any },
  { type: 'cartAnnouncement',     label: 'Announcement bar',    description: 'Coloured bar with short marketing copy',                    icon: '📣', allowedKinds: CART,                   defaultSettings: () => ({ text: '', background: 'canvas' }), Renderer: CartAnnouncementRenderer as any, Editor: CartAnnouncementEditor as any },

  // Checkout — required blocks (steps, address, shipping, payment, summary)
  // are markers; the legacy payment flow renders them as a single core unit.
  // Decorative blocks render live around the core.
  { type: 'checkoutSteps',           label: 'Step indicator',    description: 'Visual progress for the checkout flow',                    icon: '🪜', allowedKinds: CHECKOUT,                       defaultSettings: () => ({}), Renderer: CheckoutStepsRenderer as any, Editor: CheckoutStepsEditor as any },
  { type: 'checkoutAddressForm',     label: 'Delivery address',  description: 'Required — collects shipping address',                      icon: '🏠', allowedKinds: CHECKOUT, requiredOn: CHECKOUT, defaultSettings: () => ({ heading: 'Delivery address' }), Renderer: CheckoutAddressFormRenderer as any, Editor: CheckoutAddressFormEditor as any },
  { type: 'checkoutShipping',        label: 'Shipping options',  description: 'Required — chooses shipping method',                        icon: '🚚', allowedKinds: CHECKOUT, requiredOn: CHECKOUT, defaultSettings: () => ({ heading: 'Shipping method' }), Renderer: CheckoutShippingRenderer as any, Editor: CheckoutShippingEditor as any },
  { type: 'checkoutPayment',         label: 'Payment',           description: 'Required — Razorpay, UPI, COD',                             icon: '💳', allowedKinds: CHECKOUT, requiredOn: CHECKOUT, defaultSettings: () => ({ heading: 'Payment' }), Renderer: CheckoutPaymentRenderer as any, Editor: CheckoutPaymentEditor as any },
  { type: 'checkoutOrderSummary',    label: 'Order summary',     description: 'Items, totals — sidebar or inline',                         icon: '🧾', allowedKinds: CHECKOUT,                       defaultSettings: () => ({ position: 'sidebar' }), Renderer: CheckoutOrderSummaryRenderer as any, Editor: CheckoutOrderSummaryEditor as any },
  { type: 'checkoutGiftWrap',        label: 'Gift-wrap upsell',  description: 'Optional gift-wrap add-on',                                 icon: '🎁', allowedKinds: CHECKOUT,                       defaultSettings: () => ({ heading: 'Add a gift wrap', price: 0 }), Renderer: CheckoutGiftWrapRenderer as any, Editor: CheckoutGiftWrapEditor as any },
  { type: 'checkoutCustomFields',    label: 'Custom fields',     description: 'Extra inputs you collect at checkout',                      icon: '🔧', allowedKinds: CHECKOUT,                       defaultSettings: () => ({ heading: 'Order details', fields: [] }), Renderer: CheckoutCustomFieldsRenderer as any, Editor: CheckoutCustomFieldsEditor as any },
  { type: 'checkoutTrustStrip',      label: 'Trust strip',       description: 'Secure payment, returns, hallmark badges',                  icon: '✓',  allowedKinds: CHECKOUT,                       defaultSettings: () => ({ items: [] }), Renderer: CheckoutTrustStripRenderer as any, Editor: CheckoutTrustStripEditor as any },
  { type: 'checkoutAnnouncement',    label: 'Announcement bar',  description: 'Coloured bar at the top of checkout',                       icon: '📣', allowedKinds: CHECKOUT,                       defaultSettings: () => ({ text: '', background: 'canvas' }), Renderer: CheckoutAnnouncementRenderer as any, Editor: CheckoutAnnouncementEditor as any },
];

export const SYSTEM_BLOCK_DEFINITIONS: Partial<Record<BlockType, BlockDefinition>> = Object.fromEntries(
  specs.map((s) => [s.type, buildDefinition(s)])
) as any;
