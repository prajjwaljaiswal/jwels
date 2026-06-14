import { z } from 'zod';

const id = z.string().min(1).max(64);
const url = z.string().url().max(2000);
const optionalUrl = url.optional().or(z.literal(''));
const href = z.string().min(1).max(2000);
const shortText = z.string().max(200);
const longText = z.string().max(2000);

const heroBlock = z.object({
  id,
  type: z.literal('hero'),
  settings: z.object({
    headline: z.string().min(1).max(120),
    subheadline: shortText.optional().default(''),
    ctaLabel: z.string().max(40).optional().default(''),
    ctaHref: z.string().max(2000).optional().default(''),
    backgroundImageUrl: optionalUrl.default(''),
    alignment: z.enum(['left', 'center']).default('center'),
    height: z.enum(['sm', 'md', 'lg']).default('md'),
  }),
});

const productGridBlock = z.object({
  id,
  type: z.literal('productGrid'),
  settings: z.object({
    heading: shortText.optional().default(''),
    source: z.enum(['all', 'section', 'manual']).default('all'),
    sectionId: z.string().optional().default(''),
    productIds: z.array(z.string()).max(48).optional().default([]),
    columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(3),
    limit: z.number().int().min(1).max(48).default(12),
  }),
});

const featuredSectionBlock = z.object({
  id,
  type: z.literal('featuredSection'),
  settings: z.object({
    sectionId: z.string().min(1),
    heading: shortText.optional().default(''),
    layout: z.enum(['grid', 'carousel']).default('grid'),
    limit: z.number().int().min(1).max(24).default(8),
  }),
});

const richTextBlock = z.object({
  id,
  type: z.literal('richText'),
  settings: z.object({
    html: z.string().max(20000).default(''),
    maxWidth: z.enum(['narrow', 'medium', 'wide']).default('medium'),
    align: z.enum(['left', 'center']).default('left'),
  }),
});

const imageWithTextBlock = z.object({
  id,
  type: z.literal('imageWithText'),
  settings: z.object({
    mediaKind: z.enum(['image', 'video']).default('image'),
    imageUrl: optionalUrl.default(''),   // image, or poster for a video
    videoUrl: optionalUrl.default(''),   // mp4/webm URL when mediaKind = video
    imagePosition: z.enum(['left', 'right']).default('left'),
    width: z.enum(['contained', 'full']).default('contained'),

    heading: shortText.optional().default(''),
    body: longText.optional().default(''),
    ctaLabel: z.string().max(40).optional().default(''),
    ctaHref: z.string().max(2000).optional().default(''),
  }),
});

const testimonialsBlock = z.object({
  id,
  type: z.literal('testimonials'),
  settings: z.object({
    heading: shortText.optional().default(''),
    items: z
      .array(
        z.object({
          quote: z.string().min(1).max(500),
          author: z.string().min(1).max(80),
          avatarUrl: optionalUrl.default(''),
          rating: z.number().int().min(1).max(5).optional(),
        })
      )
      .max(12)
      .default([]),
  }),
});

const faqBlock = z.object({
  id,
  type: z.literal('faq'),
  settings: z.object({
    heading: shortText.optional().default(''),
    items: z
      .array(
        z.object({
          question: z.string().min(1).max(200),
          answer: z.string().min(1).max(2000),
        })
      )
      .max(20)
      .default([]),
  }),
});

const videoEmbedBlock = z.object({
  id,
  type: z.literal('videoEmbed'),
  settings: z.object({
    provider: z.enum(['youtube', 'vimeo', 'mp4']).default('youtube'),
    urlOrId: z.string().min(1).max(500),
    aspectRatio: z.enum(['16:9', '4:5', '1:1']).default('16:9'),
    caption: shortText.optional().default(''),
  }),
});

const featureStripBlock = z.object({
  id,
  type: z.literal('featureStrip'),
  settings: z.object({
    heading: shortText.optional().default(''),
    background: z.enum(['none', 'canvas', 'brand']).default('none'),
    items: z.array(z.object({
      iconUrl: optionalUrl.default(''),
      label: z.string().min(1).max(60),
      sublabel: z.string().max(80).optional().default(''),
      href: z.string().max(2000).optional().default(''),
    })).max(12).default([]),
  }),
});

