// Shared types for the listing editor wizard. Phase 1: fields not yet in the
// schema are kept here as UI-only state (held in localStorage so vendors don't
// lose them across reloads) and stripped before submitting to /api/products.

export type WhoMade = 'I_DID' | 'TEAM' | 'ANOTHER_COMPANY' | '';
export type WhatIsIt = 'FINISHED' | 'SUPPLY' | '';
export type WhenMade =
  | 'made_to_order' | '2020s' | '2010s' | '2000s'
  | 'before_2000' | 'vintage' | '';
export type ItemType = 'PHYSICAL' | 'DIGITAL';
export type RenewalMode = 'AUTOMATIC' | 'MANUAL';
export type JewelleryType = 'FINE' | 'DEMI_FINE' | 'FASHION' | 'HANDCRAFTED' | '';
export type Purity = 'K14' | 'K18' | 'K22' | 'K24' | 'SILVER_925' | 'PLATINUM_950' | 'OTHER' | '';
export type Gender = 'WOMEN' | 'MEN' | 'UNISEX' | 'KIDS' | '';
export type MakingChargeType = 'PER_GRAM' | 'FLAT' | 'PERCENT' | '';

// Which jewellery types should show purity / weight / making-charge / hallmark UI.
export const SHOWS_PURITY:        Record<Exclude<JewelleryType, ''>, boolean> = { FINE: true,  DEMI_FINE: true,  FASHION: false, HANDCRAFTED: false };
export const SHOWS_WEIGHT:        Record<Exclude<JewelleryType, ''>, boolean> = { FINE: true,  DEMI_FINE: true,  FASHION: false, HANDCRAFTED: false };
export const SHOWS_MAKING_CHARGE: Record<Exclude<JewelleryType, ''>, boolean> = { FINE: true,  DEMI_FINE: false, FASHION: false, HANDCRAFTED: false };
export const SHOWS_HALLMARK:      Record<Exclude<JewelleryType, ''>, boolean> = { FINE: true,  DEMI_FINE: true,  FASHION: false, HANDCRAFTED: false };
export const SHOWS_BASE_METAL:    Record<Exclude<JewelleryType, ''>, boolean> = { FINE: false, DEMI_FINE: true,  FASHION: true,  HANDCRAFTED: true  };
export const SHOWS_SAFETY:        Record<Exclude<JewelleryType, ''>, boolean> = { FINE: false, DEMI_FINE: true,  FASHION: true,  HANDCRAFTED: true  };

// Variations: client-side ids (`tempId`) link options to combos before they
// have real db ids. The backend re-issues real UUIDs at create time.
export interface DraftVariationOption { tempId: string; value: string }
export interface DraftVariation { tempId: string; name: string; options: DraftVariationOption[] }
export interface DraftCombo { optionTempIds: string[]; price: string; stock: string; sku: string }

export interface ListingDraft {
  // Photo & Video
  files: File[];                 // not serialized — re-picked each session
  existingImages: string[];      // already-uploaded image URLs (edit mode)
  videoUrl: string;
  // Category
  itemType: ItemType;
  whenMade: WhenMade;
  jewelleryType: JewelleryType;
  categoryId: string;
  // Item details
  title: string;
  description: string;
  brand: string;
  metalType: string;
  materials: string[];
  highlights: string[];          // bullet "key features" shown on PDP
  seoTitle: string;
  seoDescription: string;
  imageAlts: string[];           // parallel to files+existingImages, alt text per image
  attrValues: Record<string, string>;
  // Jewellery identity
  purity: Purity;
  gender: Gender;
  baseMetal: string;
  plating: string;
  hallmarked: boolean;
  certifiedBy: string;
  certificateNumber: string;
  hsnCode: string;
  gstRatePercent: string;
  countryOfOrigin: string;
  careInstructions: string;
  antiTarnish: boolean;
  nickelFree: boolean;
  hypoallergenic: boolean;
  leadFree: boolean;
  // Item options
  tags: string[];
  personalization: { enabled: boolean; instructions: string; charLimit: number };
  variations: DraftVariation[];
  combos: DraftCombo[];
  // Pricing & shipping
  price: string;
  stockQuantity: string;
  acceptsOffers: boolean;
  sku: string;
  shippingMethodId: string;
  grossWeightGrams: string;
  netWeightGrams: string;
  makingChargeType: MakingChargeType;
  makingChargeValue: string;
  wastagePercent: string;
  lengthMm: string;
  widthMm: string;
  heightMm: string;
  processingMin: string;
  processingMax: string;
  // How it's made (UI only Phase 1)
  whoMade: WhoMade;
  whatIsIt: WhatIsIt;
  // Settings
  shopSection: string;       // VendorSection.id
  returnPolicyId: string;    // VendorReturnPolicy.id
  featured: boolean;
  isActive: boolean;
  renewalMode: RenewalMode;
  warranty: string;
  certificateFile: File | null;       // new upload for cert scan
  existingCertificateUrl: string;     // edit mode
}

