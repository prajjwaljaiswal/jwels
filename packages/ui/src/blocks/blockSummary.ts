// Storyblok-style content preview for a block row in the editor's block list.
// Returns a one-line snippet derived from the block's most meaningful setting:
// hero → headline; productGrid → heading; testimonials → first quote author; etc.
// Falls back to the block's label or "—" when nothing concrete is present.

import type { Block, BlockType } from './types';

function trim(s: any, max = 60): string {
  if (typeof s !== 'string') return '';
  const t = s.trim();
  if (!t) return '';
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

export function getBlockSummary(block: Block): string {
  const s: any = block?.settings ?? {};
  switch (block.type as BlockType) {
    // ── Homepage / custom blocks ──────────────────────────────────────────
    case 'hero':
      return trim(s.headline) || trim(s.subheadline) || 'Hero banner';
    case 'productGrid':
      return trim(s.heading) || `Product grid · ${s.columns ?? 3} cols · up to ${s.limit ?? 12}`;
    case 'featuredSection':
      return trim(s.heading) || `Featured section · ${s.layout ?? 'grid'}`;
    case 'richText': {
      const stripped = String(s.html ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      return trim(stripped) || 'Rich text';
    }
    case 'imageWithText':
      return trim(s.heading) || trim(s.body) || 'Image + text';
    case 'testimonials': {
      const n = (s.items?.length ?? 0);
      return trim(s.heading) || (n ? `${n} testimonial${n > 1 ? 's' : ''}` : 'Testimonials');
    }
    case 'faq': {
      const n = (s.items?.length ?? 0);
      return trim(s.heading) || (n ? `${n} question${n > 1 ? 's' : ''}` : 'FAQ');
    }
    case 'videoEmbed':
      return trim(s.caption) || trim(s.urlOrId) || `Video · ${s.provider ?? 'youtube'}`;
    case 'featureStrip': {
      const items: any[] = s.items ?? [];
      if (items.length === 0) return trim(s.heading) || 'Trust strip';
      return trim(items.map((i) => i.label).filter(Boolean).join(' · '), 80) || trim(s.heading) || 'Trust strip';
    }
    case 'categoryTiles': {
      const n = (s.items?.length ?? 0);
      return trim(s.heading) || `${n} tile${n !== 1 ? 's' : ''}`;
    }
    case 'editorialCards': {
      const n = (s.items?.length ?? 0);
      return trim(s.heading) || `${n} card${n !== 1 ? 's' : ''}`;
    }
    case 'iconGrid': {
      const items: any[] = s.items ?? [];
      if (items.length === 0) return trim(s.heading) || 'Icon grid';
      return trim(s.heading) || trim(items.map((i) => i.title).filter(Boolean).join(' · '), 80) || 'Icon grid';
    }
    case 'imageStrip': {
      const n = (s.items?.length ?? 0);
      return trim(s.heading) || `${n} image${n !== 1 ? 's' : ''}`;
    }
    case 'imageSlider': {
      const n = (s.slides?.length ?? 0);
      return `Slider · ${n} slide${n !== 1 ? 's' : ''}${s.autoplay ? ' · auto' : ''}`;
    }
    case 'emailCapture':
      return trim(s.heading) || 'Email capture';

    // ── PDP blocks ────────────────────────────────────────────────────────
    case 'pdpGallery':           return `Gallery · ${s.position ?? 'left'}${s.zoom ? ' · zoom' : ''}`;
    case 'pdpSummary':           return `Title · price${s.showRating !== false ? ' · rating' : ''}${s.sticky ? ' · sticky' : ''}`;
    case 'pdpVariants':          return `Variant picker${s.showSizeGuide ? ' · size guide' : ''}`;
    case 'pdpQuantityCart':      return trim(s.ctaLabel) || `Add to cart${s.showBuyNow !== false ? ' · buy now' : ''}`;
    case 'pdpAttributes':        return trim(s.heading) || 'Attribute table';
    case 'pdpDescription':       return trim(s.heading) || 'Long description';
    case 'pdpPersonalization':   return trim(s.heading) || 'Personalisation';
    case 'pdpReviews':           return trim(s.heading) || 'Reviews';
    case 'pdpRelatedProducts':   return trim(s.heading) || `Related · ${s.source ?? 'section'} · ${s.limit ?? 8}`;
    case 'pdpTrustStrip': {
      const items: any[] = s.items ?? [];
      return items.length
        ? trim(items.map((i) => i.label).filter(Boolean).join(' · '), 80)
        : 'PDP trust strip';
    }
    case 'pdpShippingEstimator': return trim(s.heading) || 'Delivery estimator';

    // ── Cart blocks ───────────────────────────────────────────────────────
    case 'cartLineItems':        return `Line items${s.showThumbnail === false ? ' · no thumb' : ''}`;
    case 'cartSummary':          return trim(s.ctaLabel) || `Summary${s.showCoupon ? ' · coupon' : ''}`;
    case 'cartUpsell':           return trim(s.heading) || `Upsell · ${s.source ?? 'related'} · ${s.limit ?? 6}`;
    case 'cartTrustStrip': {
      const items: any[] = s.items ?? [];
      return items.length
        ? trim(items.map((i) => i.label).filter(Boolean).join(' · '), 80)
        : 'Cart trust strip';
    }
    case 'cartAnnouncement':     return trim(s.text) || 'Cart announcement';

    // ── Checkout blocks ───────────────────────────────────────────────────
    case 'checkoutSteps':           return 'Step indicator';
    case 'checkoutAddressForm':     return trim(s.heading) || 'Delivery address';
    case 'checkoutShipping':        return trim(s.heading) || 'Shipping method';
    case 'checkoutPayment':         return trim(s.heading) || 'Payment';
    case 'checkoutOrderSummary':    return `Order summary · ${s.position ?? 'sidebar'}`;
    case 'checkoutGiftWrap': {
      const price = Number(s.price ?? 0);
      const base = trim(s.heading) || 'Gift wrap';
      return price > 0 ? `${base} · ₹${price.toLocaleString('en-IN')}` : base;
    }
    case 'checkoutCustomFields': {
      const n = (s.fields?.length ?? 0);
      return trim(s.heading) || (n ? `${n} field${n !== 1 ? 's' : ''}` : 'Custom fields');
    }
    case 'checkoutTrustStrip': {
      const items: any[] = s.items ?? [];
      return items.length
        ? trim(items.map((i) => i.label).filter(Boolean).join(' · '), 80)
        : 'Checkout trust strip';
    }
    case 'checkoutAnnouncement':    return trim(s.text) || 'Checkout announcement';
  }
  return '—';
}
