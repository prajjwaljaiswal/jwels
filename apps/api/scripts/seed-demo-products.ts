// Seed demo products for the Jewel Demo Store so the storefront product grids fill.
// Idempotent: re-running deletes this script's previously-seeded demo products first
// (matched by SKU prefix) and recreates them.
import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

const VENDOR_ID = '5d871f62-581b-40a7-a5df-186e183a7c9b'; // Jewel Demo Store
const SKU_PREFIX = 'DEMO-';

const img = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=900&q=80`;

// VERIFIED pool — only photo IDs confirmed to render in-browser (these are the
// same IDs shipped in the heirloom theme preset, which display on the homepage).
// Unsplash rejects non-browser HEAD/GET checks, so the browser is the only source
// of truth; reusing this known-good set guarantees the grids + PDP galleries fill.
const PIC = {
  ring:        '1605100804763-247f67b3557e',
  bench:       '1611591437281-460bfbe1220a',
  necklace:    '1599643478518-a784e5dc4c8f',
  necklaceAlt: '1515562141207-7a88fb7ce338',
  earrings:    '1535632066927-ab7c9ab60908',
  earringsAlt: '1602173574767-37ac01994b2a',
  bangle:      '1611652022419-a9419f74343d',
  bangleAlt:   '1588444650733-d0767b753fc8',
  stack:       '1617038220319-276d3cfab638',
  journal:     '1573408301185-9146fe634ad0',
};

// Each item: preferred leaf-category slug + product data. We resolve categories at
// runtime; any unmatched slug falls back to the first leaf category we found.
type Item = {
  catSlug: string; name: string; price: number; stock: number;
  photos: string[]; featured?: boolean; jewelleryType: 'FINE' | 'FASHION';
  metal?: string; hallmarked?: boolean;
};

const ITEMS: Item[] = [
  { catSlug: 'rings-engagement', name: 'Solitaire Diamond Ring', price: 45000, stock: 8, photos: [PIC.ring, PIC.bench], featured: true, jewelleryType: 'FINE', metal: 'Gold', hallmarked: true },
  { catSlug: 'rings-cocktail',   name: 'Emerald Halo Cocktail Ring', price: 32000, stock: 5, photos: [PIC.ring, PIC.stack], jewelleryType: 'FINE', metal: 'Gold', hallmarked: true },
  { catSlug: 'rings-daily',      name: 'Rose Gold Twist Band', price: 18500, stock: 14, photos: [PIC.bench, PIC.ring], jewelleryType: 'FINE', metal: 'Rose Gold', hallmarked: true },
  { catSlug: 'necklaces-choker', name: 'Diamond Choker Necklace', price: 65000, stock: 3, photos: [PIC.necklace, PIC.necklaceAlt], featured: true, jewelleryType: 'FINE', metal: 'Gold', hallmarked: true },
  { catSlug: 'necklaces-beaded', name: 'Gold Layered Necklace', price: 28000, stock: 9, photos: [PIC.necklaceAlt, PIC.necklace], jewelleryType: 'FINE', metal: 'Gold', hallmarked: true },
  { catSlug: 'pendants-cluster', name: 'Pearl Drop Pendant', price: 15500, stock: 18, photos: [PIC.necklace, PIC.journal], jewelleryType: 'FASHION', metal: 'Silver' },
  { catSlug: 'earrings-drops',   name: 'Diamond Stud Earrings', price: 19500, stock: 22, photos: [PIC.earrings, PIC.earringsAlt], featured: true, jewelleryType: 'FINE', metal: 'Gold', hallmarked: true },
  { catSlug: 'earrings-chandbalis', name: 'Gold Chandbali Earrings', price: 26000, stock: 7, photos: [PIC.earringsAlt, PIC.earrings], jewelleryType: 'FINE', metal: 'Gold', hallmarked: true },
  { catSlug: 'earrings-danglers', name: 'Rose Gold Hoop Earrings', price: 12500, stock: 30, photos: [PIC.stack, PIC.earrings], jewelleryType: 'FASHION', metal: 'Rose Gold' },
  { catSlug: 'bangles-daily',    name: 'Gold Kada Bangle', price: 38000, stock: 6, photos: [PIC.bangle, PIC.bangleAlt], featured: true, jewelleryType: 'FINE', metal: 'Gold', hallmarked: true },
  { catSlug: 'bangles-cuff',     name: 'Rose Gold Cuff Bangle', price: 29500, stock: 11, photos: [PIC.bangleAlt, PIC.bangle], jewelleryType: 'FINE', metal: 'Rose Gold', hallmarked: true },
  { catSlug: 'bracelets-chain',  name: 'Diamond Tennis Bracelet', price: 42000, stock: 4, photos: [PIC.stack, PIC.bangleAlt], jewelleryType: 'FINE', metal: 'Gold', hallmarked: true },
];

function slugify(name: string, i: number) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-demo-' + i;
}

async function main() {
  const vendor = await prisma.vendor.findUnique({ where: { id: VENDOR_ID } });
  if (!vendor) throw new Error('demo vendor not found');

  // Resolve categories for all referenced slugs (+ a leaf fallback).
  const slugs = [...new Set(ITEMS.map((it) => it.catSlug))];
  const cats = await prisma.category.findMany({ where: { slug: { in: slugs } }, select: { id: true, slug: true } });
  const bySlug = new Map(cats.map((c) => [c.slug!, c.id]));
  const fallback = await prisma.category.findFirst({ where: { children: { none: {} } }, select: { id: true } });
  if (!fallback) throw new Error('no leaf category available');

  // Clean prior demo products from this script (idempotent).
  const del = await prisma.product.deleteMany({ where: { vendorId: VENDOR_ID, sku: { startsWith: SKU_PREFIX } } });
  if (del.count) console.log(`removed ${del.count} prior demo products`);

  let n = 0;
  for (let i = 0; i < ITEMS.length; i++) {
    const it = ITEMS[i];
    const categoryId = bySlug.get(it.catSlug) ?? fallback.id;
    await prisma.product.create({
      data: {
        vendorId: VENDOR_ID,
        name: it.name,
        slug: slugify(it.name, i),
        sku: `${SKU_PREFIX}${String(i + 1).padStart(3, '0')}`,
        categoryId,
        price: it.price,
        stockQuantity: it.stock,
        images: it.photos.map(img),
        imageAlts: it.photos.map(() => it.name),
        description: `${it.name} — hand-finished and quality-checked. A demo listing for the Jewel Demo Store storefront.`,
        highlights: ['Hand-finished', it.hallmarked ? 'BIS-hallmarked' : 'Skin-friendly finish', 'Ships in 2 business days'],
        isActive: true,
        status: 'ACTIVE',
        jewelleryType: it.jewelleryType as any,
        metalType: it.metal?.toLowerCase(),
        baseMetal: it.metal,
        hallmarked: !!it.hallmarked,
        certifiedBy: it.hallmarked ? 'BIS' : null,
        featured: !!it.featured,
      },
    });
    n++;
  }
  console.log(`seeded ${n} demo products for ${vendor.shopName}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
