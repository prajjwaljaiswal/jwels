// Theme presets — ship-ready storefront looks vendors can apply with one click.
// Each preset seeds:
//   - Vendor.theme (matches strict schema in routes/vendors.ts)
//   - draft blocks for each system page kind (HOMEPAGE / PDP / CART / CHECKOUT)
// After applying, vendors can edit per-block.

import type { Block } from './blockSchemas';

export type PresetKey = 'classic' | 'modern' | 'minimal' | 'luxury' | 'boutique' | 'heirloom' | 'luxe';

export type SystemPageKind = 'HOMEPAGE' | 'PDP' | 'CART' | 'CHECKOUT';

export interface PresetMeta {
  key: PresetKey;
  name: string;
  description: string;
  accent: string;
  thumbnailUrl: string;
}

export interface ThemeConfig {
  colors?: Record<string, string>;
  typography?: { headingFont?: 'serif' | 'sans' | 'display'; bodyFont?: 'serif' | 'sans' };
  header?: any;
  footer?: any;
  animations?: {
    enabled: boolean;
    style: 'fade' | 'fade-up' | 'left' | 'right' | 'zoom';
    speed: 'slow' | 'normal' | 'fast';
    stagger: boolean;
    hover: boolean;
  };
}

// Curated scroll-reveal presets, matched to each theme's personality.
const anim = (
  style: 'fade' | 'fade-up' | 'left' | 'right' | 'zoom',
  speed: 'slow' | 'normal' | 'fast' = 'normal',
  hover = true,
): ThemeConfig['animations'] => ({ enabled: true, style, speed, stagger: true, hover });

export interface Preset {
  meta: PresetMeta;
  themeColor: string;
  theme: ThemeConfig;
  pages: Record<SystemPageKind, Block[]>;
}

const bid = (() => {
  let n = 0;
  return (prefix: string) => `${prefix}_${++n}`;
})();

// ── Curated default imagery ──────────────────────────────────────────────────
// Ship-ready Unsplash jewellery photos used as block defaults so image-bearing
// blocks (hero / categoryTiles / imageStrip / editorialCards) render attractively
// and pass the strict `url` validation in blockSchemas.ts out of the box. Vendors
// swap these for their own imagery in the page editor. Convention mirrors
// apps/api/prisma/seed-products.ts (images.unsplash.com hotlinks with crop params).
const IMG = (id: string, w = 1200) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;

const HERO_IMG       = IMG('1605100804763-247f67b3557e', 2000); // gold jewellery flatlay
const STORY_IMG      = IMG('1611591437281-460bfbe1220a', 1200); // jeweller at the bench
const CAT_RINGS      = IMG('1605100804763-247f67b3557e', 800);
const CAT_NECKLACES  = IMG('1599643478518-a784e5dc4c8f', 800);
const CAT_EARRINGS   = IMG('1535632066927-ab7c9ab60908', 800);
const CAT_BANGLES    = IMG('1611652022419-a9419f74343d', 800);
const LIFE_1         = IMG('1515562141207-7a88fb7ce338', 900);
const LIFE_2         = IMG('1617038220319-276d3cfab638', 900);
const LIFE_3         = IMG('1602173574767-37ac01994b2a', 900);
const LIFE_4         = IMG('1588444650733-d0767b753fc8', 900);
const JOURNAL_1      = IMG('1599643478518-a784e5dc4c8f', 900);
const JOURNAL_2      = IMG('1573408301185-9146fe634ad0', 900);
const JOURNAL_3      = IMG('1535632066927-ab7c9ab60908', 900);

// ── Reusable block factories ────────────────────────────────────────────────
// All factories return blocks that satisfy the strict zod schemas in
// blockSchemas.ts so they pass `validateBlocksForKind` at save/publish time.

const heroBanner = (
  headline: string,
  sub: string,
  ctaLabel = 'Shop the collection',
  backgroundImageUrl = HERO_IMG,
): Block => ({
  id: bid('hero'),
  type: 'hero',
  settings: {
    headline,
    subheadline: sub,
    ctaLabel,
    ctaHref: '/products',
    backgroundImageUrl,
    alignment: 'center',
    height: 'lg',
  },
} as any);