export const EMPTY_DRAFT: ListingDraft = {
  files: [],
  existingImages: [],
  videoUrl: '',
  itemType: 'PHYSICAL',
  whenMade: '',
  jewelleryType: '',
  categoryId: '',
  title: '',
  description: '',
  brand: '',
  metalType: 'gold',
  materials: [],
  highlights: [],
  seoTitle: '',
  seoDescription: '',
  imageAlts: [],
  attrValues: {},
  purity: '',
  gender: '',
  baseMetal: '',
  plating: '',
  hallmarked: false,
  certifiedBy: '',
  certificateNumber: '',
  hsnCode: '',
  gstRatePercent: '',
  countryOfOrigin: 'IN',
  careInstructions: '',
  antiTarnish: false,
  nickelFree: false,
  hypoallergenic: false,
  leadFree: false,
  tags: [],
  personalization: { enabled: false, instructions: '', charLimit: 256 },
  variations: [],
  combos: [],
  price: '',
  stockQuantity: '1',
  acceptsOffers: false,
  sku: '',
  shippingMethodId: '',
  grossWeightGrams: '',
  netWeightGrams: '',
  makingChargeType: '',
  makingChargeValue: '',
  wastagePercent: '',
  lengthMm: '',
  widthMm: '',
  heightMm: '',
  processingMin: '',
  processingMax: '',
  whoMade: '',
  whatIsIt: '',
  shopSection: '',
  returnPolicyId: '',
  featured: false,
  isActive: true,
  renewalMode: 'AUTOMATIC',
  warranty: '',
  certificateFile: null,
  existingCertificateUrl: '',
};

export type StepId = 'media' | 'category' | 'details' | 'options' | 'pricing' | 'made' | 'settings';

export const STEPS: { id: StepId; label: string; hint: string }[] = [
  { id: 'media',    label: 'Photo & Video',     hint: 'Up to 6 photos' },
  { id: 'category', label: 'Category',          hint: 'Where it lives' },
  { id: 'details',  label: 'Item Details',      hint: 'Title & description' },
  { id: 'options',  label: 'Item Options',      hint: 'Tags & extras' },
  { id: 'pricing',  label: 'Pricing & Shipping',hint: 'Price, stock, ship' },
  { id: 'made',     label: "How It's Made",     hint: 'Origin' },
  { id: 'settings', label: 'Settings',          hint: 'Visibility' },
];

// Per-step completion. Used to show checkmarks and to gate Publish.
export function stepStatus(d: ListingDraft): Record<StepId, { complete: boolean; reason?: string }> {
  return {
    media:    d.files.length + d.existingImages.length > 0
                ? { complete: true }
                : { complete: false, reason: 'Add at least one photo' },
    category: d.categoryId && d.whenMade && d.jewelleryType
                ? { complete: true }
                : { complete: false, reason: 'Pick a category, type, and when it was made' },
    details:  d.title.trim().length >= 5 && d.description.trim().length >= 10
                ? { complete: true }
                : { complete: false, reason: 'Title (5+) and description (10+) needed' },
    options:  { complete: true }, // entirely optional
    pricing:  Number(d.price) > 0 && Number(d.stockQuantity) >= 0
                ? { complete: true }
                : { complete: false, reason: 'Price and stock required' },
    made:     d.whoMade && d.whatIsIt
                ? { complete: true }
                : { complete: false, reason: 'Tell us who made it and what it is' },
    settings: { complete: true },
  };
}

export function canPublish(d: ListingDraft): boolean {
  const s = stepStatus(d);
  return s.media.complete && s.category.complete && s.details.complete && s.pricing.complete && s.made.complete;
}
