/**
 * Seeds 2 Etsy-style listings exercising Phase 2 + 3 + 4 fields:
 * variations + combos, tags, materials, personalization, return policy,
 * and shop section. Idempotent — re-running won't duplicate.
 *
 * Run with:  npx tsx prisma/seed-phase4-products.ts
 */
import { PrismaClient, ItemType, WhoMade, ProductType, RenewalMode, ProductStatus } from '@prisma/client';

const prisma = new PrismaClient();

const VENDOR_ID = '3cfc0782-1adc-451a-85ff-a42d349b8480'; // Vrinda Jwels
const CAT = {
  rings:     '5d987f02-9999-447f-bada-c3c301875810',
  necklaces: '62fe0a8b-1dec-496f-ac9b-d081535f3376',
};

function img(id: string, params = 'w=1200&fit=crop&q=80') {
  return `https://images.unsplash.com/photo-${id}?${params}`;
}

interface SeedListing {
  name: string;
  description: string;
  categoryId: string;
  basePrice: number;
  baseStock: number;
  metalType: string;
  materials: string[];
  tags: string[];
  images: string[];
  whenMade: string;
  whoMade: WhoMade;
  productType: ProductType;
  renewalMode: RenewalMode;
  acceptsOffers: boolean;
  featured: boolean;
  personalization?: { enabled: boolean; instructions: string; charLimit: number };
  variations: { name: string; options: string[] }[];
  // Combo overrides keyed by joined option-values (e.g. "6|Yellow gold")
  comboOverrides?: Record<string, { price?: number; stock?: number; sku?: string }>;
  returnPolicyName: string;
  shopSectionName: string;
}

const LISTINGS: SeedListing[] = [
  {
    name: 'Heritage Solitaire Ring – Customizable',
    description:
      "A timeless solitaire crafted by hand in our Jaipur atelier. The brilliant-cut stone sits on a tapered band that's polished to a mirror finish.\n\n• Hallmarked metal · BIS certified\n• Conflict-free natural diamond / lab-grown options\n• Made-to-order in 7–10 days\n\nSelect your ring size and preferred metal. Engraving available — leave us a note at checkout.",
    categoryId: CAT.rings,
    basePrice: 42000,
    baseStock: 0, // stock is per-combo
    metalType: 'gold',
    materials: ['22kt Gold', 'Natural Diamond', 'BIS Hallmarked'],
    tags: ['solitaire', 'engagement', 'diamond', 'handmade', 'bridal', 'wedding', 'gift'],
    images: [
      img('1605100804763-247f67b3557e'),
      img('1515562141207-7a88fb7ce338'),
      img('1573408301185-9519f94815b3'),
    ],
    whenMade: 'made_to_order',
    whoMade: WhoMade.TEAM,
    productType: ProductType.FINISHED,
    renewalMode: RenewalMode.AUTOMATIC,
    acceptsOffers: false,
    featured: true,
    personalization: {
      enabled: true,
      instructions: 'Engraving (optional, up to 12 characters). Leave blank for no engraving.',
      charLimit: 12,
    },
    variations: [
      { name: 'Size',  options: ['6', '7', '8', '9'] },
      { name: 'Metal', options: ['Yellow Gold', 'Rose Gold', 'White Gold'] },
    ],
    comboOverrides: {
      '6|Yellow Gold':  { stock: 5, sku: 'HSR-Y-6' },
      '7|Yellow Gold':  { stock: 8, sku: 'HSR-Y-7' },
      '8|Yellow Gold':  { stock: 6, sku: 'HSR-Y-8' },
      '9|Yellow Gold':  { stock: 4, sku: 'HSR-Y-9' },
      '6|Rose Gold':    { stock: 3, price: 43500, sku: 'HSR-R-6' },
      '7|Rose Gold':    { stock: 5, price: 43500, sku: 'HSR-R-7' },
      '8|Rose Gold':    { stock: 4, price: 43500, sku: 'HSR-R-8' },
      '9|Rose Gold':    { stock: 2, price: 43500, sku: 'HSR-R-9' },
      '6|White Gold':   { stock: 4, price: 44000, sku: 'HSR-W-6' },
      '7|White Gold':   { stock: 6, price: 44000, sku: 'HSR-W-7' },
      '8|White Gold':   { stock: 3, price: 44000, sku: 'HSR-W-8' },
      '9|White Gold':   { stock: 2, price: 44000, sku: 'HSR-W-9' },
    },
    returnPolicyName: 'Standard 14-day returns',
    shopSectionName: 'Bridal & Engagement',
  },
  {
    name: 'Layered Sterling Silver Choker Set',
    description:
      "Three hand-finished sterling silver chains in graduated lengths — wear them stacked or solo.\n\n• 92.5 sterling silver, anti-tarnish coated\n• Lengths: 14\", 16\", 18\"\n• Adjustable lobster clasps\n\nPerfect for everyday layering or an effortless evening look.",
    categoryId: CAT.necklaces,
    basePrice: 3500,
    baseStock: 0,
    metalType: 'silver',
    materials: ['925 Sterling Silver', 'Anti-tarnish coating'],
    tags: ['layered', 'choker', 'silver', 'minimal', 'everyday', 'set', 'boho'],
    images: [
      img('1548048026-5a1a941d93d3'),
      img('1601121781101-dbaeae7e3e06'),
      img('1599643478518-a784e5dc4c8f'),
    ],
    whenMade: '2020s',
    whoMade: WhoMade.I_DID,
    productType: ProductType.FINISHED,
    renewalMode: RenewalMode.AUTOMATIC,
    acceptsOffers: true,
    featured: false,
    variations: [
      { name: 'Finish', options: ['Polished', 'Brushed', 'Oxidized'] },
    ],
    comboOverrides: {
      'Polished':  { stock: 18, sku: 'LSC-P' },
      'Brushed':   { stock: 12, sku: 'LSC-B', price: 3700 },
      'Oxidized':  { stock: 9,  sku: 'LSC-O', price: 3700 },
    },
    returnPolicyName: 'Standard 14-day returns',
    shopSectionName: 'Everyday essentials',
  },
];