const productGrid = (heading: string, limit = 8, columns: 2 | 3 | 4 = 4): Block => ({
  id: bid('grid'),
  type: 'productGrid',
  settings: { heading, source: 'all', sectionId: '', productIds: [], columns, limit },
} as any);

const trustStrip = (background: 'none' | 'canvas' | 'brand' = 'canvas'): Block => ({
  id: bid('strip'),
  type: 'featureStrip',
  settings: {
    heading: '',
    background,
    items: [
      { iconUrl: '', label: 'BIS-hallmarked', sublabel: '916 / 22K gold, assay-certified', href: '' },
      { iconUrl: '', label: 'Free insured shipping', sublabel: 'On orders above ₹2,000', href: '' },
      { iconUrl: '', label: '7-day easy returns', sublabel: 'No-questions exchange policy',  href: '' },
      { iconUrl: '', label: 'Lifetime buyback',  sublabel: 'On all gold purchases',           href: '' },
    ],
  },
} as any);

const brandStory = (heading: string, body: string, imageUrl = STORY_IMG): Block => ({
  id: bid('story'),
  type: 'imageWithText',
  settings: {
    imageUrl,
    imagePosition: 'left',
    heading,
    body,
    ctaLabel: 'Read our story',
    ctaHref: '/about',
  },
} as any);

// Shop-by-type tiles — the category navigation top jewellery sites lead with.
const categoryTiles = (): Block => ({
  id: bid('cats'),
  type: 'categoryTiles',
  settings: {
    heading: 'Shop by category',
    columns: 4,
    items: [
      { imageUrl: CAT_RINGS,     title: 'Rings',     href: '/products?category=rings',     overlay: true },
      { imageUrl: CAT_NECKLACES, title: 'Necklaces', href: '/products?category=necklaces', overlay: true },
      { imageUrl: CAT_EARRINGS,  title: 'Earrings',  href: '/products?category=earrings',  overlay: true },
      { imageUrl: CAT_BANGLES,   title: 'Bangles',   href: '/products?category=bangles',   overlay: true },
    ],
  },
} as any);

// On-model / lifestyle photography row — answers "how will it look on me?".
const lifestyleStrip = (): Block => ({
  id: bid('life'),
  type: 'imageStrip',
  settings: {
    heading: 'Worn every day',
    aspect: '4:5',
    items: [
      { imageUrl: LIFE_1, alt: 'Layered gold necklaces, styled', href: '/products' },
      { imageUrl: LIFE_2, alt: 'Stacked rings on hand',           href: '/products' },
      { imageUrl: LIFE_3, alt: 'Drop earrings, close-up',         href: '/products' },
      { imageUrl: LIFE_4, alt: 'Bangles on the wrist',            href: '/products' },
    ],
  },
} as any);

// Editorial / journal cards — storytelling + styling guidance.
const journalCards = (): Block => ({
  id: bid('journal'),
  type: 'editorialCards',
  settings: {
    heading: 'From the journal',
    items: [
      { imageUrl: JOURNAL_1, eyebrow: 'Style guide', title: 'How to layer necklaces', body: 'Mixing lengths and metals for an effortless, collected look.', ctaLabel: 'Read & shop', ctaHref: '/products?category=necklaces' },
      { imageUrl: JOURNAL_2, eyebrow: 'Care',        title: 'Caring for your gold',   body: 'Simple habits to keep every piece bright for generations.',     ctaLabel: 'Read more',   ctaHref: '/about' },
      { imageUrl: JOURNAL_3, eyebrow: 'Gifting',     title: 'The gifting edit',       body: 'Pieces they will reach for long after the occasion.',            ctaLabel: 'Shop gifts',  ctaHref: '/products' },
    ],
  },
} as any);