const categoryTilesBlock = z.object({
  id,
  type: z.literal('categoryTiles'),
  settings: z.object({
    heading: shortText.optional().default(''),
    columns: z.union([z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).default(4),
    items: z.array(z.object({
      imageUrl: url,
      title: z.string().min(1).max(80),
      href: z.string().min(1).max(2000),
      overlay: z.boolean().optional().default(true),
    })).max(12).default([]),
  }),
});

const editorialCardsBlock = z.object({
  id,
  type: z.literal('editorialCards'),
  settings: z.object({
    heading: shortText.optional().default(''),
    items: z.array(z.object({
      imageUrl: url,
      eyebrow: z.string().max(40).optional().default(''),
      title: z.string().min(1).max(200),
      body: z.string().max(400).optional().default(''),
      ctaLabel: z.string().max(40).optional().default('Read & Shop'),
      ctaHref: z.string().min(1).max(2000),
    })).max(6).default([]),
  }),
});

const iconGridBlock = z.object({
  id,
  type: z.literal('iconGrid'),
  settings: z.object({
    heading: shortText.optional().default(''),
    subheading: shortText.optional().default(''),
    columns: z.union([z.literal(3), z.literal(4), z.literal(5), z.literal(6), z.literal(12)]).default(6),
    items: z.array(z.object({
      iconUrl: optionalUrl.default(''),
      iconColor: z.string().max(20).optional().default(''),
      title: z.string().min(1).max(60),
      caption: z.string().max(80).optional().default(''),
      href: z.string().max(2000).optional().default(''),
    })).max(24).default([]),
  }),
});

const imageStripBlock = z.object({
  id,
  type: z.literal('imageStrip'),
  settings: z.object({
    heading: shortText.optional().default(''),
    aspect: z.enum(['4:5', '1:1', '3:4', '16:9']).default('4:5'),
    items: z.array(z.object({
      imageUrl: url,
      alt: z.string().max(120).optional().default(''),
      href: z.string().max(2000).optional().default(''),
    })).min(1).max(6).default([]),
  }),
});

const imageSliderBlock = z.object({
  id,
  type: z.literal('imageSlider'),
  settings: z.object({
    height:   z.enum(['sm', 'md', 'lg']).default('md'),
    autoplay: z.boolean().default(true),
    interval: z.number().int().min(2).max(15).default(5), // seconds between slides
    slides: z.array(z.object({
      kind:       z.enum(['image', 'video']).default('image'),
      imageUrl:   optionalUrl.default(''),  // image slide, or poster for a video slide
      videoUrl:   optionalUrl.default(''),  // mp4/webm URL for video slides
      alt:        z.string().max(120).optional().default(''),
      heading:    z.string().max(120).optional().default(''),
      subheading: z.string().max(200).optional().default(''),
      ctaLabel:   z.string().max(40).optional().default(''),
      ctaHref:    z.string().max(2000).optional().default(''),
    })).max(8).default([]),
  }),
});

const emailCaptureBlock = z.object({
  id,
  type: z.literal('emailCapture'),
  settings: z.object({
    eyebrow: z.string().max(60).optional().default(''),
    heading: z.string().min(1).max(120).default('Stay in the loop'),
    subheading: shortText.optional().default(''),
    placeholder: z.string().max(80).optional().default('Your email address'),
    ctaLabel: z.string().max(40).optional().default('Sign up'),
    incentiveCode: z.string().max(40).optional().default(''),
    background: z.enum(['none', 'canvas', 'brand']).default('canvas'),
  }),
});

// ── Surface-specific blocks (PDP / Cart / Checkout) ────────────────────────
// Most settings are simple display toggles; the actual product/cart data is
// supplied by RenderContext on the frontend.

const pdpGalleryBlock = z.object({
  id, type: z.literal('pdpGallery'),
  settings: z.object({
    position: z.enum(['left', 'right', 'below']).default('left'),
    zoom:     z.boolean().default(true),
  }).partial().default({}),
});

const pdpSummaryBlock = z.object({
  id, type: z.literal('pdpSummary'),
  settings: z.object({
    showVendor: z.boolean().default(true),
    showRating: z.boolean().default(true),
    sticky:     z.boolean().default(true),
  }).partial().default({}),
});

const pdpVariantsBlock = z.object({
  id, type: z.literal('pdpVariants'),
  settings: z.object({
    showSizeGuide: z.boolean().default(true),
    sizeGuideUrl:  z.string().max(2000).optional().default(''),
  }).partial().default({}),
});

const pdpQuantityCartBlock = z.object({
  id, type: z.literal('pdpQuantityCart'),
  settings: z.object({
    showBuyNow:    z.boolean().default(true),
    showWishlist:  z.boolean().default(true),
    ctaLabel:      z.string().max(40).optional().default('Add to bag'),
  }).partial().default({}),
});

const pdpAttributesBlock = z.object({
  id, type: z.literal('pdpAttributes'),
  settings: z.object({
    heading: shortText.optional().default('Details'),
  }).partial().default({}),
});

const pdpDescriptionBlock = z.object({
  id, type: z.literal('pdpDescription'),
  settings: z.object({
    heading: shortText.optional().default('About this piece'),
    collapsible: z.boolean().default(false),
  }).partial().default({}),
});

const pdpPersonalizationBlock = z.object({
  id, type: z.literal('pdpPersonalization'),
  settings: z.object({
    heading: shortText.optional().default('Make it yours'),
  }).partial().default({}),
});

const pdpReviewsBlock = z.object({
  id, type: z.literal('pdpReviews'),
  settings: z.object({
    heading: shortText.optional().default('Reviews'),
    showWriteReview: z.boolean().default(true),
  }).partial().default({}),
});

const pdpRelatedProductsBlock = z.object({
  id, type: z.literal('pdpRelatedProducts'),
  settings: z.object({
    heading: shortText.optional().default('You may also love'),
    source:  z.enum(['section', 'category', 'vendor']).default('section'),
    columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(4),
    limit:   z.number().int().min(2).max(24).default(8),
  }).partial().default({}),
});

const pdpTrustStripBlock = z.object({
  id, type: z.literal('pdpTrustStrip'),
  settings: z.object({
    items: z.array(z.object({
      iconUrl: optionalUrl.default(''),
      label:   z.string().min(1).max(60),
      sublabel:z.string().max(80).optional().default(''),
    })).max(6).optional().default([]),
  }).partial().default({}),
});

const pdpShippingEstimatorBlock = z.object({
  id, type: z.literal('pdpShippingEstimator'),
  settings: z.object({
    heading: shortText.optional().default('Check delivery'),
  }).partial().default({}),
});

const cartLineItemsBlock = z.object({
  id, type: z.literal('cartLineItems'),
  settings: z.object({
    showThumbnail: z.boolean().default(true),
    showRemove:    z.boolean().default(true),
  }).partial().default({}),
});

const cartSummaryBlock = z.object({
  id, type: z.literal('cartSummary'),
  settings: z.object({
    showCoupon: z.boolean().default(true),
    ctaLabel:   z.string().max(40).optional().default('Checkout'),
  }).partial().default({}),
});

const cartUpsellBlock = z.object({
  id, type: z.literal('cartUpsell'),
  settings: z.object({
    heading: shortText.optional().default('Pairs beautifully with'),
    source:  z.enum(['section', 'vendor', 'related']).default('related'),
    sectionId: z.string().optional().default(''),
    limit:   z.number().int().min(2).max(12).default(6),
  }).partial().default({}),
});

const cartTrustStripBlock = z.object({
  id, type: z.literal('cartTrustStrip'),
  settings: z.object({
    items: z.array(z.object({
      iconUrl: optionalUrl.default(''),
      label:   z.string().min(1).max(60),
    })).max(6).optional().default([]),
  }).partial().default({}),
});

const cartAnnouncementBlock = z.object({
  id, type: z.literal('cartAnnouncement'),
  settings: z.object({
    text: z.string().max(200).default(''),
    background: z.enum(['none','canvas','brand']).default('canvas'),
  }).partial().default({}),
});

const checkoutStepsBlock = z.object({
  id, type: z.literal('checkoutSteps'),
  settings: z.object({}).partial().default({}),
});

const checkoutAddressFormBlock = z.object({
  id, type: z.literal('checkoutAddressForm'),
  settings: z.object({
    heading: shortText.optional().default('Delivery address'),
  }).partial().default({}),
});

const checkoutShippingBlock = z.object({
  id, type: z.literal('checkoutShipping'),
  settings: z.object({
    heading: shortText.optional().default('Shipping method'),
  }).partial().default({}),
});

const checkoutPaymentBlock = z.object({
  id, type: z.literal('checkoutPayment'),
  settings: z.object({
    heading: shortText.optional().default('Payment'),
  }).partial().default({}),
});

const checkoutOrderSummaryBlock = z.object({
  id, type: z.literal('checkoutOrderSummary'),
  settings: z.object({
    position: z.enum(['sidebar', 'inline']).default('sidebar'),
  }).partial().default({}),
});

const checkoutGiftWrapBlock = z.object({
  id, type: z.literal('checkoutGiftWrap'),
  settings: z.object({
    heading: shortText.optional().default('Add a gift wrap'),
    price:   z.number().min(0).max(100000).optional().default(0),
  }).partial().default({}),
});

const checkoutCustomFieldsBlock = z.object({
  id, type: z.literal('checkoutCustomFields'),
  settings: z.object({
    heading: shortText.optional().default('Order details'),
    fields:  z.array(z.object({
      key:      z.string().min(1).max(40),
      label:    z.string().min(1).max(80),
      type:     z.enum(['text', 'textarea', 'select']).default('text'),
      required: z.boolean().default(false),
      options:  z.array(z.string().max(80)).max(20).optional().default([]),
    })).max(8).optional().default([]),
  }).partial().default({}),
});

const checkoutTrustStripBlock = z.object({
  id, type: z.literal('checkoutTrustStrip'),
  settings: z.object({
    items: z.array(z.object({
      iconUrl: optionalUrl.default(''),
      label:   z.string().min(1).max(60),
    })).max(6).optional().default([]),
  }).partial().default({}),
});

const checkoutAnnouncementBlock = z.object({
  id, type: z.literal('checkoutAnnouncement'),
  settings: z.object({
    text: z.string().max(200).default(''),
    background: z.enum(['none','canvas','brand']).default('canvas'),
  }).partial().default({}),
});

// `hidden` lives at the block level (not in settings) so it can be toggled
// without disturbing each block type's strict settings schema. The intersection
// below adds it once across the whole discriminated union.
const BlockEnvelope = z.object({ hidden: z.boolean().optional() });

const BlockUnion = z.discriminatedUnion('type', [
  heroBlock,
  productGridBlock,
  featuredSectionBlock,
  richTextBlock,
  imageWithTextBlock,
  testimonialsBlock,
  faqBlock,
  videoEmbedBlock,
  featureStripBlock,
  categoryTilesBlock,
  editorialCardsBlock,
  iconGridBlock,
  imageStripBlock,
  imageSliderBlock,
  emailCaptureBlock,
  pdpGalleryBlock,
  pdpSummaryBlock,
  pdpVariantsBlock,
  pdpQuantityCartBlock,
  pdpAttributesBlock,
  pdpDescriptionBlock,
  pdpPersonalizationBlock,
  pdpReviewsBlock,
  pdpRelatedProductsBlock,
  pdpTrustStripBlock,
  pdpShippingEstimatorBlock,
  cartLineItemsBlock,
  cartSummaryBlock,
  cartUpsellBlock,
  cartTrustStripBlock,
  cartAnnouncementBlock,
  checkoutStepsBlock,
  checkoutAddressFormBlock,
  checkoutShippingBlock,
  checkoutPaymentBlock,
  checkoutOrderSummaryBlock,
  checkoutGiftWrapBlock,
  checkoutCustomFieldsBlock,
  checkoutTrustStripBlock,
  checkoutAnnouncementBlock,
]);

// Intersect so `hidden` is permitted on every block variant without bloating
// each schema. Output type is `BlockUnionVariant & { hidden?: boolean }`.
export const BlockSchema = z.intersection(BlockUnion, BlockEnvelope);

export const BlocksArraySchema = z.array(BlockSchema).max(50);

export type Block = z.infer<typeof BlockSchema>;
export type BlockType = Block['type'];

export const BLOCK_TYPES: BlockType[] = [
  'hero','productGrid','featuredSection','richText','imageWithText','testimonials','faq','videoEmbed',
  'featureStrip','categoryTiles','editorialCards','iconGrid','imageStrip','imageSlider','emailCapture',
  'pdpGallery','pdpSummary','pdpVariants','pdpQuantityCart','pdpAttributes','pdpDescription',
  'pdpPersonalization','pdpReviews','pdpRelatedProducts','pdpTrustStrip','pdpShippingEstimator',
  'cartLineItems','cartSummary','cartUpsell','cartTrustStrip','cartAnnouncement',
  'checkoutSteps','checkoutAddressForm','checkoutShipping','checkoutPayment','checkoutOrderSummary',
  'checkoutGiftWrap','checkoutCustomFields','checkoutTrustStrip','checkoutAnnouncement',
];

// Which page kinds may include each block type. Blocks not listed default to allowing
// HOMEPAGE + CUSTOM only. Required blocks are listed in REQUIRED_BLOCKS_BY_KIND.
export type PageKind = 'HOMEPAGE' | 'CUSTOM' | 'PDP' | 'CART' | 'CHECKOUT';

export const BLOCK_ALLOWED_KINDS: Record<BlockType, PageKind[]> = {
  hero:             ['HOMEPAGE','CUSTOM'],
  productGrid:      ['HOMEPAGE','CUSTOM'],
  featuredSection:  ['HOMEPAGE','CUSTOM'],
  richText:         ['HOMEPAGE','CUSTOM','PDP','CART','CHECKOUT'],
  imageWithText:    ['HOMEPAGE','CUSTOM'],
  testimonials:     ['HOMEPAGE','CUSTOM','PDP'],
  faq:              ['HOMEPAGE','CUSTOM','PDP','CART','CHECKOUT'],
  videoEmbed:       ['HOMEPAGE','CUSTOM','PDP'],
  featureStrip:     ['HOMEPAGE','CUSTOM','PDP','CART','CHECKOUT'],
  categoryTiles:    ['HOMEPAGE','CUSTOM'],
  editorialCards:   ['HOMEPAGE','CUSTOM'],
  iconGrid:         ['HOMEPAGE','CUSTOM'],
  imageStrip:       ['HOMEPAGE','CUSTOM'],
  imageSlider:      ['HOMEPAGE','CUSTOM'],
  emailCapture:     ['HOMEPAGE','CUSTOM','CART'],
  pdpGallery:           ['PDP'],
  pdpSummary:           ['PDP'],
  pdpVariants:          ['PDP'],
  pdpQuantityCart:      ['PDP'],
  pdpAttributes:        ['PDP'],
  pdpDescription:       ['PDP'],
  pdpPersonalization:   ['PDP'],
  pdpReviews:           ['PDP'],
  pdpRelatedProducts:   ['PDP'],
  pdpTrustStrip:        ['PDP'],
  pdpShippingEstimator: ['PDP'],
  cartLineItems:        ['CART'],
  cartSummary:          ['CART'],
  cartUpsell:           ['CART'],
  cartTrustStrip:       ['CART'],
  cartAnnouncement:     ['CART'],
  checkoutSteps:        ['CHECKOUT'],
  checkoutAddressForm:  ['CHECKOUT'],
  checkoutShipping:     ['CHECKOUT'],
  checkoutPayment:      ['CHECKOUT'],
  checkoutOrderSummary: ['CHECKOUT'],
  checkoutGiftWrap:     ['CHECKOUT'],
  checkoutCustomFields: ['CHECKOUT'],
  checkoutTrustStrip:   ['CHECKOUT'],
  checkoutAnnouncement: ['CHECKOUT'],
};

// Blocks that must be present (at least once) for a page kind to be saveable.
// Protects payment-flow integrity on the checkout surface.
export const REQUIRED_BLOCKS_BY_KIND: Partial<Record<PageKind, BlockType[]>> = {
  PDP:      ['pdpGallery', 'pdpSummary', 'pdpQuantityCart'],
  CART:     ['cartLineItems', 'cartSummary'],
  CHECKOUT: ['checkoutAddressForm', 'checkoutShipping', 'checkoutPayment'],
};

export function validateBlocksForKind(
  blocks: Block[],
  kind: PageKind,
): { ok: true } | { ok: false; error: string } {
  for (const b of blocks) {
    const allowed = BLOCK_ALLOWED_KINDS[b.type] ?? ['HOMEPAGE','CUSTOM'];
    if (!allowed.includes(kind)) {
      return { ok: false, error: `Block "${b.type}" is not allowed on ${kind} pages` };
    }
  }
  const required = REQUIRED_BLOCKS_BY_KIND[kind] ?? [];
  for (const req of required) {
    if (!blocks.some((b) => b.type === req)) {
      return { ok: false, error: `Missing required block "${req}" for ${kind} pages` };
    }
  }
  return { ok: true };
}

export const RESERVED_PAGE_SLUGS = new Set([
  'admin',
  'api',
  'checkout',
  'cart',
  'account',
  'orders',
  'products',
  'auth',
  'login',
  'register',
  'vendor',
]);

// System pages use these well-known slugs (allowed to bypass user-slug rules).
export const SYSTEM_PAGE_SLUGS: Record<'HOMEPAGE'|'PDP'|'CART'|'CHECKOUT', string> = {
  HOMEPAGE: 'home',
  PDP:      '__pdp',
  CART:     '__cart',
  CHECKOUT: '__checkout',
};

export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