async function ensureReturnPolicy(name: string) {
  const existing = await prisma.vendorReturnPolicy.findFirst({
    where: { vendorId: VENDOR_ID, name },
  });
  if (existing) return existing;
  return prisma.vendorReturnPolicy.create({
    data: {
      vendorId: VENDOR_ID,
      name,
      accepted: true,
      days: 14,
      buyerPaysReturn: true,
      notes: 'Items must be unworn, in their original packaging. Returns initiated within 14 days of delivery.',
    },
  });
}

async function ensureSection(name: string) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const existing = await prisma.vendorSection.findUnique({
    where: { vendorId_slug: { vendorId: VENDOR_ID, slug } },
  });
  if (existing) return existing;
  return prisma.vendorSection.create({
    data: { vendorId: VENDOR_ID, name, slug, position: 0 },
  });
}

async function main() {
  const vendor = await prisma.vendor.findUnique({ where: { id: VENDOR_ID } });
  if (!vendor) {
    console.error(`Vendor ${VENDOR_ID} not found. Run the main seed first.`);
    process.exit(1);
  }
  console.log(`Seeding 2 listings for ${vendor.shopName}...\n`);

  let created = 0;
  let skipped = 0;

  for (const L of LISTINGS) {
    const existing = await prisma.product.findFirst({
      where: { vendorId: VENDOR_ID, name: L.name },
    });
    if (existing) {
      console.log(`  ↷ ${L.name} (already exists)`);
      skipped++;
      continue;
    }

    const policy  = await ensureReturnPolicy(L.returnPolicyName);
    const section = await ensureSection(L.shopSectionName);

    await prisma.$transaction(async (tx) => {
      // 1. Create product with all Phase-2 fields
      const product = await tx.product.create({
        data: {
          vendorId:        VENDOR_ID,
          name:            L.name,
          description:     L.description,
          categoryId:      L.categoryId,
          metalType:       L.metalType,
          price:           L.basePrice,
          stockQuantity:   L.baseStock,
          images:          L.images,
          isActive:        true,
          status:          ProductStatus.ACTIVE,
          itemType:        ItemType.PHYSICAL,
          whenMade:        L.whenMade,
          whoMade:         L.whoMade,
          productType:     L.productType,
          tags:            L.tags,
          materials:       L.materials,
          acceptsOffers:   L.acceptsOffers,
          featured:        L.featured,
          renewalMode:     L.renewalMode,
          personalization: L.personalization ?? null,
          shopSectionId:   section.id,
          returnPolicyId:  policy.id,
        },
      });

      // 2. Variations + options
      const optionIdByValue = new Map<string, string>(); // "Variation::Value" -> optionId
      for (let vi = 0; vi < L.variations.length; vi++) {
        const v = L.variations[vi];
        const variation = await tx.productVariation.create({
          data: {
            productId: product.id,
            name:      v.name,
            position:  vi,
            options: { create: v.options.map((value, idx) => ({ value, position: idx })) },
          },
          include: { options: true },
        });
        for (const opt of variation.options) {
          optionIdByValue.set(`${v.name}::${opt.value}`, opt.id);
        }
      }

      // 3. Cartesian product → combos with overrides applied
      const variationLists = L.variations.map((v) => v.options.map((value) => ({ name: v.name, value })));
      const cartesian = variationLists.reduce<{ name: string; value: string }[][]>(
        (acc, list) => acc.length === 0 ? list.map((x) => [x]) : acc.flatMap((row) => list.map((x) => [...row, x])),
        [],
      );

      for (const combo of cartesian) {
        const optionIds = combo.map((c) => optionIdByValue.get(`${c.name}::${c.value}`)!);
        const key = combo.map((c) => c.value).join('|');
        const override = L.comboOverrides?.[key] ?? {};
        await tx.productVariationCombo.create({
          data: {
            productId: product.id,
            optionIds,
            price: override.price ?? null,
            stock: override.stock ?? 0,
            sku:   override.sku   ?? null,
          },
        });
      }
    });

    console.log(`  ✓ ${L.name}`);
    created++;
  }

  console.log(`\nDone — ${created} created, ${skipped} skipped.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