const promiseGrid = (): Block => ({
  id: bid('promises'),
  type: 'iconGrid',
  settings: {
    heading: 'Made with care, every step',
    subheading: 'What every piece comes with.',
    columns: 4,
    items: [
      { iconUrl: '', iconColor: '', title: 'Ethically sourced', caption: 'Conflict-free stones, recycled metals', href: '' },
      { iconUrl: '', iconColor: '', title: 'Hand-finished',     caption: 'Polished and quality-checked by hand',   href: '' },
      { iconUrl: '', iconColor: '', title: 'Certified',         caption: 'BIS hallmark + IGI / GIA where stated',   href: '' },
      { iconUrl: '', iconColor: '', title: 'Backed for life',   caption: 'Lifetime buyback + free cleaning',        href: '' },
    ],
  },
} as any);

const testimonialsBlock = (): Block => ({
  id: bid('testi'),
  type: 'testimonials',
  settings: {
    heading: 'Loved by our customers',
    items: [
      { author: 'Priya S.',  rating: 5, avatarUrl: '', quote: 'The finish is exquisite — packaging felt like a gift to myself. Will buy again.' },
      { author: 'Ananya R.', rating: 5, avatarUrl: '', quote: 'Got my engagement ring from here. Beautiful work, and the size exchange was seamless.' },
      { author: 'Meera K.',  rating: 5, avatarUrl: '', quote: 'I love how lightweight the pieces are. Daily-wear that still feels special.' },
    ],
  },
} as any);

const homepageFaq = (): Block => ({
  id: bid('faq'),
  type: 'faq',
  settings: {
    heading: 'Questions, answered',
    items: [
      { question: 'Is the gold real and certified?',          answer: 'Every gold piece is BIS-hallmarked (916 / 22K) and accompanied by an assay certificate. Diamond and gemstone pieces ship with an IGI or GIA grading report where applicable.' },
      { question: 'How long does shipping take?',             answer: 'In-stock pieces ship within 2 business days. Made-to-order pieces ship in 7–10 days. All orders are insured and delivered via tracked courier — typical delivery within India: 3–5 business days.' },
      { question: 'Can I return or exchange a piece?',        answer: 'Yes. You have 7 days from delivery to request a return or size exchange on unworn pieces in original packaging. Personalised and engraved items are non-returnable.' },
      { question: 'Do you buy back jewellery?',               answer: 'We offer lifetime buyback at the current gold rate, minus making and wastage charges. Bring your original invoice and the piece to us.' },
      { question: 'Can I get a piece resized or customised?', answer: 'Most rings, bangles, and chains can be resized — get in touch with us and we will quote a turnaround. Bespoke commissions usually take 2–4 weeks.' },
    ],
  },
} as any);

const emailCapture = (): Block => ({
  id: bid('email'),
  type: 'emailCapture',
  settings: {
    eyebrow: 'Members get more',
    heading: 'Join our list, get ₹500 off',
    subheading: 'Early access to drops, private sales, and the occasional love letter.',
    placeholder: 'Your email address',
    ctaLabel: 'Sign up',
    incentiveCode: '',
    background: 'canvas',
  },
} as any);

// Full-width auto-rotating hero slider (multi-image, video-capable). Slides use
// the curated default imagery; vendors swap images / add video in the editor.
const heroSlider = (): Block => ({
  id: bid('slider'),
  type: 'imageSlider',
  settings: {
    height: 'lg',
    autoplay: true,
    interval: 5,
    slides: [
      { kind: 'image', imageUrl: HERO_IMG,      videoUrl: '', alt: '', heading: 'New season sparkle',  subheading: 'Hand-finished brilliance, made for everyday.', ctaLabel: 'Shop new in',    ctaHref: '/products' },
      { kind: 'image', imageUrl: CAT_NECKLACES, videoUrl: '', alt: '', heading: 'The necklace edit',   subheading: 'Layered looks, made to mix.',                  ctaLabel: 'Shop necklaces', ctaHref: '/products?category=necklaces' },
      { kind: 'image', imageUrl: CAT_EARRINGS,  videoUrl: '', alt: '', heading: 'Everyday gold',       subheading: 'Lightweight pieces you never take off.',        ctaLabel: 'Shop earrings',  ctaHref: '/products?category=earrings' },
    ],
  },
} as any);

