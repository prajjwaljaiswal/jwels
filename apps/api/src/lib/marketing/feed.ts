/**
 * Canonical product-feed builder.
 *
 * Produces ONE feed in the Google Merchant product spec (RSS 2.0 + the `g:` namespace)
 * that BOTH Google Merchant Center and Meta Catalog consume (Meta accepts the Google feed).
 * Per the plan (docs/marketing-integration-plan.md §2): live price/availability, combo
 * price inheritance, variant rows via item_group_id, eligibility filtering and field
 * validation — products missing required attributes are reported as errors, never silently
 * emitted into the feed.
 */
import { Prisma, ProductStatus, VendorStatus, AvailabilityStatus } from '@prisma/client';
import { prisma } from '../prisma';

// Storefront base for product links (canonical, verified domain — keeps Shops links intact).
const STOREFRONT_BASE = (process.env.WEB_ORIGIN || process.env.STOREFRONT_ORIGIN || '').replace(/\/$/, '');
const CURRENCY = process.env.MARKETING_FEED_CURRENCY || 'INR';

const MAX_ADDITIONAL_IMAGES = 10; // Google caps additional_image_link at 10
const MAX_DESCRIPTION = 5000;

export type FeedAvailability = 'in_stock' | 'out_of_stock' | 'preorder' | 'backorder';

/** A single canonical feed record (parent product or a variant row). */
export interface FeedItem {
  id: string;
  itemGroupId?: string; // present on variant rows (= parent product id)
  title: string;
  description: string;
  link: string;
  imageLink: string;
  additionalImageLinks: string[];
  availability: FeedAvailability;
  price: string; // "1999.00 INR"
  brand?: string;
  condition: 'new' | 'refurbished' | 'used';
  gtin?: string;
  mpn?: string;
  identifierExists: boolean; // emit g:identifier_exists=false when no gtin/mpn/brand
  googleProductCategory?: string;
  productType?: string; // our category name (breadcrumb)
  customLabel0: string; // vendorId — segments the platform catalog per vendor
}

/** A product (or variant) that could not be emitted, with the reasons. */
export interface FeedItemError {
  productId: string;
  reasons: string[];
}

export interface FeedDataset {
  items: FeedItem[];
  errors: FeedItemError[];
}

// Eligibility (§2a): only genuinely publishable offers reach the public feed.
export const FEED_PRODUCT_WHERE: Prisma.ProductWhereInput = {
  status: ProductStatus.ACTIVE,
  isActive: true,
  feedExcluded: false,
  vendor: { is: { status: VendorStatus.APPROVED } },
};

const FEED_INCLUDE = {
  vendor: { select: { id: true, shopName: true, status: true } },
  category: { select: { name: true } },
  variations: { include: { options: true }, orderBy: { position: 'asc' as const } },
  variationCombos: true,
} satisfies Prisma.ProductInclude;

type FeedProduct = Prisma.ProductGetPayload<{ include: typeof FEED_INCLUDE }>;

const FEED_CONDITION: Record<string, FeedItem['condition']> = {
  NEW: 'new',
  REFURBISHED: 'refurbished',
  USED: 'used',
};

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function plainText(html: string | null | undefined): string {
  if (!html) return '';
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_DESCRIPTION);
}

/** Decimal "1999.00 INR". Uses integer-safe Decimal formatting, never float math. */
function formatPrice(value: Prisma.Decimal): string {
  return `${value.toFixed(2)} ${CURRENCY}`;
}

/** Combo price inheritance (§2b): null combo price inherits the parent product price. */
export function resolvePrice(comboPrice: Prisma.Decimal | null, productPrice: Prisma.Decimal): Prisma.Decimal {
  return comboPrice ?? productPrice;
}

