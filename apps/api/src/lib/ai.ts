import Anthropic from '@anthropic-ai/sdk';
import { nanoid } from 'nanoid';
import { BlocksArraySchema, validateBlocksForKind, type Block, type PageKind } from './blockSchemas';
import { defaultBlocksFor, type SystemPageKind } from './themePresets';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

let _client: Anthropic | null = null;
function client(): Anthropic | null {
  if (_client) return _client;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  _client = new Anthropic({ apiKey: key });
  return _client;
}

export function aiAvailable() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function extractJson(text: string): any {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fence ? fence[1] : text;
  const start = candidate!.indexOf('{');
  const startArr = candidate!.indexOf('[');
  const first = start >= 0 && (startArr < 0 || start < startArr) ? start : startArr;
  if (first < 0) throw new Error('No JSON found in AI response');
  return JSON.parse(candidate!.slice(first));
}

export interface GeneratedTheme {
  colors: {
    primary: string;
    accent: string;
    background: string;
    text: string;
    headerBg: string;
    headerText: string;
    footerBg: string;
    footerText: string;
  };
  typography: { headingFont: 'serif' | 'sans' | 'display'; bodyFont: 'serif' | 'sans' };
  header: { announcement?: string; showSearch: boolean; showMarketplaceLink: boolean };
  footer: { about?: string; copyright?: string };
}

const FALLBACK_THEMES: Record<string, GeneratedTheme> = {
  elegant: {
    colors: { primary: '#8B6F47', accent: '#D4AF37', background: '#FBF8F3', text: '#2A2118', headerBg: '#FBF8F3', headerText: '#2A2118', footerBg: '#2A2118', footerText: '#FBF8F3' },
    typography: { headingFont: 'serif', bodyFont: 'serif' },
    header: { showSearch: true, showMarketplaceLink: true, announcement: 'Free shipping on orders over ₹2,500' },
    footer: { about: 'Timeless pieces, lovingly crafted.', copyright: '© All rights reserved.' },
  },
  modern: {
    colors: { primary: '#0F172A', accent: '#F59E0B', background: '#FFFFFF', text: '#0F172A', headerBg: '#FFFFFF', headerText: '#0F172A', footerBg: '#0F172A', footerText: '#FFFFFF' },
    typography: { headingFont: 'sans', bodyFont: 'sans' },
    header: { showSearch: true, showMarketplaceLink: true },
    footer: { about: 'Modern jewelry for modern lives.', copyright: '© All rights reserved.' },
  },
  bohemian: {
    colors: { primary: '#7C2D12', accent: '#FB923C', background: '#FFF7ED', text: '#431407', headerBg: '#FFF7ED', headerText: '#431407', footerBg: '#431407', footerText: '#FFF7ED' },
    typography: { headingFont: 'display', bodyFont: 'serif' },
    header: { showSearch: true, showMarketplaceLink: true, announcement: 'Handmade with intention ✨' },
    footer: { about: 'Earthy, soulful jewelry from artisan hands.', copyright: '© All rights reserved.' },
  },
};

function fallbackTheme(brief: string): GeneratedTheme {
  const b = brief.toLowerCase();
  if (/modern|minimal|clean|sleek|contemporary/.test(b)) return FALLBACK_THEMES.modern!;
  if (/boho|bohem|earthy|artisan|handmade|rustic/.test(b)) return FALLBACK_THEMES.bohemian!;
  return FALLBACK_THEMES.elegant!;
}