// Curated homepage sequence — competitor-grade flow modelled on top jewellery
// storefronts (Mejuri, CaratLane, Tanishq, BlueNile):
//   Hero → trust strip → shop-by-category tiles → new arrivals grid →
//   brand story → on-model lifestyle strip → bestsellers grid → promise grid →
//   editorial/journal cards → testimonials → FAQ → email capture.
// Each preset overrides the hero copy only.
const homepageBase = (headline: string, sub: string, cta: string): Block[] => [
  heroBanner(headline, sub, cta),
  trustStrip('canvas'),
  categoryTiles(),
  productGrid('New arrivals', 8, 4),
  brandStory('Crafted in our atelier, made for everyday', 'Every piece begins as a sketch on paper, is shaped by hand by our karigars, and is finished one stone at a time. We make jewellery that feels personal — pieces meant to be worn, not stored away.'),
  lifestyleStrip(),
  productGrid('Bestsellers', 8, 4),
  promiseGrid(),
  journalCards(),
  testimonialsBlock(),
  homepageFaq(),
  emailCapture(),
];

// J&Co-inspired "Luxe Minimal" homepage — leads with a full-width hero slider,
// then a shop-by-category grid, product rails, trust strip, brand story, journal,
// and newsletter. Clean white + gold, sans-serif, video-ready hero.
const luxeHomepage = (): Block[] => [
  heroSlider(),
  categoryTiles(),
  productGrid('New arrivals', 8, 4),
  productGrid('Best sellers', 8, 4),
  trustStrip('canvas'),
  brandStory('Modern fine jewellery', 'Designed in-house and finished by hand, our pieces pair lab-grown brilliance with everyday wearability — luxury that fits real life, backed for the long run.'),
  journalCards(),
  emailCapture(),
];

// ── PDP / Cart / Checkout factories ─────────────────────────────────────────
// Sequences mirror the layouts top jewellery storefronts use today
// (CaratLane, BlueStone, Mejuri, Tanishq Mia). Trust badges sit close to the
// CTA; structured details come before the long description; FAQ + related
// products close the page.

const pdpDefault = (): Block[] => ([
  // Right column (info) — sits next to gallery
  { id: bid('pdpGallery'),       type: 'pdpGallery' as any,        settings: { position: 'left', zoom: true } },
  { id: bid('pdpSummary'),       type: 'pdpSummary' as any,        settings: { showVendor: true, showRating: true, sticky: true } },
  { id: bid('pdpVariants'),      type: 'pdpVariants' as any,       settings: { showSizeGuide: true, sizeGuideUrl: '' } },
  { id: bid('pdpQuantityCart'),  type: 'pdpQuantityCart' as any,   settings: { showBuyNow: true, showWishlist: true, ctaLabel: 'Add to bag' } },
  { id: bid('pdpShipping'),      type: 'pdpShippingEstimator' as any, settings: { heading: 'Check delivery time' } },
  { id: bid('pdpPersonalize'),   type: 'pdpPersonalization' as any, settings: { heading: 'Make it yours' } },
  { id: bid('pdpTrust'),
    type: 'pdpTrustStrip' as any,
    settings: {
      items: [
        { iconUrl: '', label: 'BIS-hallmarked',     sublabel: 'Assay-certified gold' },
        { iconUrl: '', label: 'Lifetime buyback',   sublabel: 'On all gold purchases' },
        { iconUrl: '', label: 'Insured shipping',   sublabel: 'Tracked, signature on delivery' },
        { iconUrl: '', label: '7-day exchange',     sublabel: 'On unworn pieces in original packing' },
      ],
    },
  },
  { id: bid('pdpAttributes'),    type: 'pdpAttributes' as any,     settings: { heading: 'Product details' } },
  { id: bid('pdpDescription'),   type: 'pdpDescription' as any,    settings: { heading: 'About this piece', collapsible: false } },
  // Full-width sections — the BlockRenderer splits before the first "wide"
  // block, so reviews / FAQ / related render below the hero region.
  { id: bid('pdpReviews'),       type: 'pdpReviews' as any,        settings: { heading: 'Customer reviews', showWriteReview: true } },
  { id: bid('pdpFaq'),
    type: 'faq' as any,
    settings: {
      heading: 'Frequently asked',
      items: [
        { question: 'Is this piece hallmarked?',         answer: 'Yes. All gold pieces are BIS-hallmarked and ship with an assay certificate. Diamond pieces include an IGI or GIA grading report where applicable.' },
        { question: 'What is the return policy?',        answer: '7-day exchange or refund on unworn pieces in original packaging. Engraved and personalised pieces are non-returnable.' },
        { question: 'How is the piece packed?',          answer: 'Every order ships in our signature gift box, sealed with a wax stamp, inside a tamper-proof courier mailer.' },
        { question: 'How long until I receive it?',      answer: 'In-stock pieces ship in 2 business days; made-to-order pieces in 7–10. You will get a tracking link as soon as we hand it to the courier.' },
      ],
    },
  },
  { id: bid('pdpRelated'),
    type: 'pdpRelatedProducts' as any,
    settings: { heading: 'You may also love', source: 'section', columns: 4, limit: 8 },
  },
]);