function availabilityFrom(stock: number, override: AvailabilityStatus | null): FeedAvailability {
  if (override) {
    return ({
      IN_STOCK: 'in_stock',
      OUT_OF_STOCK: 'out_of_stock',
      PREORDER: 'preorder',
      BACKORDER: 'backorder',
    } as const)[override];
  }
  return stock > 0 ? 'in_stock' : 'out_of_stock';
}

function productLink(productId: string): string {
  const url = `${STOREFRONT_BASE}/products/${productId}`;
  const params = new URLSearchParams({
    utm_source: 'shopping_feed',
    utm_medium: 'organic',
    utm_campaign: 'catalog',
  });
  return `${url}?${params.toString()}`;
}

/** Map a combo's optionIds → human values ("S / Gold") using the product's variations. */
function comboVariantSuffix(product: FeedProduct, optionIds: string[]): string {
  const valueById = new Map<string, string>();
  for (const v of product.variations) for (const o of v.options) valueById.set(o.id, o.value);
  const values = optionIds.map((id) => valueById.get(id)).filter(Boolean) as string[];
  return values.join(' / ');
}

/**
 * Validate the shared, parent-level required fields once. Returns the list of
 * blocking reasons (empty = ok). Per-variant price/availability are validated inline.
 */
function validateProduct(product: FeedProduct): string[] {
  const reasons: string[] = [];
  if (!STOREFRONT_BASE) reasons.push('WEB_ORIGIN/STOREFRONT_ORIGIN not configured — cannot build product link');
  if (!product.name?.trim()) reasons.push('missing title');
  if (!plainText(product.description)) reasons.push('missing description');
  const primaryImage = product.images?.find((u) => /^https?:\/\//i.test(u));
  if (!primaryImage) reasons.push('missing a public http(s) image_link');
  return reasons;
}

/**
 * Build the canonical feed records for a single product. A product with variation
 * combos emits one row per combo (each sharing item_group_id = product.id); otherwise
 * one row for the product. Returns either items or a blocking error (never both).
 */
export function buildFeedItems(product: FeedProduct): { items: FeedItem[]; error?: FeedItemError } {
  const reasons = validateProduct(product);
  if (reasons.length) return { items: [], error: { productId: product.id, reasons } };

  const images = (product.images || []).filter((u) => /^https?:\/\//i.test(u));
  const primaryImage = images[0];
  const additional = images.slice(1, 1 + MAX_ADDITIONAL_IMAGES);
  const description = plainText(product.description);
  const condition = FEED_CONDITION[product.feedCondition] ?? 'new';
  const link = productLink(product.id);
  const baseBrand = product.brand?.trim() || undefined;
  const baseCategory = product.category?.name || undefined;
  const gpc = product.googleProductCategory || undefined;

  const mk = (
    id: string,
    title: string,
    price: Prisma.Decimal,
    availability: FeedAvailability,
    gtin: string | undefined,
    itemGroupId?: string,
  ): FeedItem => ({
    id,
    itemGroupId,
    title: title.slice(0, 150),
    description,
    link,
    imageLink: primaryImage,
    additionalImageLinks: additional,
    availability,
    price: formatPrice(price),
    brand: baseBrand,
    condition,
    gtin,
    mpn: product.mpn || undefined,
    identifierExists: Boolean(gtin || product.mpn || baseBrand),
    googleProductCategory: gpc,
    productType: baseCategory,
    customLabel0: product.vendorId,
  });

  // No combos → single product row.
  if (product.variationCombos.length === 0) {
    return {
      items: [
        mk(
          product.id,
          product.name,
          product.price,
          availabilityFrom(product.stockQuantity, product.availabilityStatus),
          product.gtin || undefined,
        ),
      ],
    };
  }

  // Variants → one row per combo, all sharing item_group_id = product.id.
  const items = product.variationCombos.map((combo) => {
    const suffix = comboVariantSuffix(product, combo.optionIds);
    const title = suffix ? `${product.name} - ${suffix}` : product.name;
    return mk(
      `${product.id}_${combo.id}`,
      title,
      resolvePrice(combo.price, product.price),
      availabilityFrom(combo.stock, product.availabilityStatus),
      combo.gtin || product.gtin || undefined,
      product.id,
    );
  });
  return { items };
}

/** Build the full dataset (items + errors) for the whole catalog or a single vendor. */
export async function buildFeedDataset(opts: { vendorId?: string } = {}): Promise<FeedDataset> {
  const where: Prisma.ProductWhereInput = opts.vendorId
    ? { ...FEED_PRODUCT_WHERE, vendorId: opts.vendorId }
    : FEED_PRODUCT_WHERE;

  const products = await prisma.product.findMany({ where, include: FEED_INCLUDE });

  const items: FeedItem[] = [];
  const errors: FeedItemError[] = [];
  for (const p of products) {
    const { items: built, error } = buildFeedItems(p as FeedProduct);
    if (error) errors.push(error);
    else items.push(...built);
  }
  return { items, errors };
}

function itemToXml(it: FeedItem): string {
  const tags: string[] = [
    `<g:id>${escapeXml(it.id)}</g:id>`,
    it.itemGroupId ? `<g:item_group_id>${escapeXml(it.itemGroupId)}</g:item_group_id>` : '',
    `<g:title>${escapeXml(it.title)}</g:title>`,
    `<g:description>${escapeXml(it.description)}</g:description>`,
    `<g:link>${escapeXml(it.link)}</g:link>`,
    `<g:image_link>${escapeXml(it.imageLink)}</g:image_link>`,
    ...it.additionalImageLinks.map((u) => `<g:additional_image_link>${escapeXml(u)}</g:additional_image_link>`),
    `<g:availability>${it.availability}</g:availability>`,
    `<g:price>${escapeXml(it.price)}</g:price>`,
    `<g:condition>${it.condition}</g:condition>`,
    it.brand ? `<g:brand>${escapeXml(it.brand)}</g:brand>` : '',
    it.gtin ? `<g:gtin>${escapeXml(it.gtin)}</g:gtin>` : '',
    it.mpn ? `<g:mpn>${escapeXml(it.mpn)}</g:mpn>` : '',
    it.identifierExists ? '' : `<g:identifier_exists>false</g:identifier_exists>`,
    it.googleProductCategory ? `<g:google_product_category>${escapeXml(it.googleProductCategory)}</g:google_product_category>` : '',
    it.productType ? `<g:product_type>${escapeXml(it.productType)}</g:product_type>` : '',
    `<g:custom_label_0>${escapeXml(it.customLabel0)}</g:custom_label_0>`,
  ].filter(Boolean);
  return `    <item>\n      ${tags.join('\n      ')}\n    </item>`;
}

/** Serialize items into a Google-spec RSS 2.0 feed (also consumed by Meta). */
export function serializeFeedXml(items: FeedItem[], opts: { title?: string } = {}): string {
  const title = opts.title || 'Product feed';
  const body = items.map(itemToXml).join('\n');
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n` +
    `  <channel>\n` +
    `    <title>${escapeXml(title)}</title>\n` +
    `    <link>${escapeXml(STOREFRONT_BASE)}</link>\n` +
    `    <description>${escapeXml(title)}</description>\n` +
    `${body}\n` +
    `  </channel>\n` +
    `</rss>\n`
  );
}

/** End-to-end: build + serialize the feed for the whole catalog or one vendor. */
export async function generateFeedXml(opts: { vendorId?: string } = {}): Promise<{
  xml: string;
  includedCount: number;
  errorCount: number;
  errors: FeedItemError[];
}> {
  const { items, errors } = await buildFeedDataset(opts);
  const title = opts.vendorId ? `Vendor ${opts.vendorId} product feed` : 'Marketplace product feed';
  return {
    xml: serializeFeedXml(items, { title }),
    includedCount: items.length,
    errorCount: errors.length,
    errors,
  };
}