export async function generateTheme(brief: string): Promise<{ theme: GeneratedTheme; source: 'ai' | 'fallback' }> {
  const c = client();
  if (!c) return { theme: fallbackTheme(brief), source: 'fallback' };

  const prompt = `You are a brand designer for a jewelry e-commerce shop. Based on this shop description, design a cohesive visual theme.

Shop description: ${brief}

Respond ONLY with a single JSON object matching this exact shape (no markdown, no commentary):
{
  "colors": {
    "primary": "#RRGGBB",     // main brand color
    "accent": "#RRGGBB",      // call-to-action / highlight
    "background": "#RRGGBB",  // page background
    "text": "#RRGGBB",        // body text
    "headerBg": "#RRGGBB",
    "headerText": "#RRGGBB",
    "footerBg": "#RRGGBB",
    "footerText": "#RRGGBB"
  },
  "typography": {
    "headingFont": "serif" | "sans" | "display",
    "bodyFont": "serif" | "sans"
  },
  "header": {
    "announcement": "string under 200 chars (or omit)",
    "showSearch": true,
    "showMarketplaceLink": true
  },
  "footer": {
    "about": "1-2 sentence brand summary under 500 chars",
    "copyright": "© Year ShopName. All rights reserved."
  }
}

All colors MUST be 6-char hex (#RRGGBB). Ensure good contrast: text on background, headerText on headerBg, footerText on footerBg.`;

  try {
    const msg = await c.messages.create({
      model: MODEL,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    const parsed = extractJson(text);
    return { theme: parsed as GeneratedTheme, source: 'ai' };
  } catch (e) {
    return { theme: fallbackTheme(brief), source: 'fallback' };
  }
}

export async function generatePageBlocks(
  brief: string,
  vendorContext: { shopName: string; sectionNames: string[]; pageKind?: PageKind }
): Promise<{ blocks: Block[]; source: 'ai' | 'fallback' }> {
  const kind: PageKind = vendorContext.pageKind ?? 'HOMEPAGE';
  const c = client();
  if (!c) return { blocks: fallbackBlocks(brief, vendorContext, kind), source: 'fallback' };

  const prompt = buildPrompt(brief, vendorContext, kind);

  try {
    const msg = await c.messages.create({
      model: MODEL,
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    const parsed = extractJson(text);
    if (!Array.isArray(parsed)) throw new Error('Expected array');
    const withIds = parsed.map((b: any) => ({ ...b, id: nanoid(10) }));
    const validated = BlocksArraySchema.safeParse(withIds);
    if (!validated.success) {
      return { blocks: fallbackBlocks(brief, vendorContext, kind), source: 'fallback' };
    }
    // Enforce per-kind palette + required blocks. If the AI strayed, fall back.
    const kindCheck = validateBlocksForKind(validated.data, kind);
    if (!kindCheck.ok) {
      return { blocks: fallbackBlocks(brief, vendorContext, kind), source: 'fallback' };
    }
    return { blocks: validated.data, source: 'ai' };
  } catch (e) {
    return { blocks: fallbackBlocks(brief, vendorContext, kind), source: 'fallback' };
  }
}

function buildPrompt(brief: string, ctx: { shopName: string; sectionNames: string[] }, kind: PageKind): string {
  const head = `You are a jewelry-shop page designer for "${ctx.shopName}". Brief: ${brief}\n\n`;
  const tail = `\nRules:
- Output a single JSON array, no markdown fences, no commentary.
- Headlines/copy must be specific to this shop, not generic.
- Use HTML in richText: only <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em>.`;

  if (kind === 'HOMEPAGE' || kind === 'CUSTOM') {
    return head + `Build a ${kind === 'HOMEPAGE' ? 'homepage' : 'page'} with 3–6 blocks chosen from:

Hero: { "type":"hero", "settings":{ "headline": str, "subheadline": str, "ctaLabel": str, "ctaHref":"#products", "backgroundImageUrl":"", "alignment":"center", "height":"md" } }
ProductGrid: { "type":"productGrid", "settings":{ "heading": str, "source":"all", "sectionId":"", "productIds":[], "columns": 3, "limit": 12 } }
RichText: { "type":"richText", "settings":{ "html": "<h2>Title</h2><p>Body</p>", "maxWidth":"medium", "align":"left" } }
FeatureStrip: { "type":"featureStrip", "settings":{ "heading":"", "background":"canvas", "items":[ { "iconUrl":"", "label": str, "sublabel": str, "href":"" } ] } }
EmailCapture: { "type":"emailCapture", "settings":{ "heading": str, "subheading": str, "ctaLabel":"Sign up", "background":"canvas" } }

Available shop sections (reference in copy; ProductGrid.source stays "all" unless a section is clearly relevant): ${ctx.sectionNames.join(', ') || '(none yet)'}

Typical order: Hero → ProductGrid → FeatureStrip → RichText → EmailCapture.` + tail;
  }

  if (kind === 'PDP') {
    return head + `Build a PRODUCT DETAIL PAGE layout. The first 4 blocks MUST be (in order): pdpGallery, pdpSummary, pdpVariants, pdpQuantityCart. Then choose from the optional blocks below to enhance the page (4–7 extra). Settings are mostly toggles — copy goes in headings and trust-strip labels.

REQUIRED (include all four, in this order):
{ "type":"pdpGallery",      "settings":{ "position":"left", "zoom":true } }
{ "type":"pdpSummary",      "settings":{ "showVendor":true, "showRating":true, "sticky":true } }
{ "type":"pdpVariants",     "settings":{ "showSizeGuide":true, "sizeGuideUrl":"" } }
{ "type":"pdpQuantityCart", "settings":{ "showBuyNow":true, "showWishlist":true, "ctaLabel":"Add to bag" } }

OPTIONAL (pick what fits the brand):
{ "type":"pdpTrustStrip",        "settings":{ "items":[ { "iconUrl":"", "label": str, "sublabel": str } ] } }
{ "type":"pdpAttributes",        "settings":{ "heading":"Details" } }
{ "type":"pdpDescription",       "settings":{ "heading":"About this piece", "collapsible":false } }
{ "type":"pdpPersonalization",   "settings":{ "heading":"Make it yours" } }
{ "type":"pdpShippingEstimator", "settings":{ "heading":"Check delivery" } }
{ "type":"pdpReviews",           "settings":{ "heading":"Reviews", "showWriteReview":true } }
{ "type":"pdpRelatedProducts",   "settings":{ "heading": str, "source":"section", "columns":4, "limit":8 } }
{ "type":"featureStrip",         "settings":{ "heading":"", "background":"canvas", "items":[ { "iconUrl":"", "label": str, "sublabel": str, "href":"" } ] } }
{ "type":"faq",                  "settings":{ "heading":"Questions answered", "items":[ { "question": str, "answer": str } ] } }

Reviews + related products are usually last.` + tail;
  }

  if (kind === 'CART') {
    return head + `Build a CART page. Required blocks (in order): cartLineItems, cartSummary. Add 1–3 optional blocks to make the cart feel premium.

REQUIRED:
{ "type":"cartLineItems", "settings":{ "showThumbnail":true, "showRemove":true } }
{ "type":"cartSummary",   "settings":{ "showCoupon":true, "ctaLabel":"Proceed to checkout" } }

OPTIONAL:
{ "type":"cartAnnouncement", "settings":{ "text": str (short marketing copy), "background":"brand" } }
{ "type":"cartTrustStrip",   "settings":{ "items":[ { "iconUrl":"", "label": str } ] } }
{ "type":"cartUpsell",       "settings":{ "heading": str, "source":"related", "sectionId":"", "limit":6 } }

Typical order: cartAnnouncement (top) → cartLineItems → cartSummary → cartTrustStrip → cartUpsell.` + tail;
  }

  // CHECKOUT
  return head + `Build a CHECKOUT page. The payment flow is fixed: include the four required block markers in order, then optionally decorate around them with announcement / trust strip / gift wrap / custom fields.

REQUIRED (these are markers; copy is mostly cosmetic):
{ "type":"checkoutSteps",         "settings":{} }
{ "type":"checkoutAddressForm",   "settings":{ "heading":"Delivery address" } }
{ "type":"checkoutShipping",      "settings":{ "heading":"Shipping method" } }
{ "type":"checkoutPayment",       "settings":{ "heading":"Payment" } }
{ "type":"checkoutOrderSummary",  "settings":{ "position":"sidebar" } }

OPTIONAL:
{ "type":"checkoutAnnouncement",  "settings":{ "text": str, "background":"brand" } }
{ "type":"checkoutTrustStrip",    "settings":{ "items":[ { "iconUrl":"", "label": str } ] } }
{ "type":"checkoutGiftWrap",      "settings":{ "heading":"Add a gift wrap", "price": number } }
{ "type":"checkoutCustomFields",  "settings":{ "heading": str, "fields":[ { "key": str (lowercase, no spaces), "label": str, "type":"text"|"textarea"|"select", "required": bool, "options":[] } ] } }

Put an announcement at the top and a trust strip at the bottom; gift wrap goes after the announcement.` + tail;
}

function fallbackBlocks(
  brief: string,
  ctx: { shopName: string; sectionNames: string[] },
  kind: PageKind,
): Block[] {
  if (kind === 'PDP' || kind === 'CART' || kind === 'CHECKOUT') {
    // Use the same defaults the presets ship with — guaranteed to pass validation.
    return defaultBlocksFor(kind as SystemPageKind).map((b) => ({ ...b, id: nanoid(10) })) as Block[];
  }
  // HOMEPAGE / CUSTOM
  return [
    {
      id: nanoid(10),
      type: 'hero',
      settings: {
        headline: `Welcome to ${ctx.shopName}`,
        subheadline: brief.slice(0, 200) || 'Handcrafted jewelry, made with care.',
        ctaLabel: 'Shop now',
        ctaHref: '#products',
        backgroundImageUrl: '',
        alignment: 'center',
        height: 'md',
      },
    } as any,
    {
      id: nanoid(10),
      type: 'productGrid',
      settings: { heading: 'Featured pieces', source: 'all', sectionId: '', productIds: [], columns: 3, limit: 12 },
    } as any,
    {
      id: nanoid(10),
      type: 'richText',
      settings: {
        html: `<h2>Our story</h2><p>${brief || 'We create timeless jewelry, one piece at a time.'}</p>`,
        maxWidth: 'medium',
        align: 'left',
      },
    } as any,
  ];
}