const cartDefault = (): Block[] => ([
  { id: bid('cartAnn'),
    type: 'cartAnnouncement' as any,
    settings: { text: 'Free insured shipping on orders above ₹2,000 — applied at checkout.', background: 'brand' },
  },
  { id: bid('cartItems'),  type: 'cartLineItems' as any, settings: { showThumbnail: true, showRemove: true } },
  { id: bid('cartTrust'),
    type: 'cartTrustStrip' as any,
    settings: {
      items: [
        { iconUrl: '', label: 'Secure 256-bit checkout' },
        { iconUrl: '', label: 'Cash on delivery on eligible pincodes' },
        { iconUrl: '', label: 'EMI available' },
        { iconUrl: '', label: '7-day exchange' },
      ],
    },
  },
  { id: bid('cartSum'),    type: 'cartSummary' as any, settings: { showCoupon: true, ctaLabel: 'Proceed to checkout' } },
  { id: bid('cartUp'),     type: 'cartUpsell'  as any, settings: { heading: 'Pairs beautifully with', source: 'related', sectionId: '', limit: 6 } },
]);

const checkoutDefault = (): Block[] => ([
  { id: bid('coAnn'),
    type: 'checkoutAnnouncement' as any,
    settings: { text: 'Your order is insured end-to-end and ships within 2 business days.', background: 'canvas' },
  },
  { id: bid('coSteps'),      type: 'checkoutSteps' as any,        settings: {} },
  { id: bid('coAddr'),       type: 'checkoutAddressForm' as any,  settings: { heading: 'Delivery address' } },
  { id: bid('coShip'),       type: 'checkoutShipping' as any,     settings: { heading: 'Shipping method' } },
  { id: bid('coGift'),
    type: 'checkoutGiftWrap' as any,
    settings: { heading: 'Wrap as a gift', price: 199 },
  },
  { id: bid('coPay'),        type: 'checkoutPayment' as any,      settings: { heading: 'Payment' } },
  { id: bid('coSummary'),    type: 'checkoutOrderSummary' as any, settings: { position: 'sidebar' } },
  { id: bid('coCustom'),
    type: 'checkoutCustomFields' as any,
    settings: {
      heading: 'Anything we should know?',
      fields: [
        { key: 'gift_message',    label: 'Gift note (optional)',          type: 'textarea', required: false, options: [] },
        { key: 'delivery_window', label: 'Preferred delivery window',     type: 'select',   required: false, options: ['Anytime', 'Morning (9–12)', 'Afternoon (12–5)', 'Evening (5–8)'] },
      ],
    },
  },
  { id: bid('coTrust'),
    type: 'checkoutTrustStrip' as any,
    settings: {
      items: [
        { iconUrl: '', label: '256-bit SSL secured' },
        { iconUrl: '', label: 'PCI-DSS compliant payment' },
        { iconUrl: '', label: 'BIS-hallmarked gold' },
        { iconUrl: '', label: '7-day easy returns' },
      ],
    },
  },
] as any);

// ── Five presets ────────────────────────────────────────────────────────────

const classic: Preset = {
  meta: {
    key: 'classic',
    name: 'Classic',
    description: 'Timeless serif typography, warm gold accents, generous spacing.',
    accent: '#B8860B',
    thumbnailUrl: '',
  },
  themeColor: '#B8860B',
  theme: {
    colors:    { primary: '#B8860B', accent: '#8B5E3C', background: '#FFFDF8', text: '#1A1A1A', headerBg: '#FFFDF8', headerText: '#1A1A1A', footerBg: '#1A1A1A', footerText: '#F5EFE0' },
    typography:{ headingFont: 'serif', bodyFont: 'serif' },
    animations: anim('fade-up', 'normal'),
  },
  pages: {
    HOMEPAGE: homepageBase(
      'Handcrafted heirlooms',
      'Timeless pieces, lovingly made — meant to travel through generations.',
      'Explore the collection',
    ),
    PDP: pdpDefault(),
    CART: cartDefault(),
    CHECKOUT: checkoutDefault(),
  },
};

const modern: Preset = {
  meta: { key: 'modern', name: 'Modern', description: 'Clean sans-serif, bold orange accents, edge-to-edge imagery.', accent: '#F1641E', thumbnailUrl: '' },
  themeColor: '#F1641E',
  theme: {
    colors: { primary: '#F1641E', accent: '#0E0E0E', background: '#FFFFFF', text: '#0E0E0E', headerBg: '#FFFFFF', headerText: '#0E0E0E', footerBg: '#0E0E0E', footerText: '#FFFFFF' },
    typography: { headingFont: 'sans', bodyFont: 'sans' },
    animations: anim('fade-up', 'fast'),
  },
  pages: {
    HOMEPAGE: homepageBase(
      'Jewellery, redefined.',
      'Modern silhouettes you reach for every day.',
      'Shop the edit',
    ),
    PDP: pdpDefault(),
    CART: cartDefault(),
    CHECKOUT: checkoutDefault(),
  },
};

const minimal: Preset = {
  meta: { key: 'minimal', name: 'Minimal', description: 'Lots of whitespace, monochrome palette, restrained typography.', accent: '#111111', thumbnailUrl: '' },
  themeColor: '#111111',
  theme: {
    colors: { primary: '#111111', accent: '#666666', background: '#FFFFFF', text: '#111111', headerBg: '#FFFFFF', headerText: '#111111', footerBg: '#FFFFFF', footerText: '#111111' },
    typography: { headingFont: 'sans', bodyFont: 'sans' },
    animations: anim('fade', 'slow', false),
  },
  pages: {
    HOMEPAGE: homepageBase(
      'Less, but better.',
      'A curated edit of essentials — quiet jewellery, made to last.',
      'Browse the edit',
    ),
    PDP: pdpDefault(),
    CART: cartDefault(),
    CHECKOUT: checkoutDefault(),
  },
};

const luxury: Preset = {
  meta: { key: 'luxury', name: 'Luxury', description: 'Display serif, deep emerald, opulent feel for fine jewellery.', accent: '#0E3B2E', thumbnailUrl: '' },
  themeColor: '#0E3B2E',
  theme: {
    colors: { primary: '#0E3B2E', accent: '#C9A95C', background: '#0E0E0E', text: '#F5EFE0', headerBg: '#0E0E0E', headerText: '#F5EFE0', footerBg: '#0E0E0E', footerText: '#F5EFE0' },
    typography: { headingFont: 'display', bodyFont: 'serif' },
    animations: anim('fade', 'slow'),
  },
  pages: {
    HOMEPAGE: homepageBase(
      'La maison.',
      'Exquisitely made, individually numbered — created in our atelier.',
      'Discover the collection',
    ),
    PDP: pdpDefault(),
    CART: cartDefault(),
    CHECKOUT: checkoutDefault(),
  },
};

const boutique: Preset = {
  meta: { key: 'boutique', name: 'Boutique', description: 'Playful display, blush palette, soft pastel pinks.', accent: '#D87093', thumbnailUrl: '' },
  themeColor: '#D87093',
  theme: {
    colors: { primary: '#D87093', accent: '#9B5A75', background: '#FFF5F7', text: '#2A1A22', headerBg: '#FFF5F7', headerText: '#2A1A22', footerBg: '#9B5A75', footerText: '#FFF5F7' },
    typography: { headingFont: 'display', bodyFont: 'sans' },
    animations: anim('zoom', 'normal'),
  },
  pages: {
    HOMEPAGE: homepageBase(
      'Hello, lovely.',
      'Hand-picked jewellery, made to wear every day.',
      'Shop the boutique',
    ),
    PDP: pdpDefault(),
    CART: cartDefault(),
    CHECKOUT: checkoutDefault(),
  },
};

const heirloom: Preset = {
  meta: {
    key: 'heirloom',
    name: 'Heirloom',
    description: 'Flagship luxury look — display serif, warm gold on ivory, editorial imagery and shop-by-category tiles.',
    accent: '#A87C3D',
    thumbnailUrl: IMG('1605100804763-247f67b3557e', 600),
  },
  themeColor: '#A87C3D',
  theme: {
    colors: { primary: '#A87C3D', accent: '#8B5E3C', background: '#FBF8F2', text: '#211B14', headerBg: '#FBF8F2', headerText: '#211B14', footerBg: '#211B14', footerText: '#F3E9D7' },
    typography: { headingFont: 'display', bodyFont: 'serif' },
    animations: anim('fade-up', 'normal'),
  },
  pages: {
    HOMEPAGE: homepageBase(
      'Heirlooms, in the making',
      'Hand-finished gold and gemstones — pieces made to be worn now and passed on later.',
      'Explore the collection',
    ),
    PDP: pdpDefault(),
    CART: cartDefault(),
    CHECKOUT: checkoutDefault(),
  },
};

const luxe: Preset = {
  meta: {
    key: 'luxe',
    name: 'Luxe Minimal',
    description: 'Clean white + gold, modern sans-serif, video-ready hero slider and shop-by-category grid — inspired by contemporary fine-jewellery flagships.',
    accent: '#B7975B',
    thumbnailUrl: IMG('1599643478518-a784e5dc4c8f', 600),
  },
  themeColor: '#B7975B',
  theme: {
    colors: { primary: '#B7975B', accent: '#1A1A1A', background: '#FFFFFF', text: '#1A1A1A', headerBg: '#FFFFFF', headerText: '#1A1A1A', footerBg: '#111111', footerText: '#EDEDED' },
    typography: { headingFont: 'sans', bodyFont: 'sans' },
    header: { announcement: 'Free insured shipping on all orders over ₹2,000', showSearch: true, showMarketplaceLink: true, navLinks: [] },
    animations: anim('fade-up', 'normal'),
  },
  pages: {
    HOMEPAGE: luxeHomepage(),
    PDP: pdpDefault(),
    CART: cartDefault(),
    CHECKOUT: checkoutDefault(),
  },
};

const presets: Record<PresetKey, Preset> = { classic, modern, minimal, luxury, boutique, heirloom, luxe };

export function listPresets(): PresetMeta[] {
  return (Object.keys(presets) as PresetKey[]).map((k) => presets[k].meta);
}

export function getPreset(key: string): Preset | null {
  return (presets as any)[key] ?? null;
}

export function defaultBlocksFor(kind: SystemPageKind): Block[] {
  // Fallback when a vendor opens a system page editor before applying any preset.
  switch (kind) {
    case 'HOMEPAGE': return modern.pages.HOMEPAGE;
    case 'PDP':      return pdpDefault();
    case 'CART':     return cartDefault();
    case 'CHECKOUT': return checkoutDefault();
  }
}

// Stable, well-known slugs for system pages (must not collide with user slugs).
// RESERVED_PAGE_SLUGS in blockSchemas.ts already blocks "cart", "checkout", so
// system pages use the double-underscore prefix.
export const SYSTEM_SLUGS: Record<SystemPageKind, string> = {
  HOMEPAGE: 'home',
  PDP:      '__pdp',
  CART:     '__cart',
  CHECKOUT: '__checkout',
};

export const SYSTEM_TITLES: Record<SystemPageKind, string> = {
  HOMEPAGE: 'Homepage',
  PDP:      'Product page',
  CART:     'Cart page',
  CHECKOUT: 'Checkout page',
};
