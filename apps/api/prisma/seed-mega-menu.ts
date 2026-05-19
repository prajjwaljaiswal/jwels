import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Templated sections that get auto-applied to every top-level jewellery category.
// {slug} is replaced with the parent slug so links go to /c/<parent>?stone=…
const STONES = ['Diamond', 'Ruby', 'Emerald', 'Sapphire', 'Pearl', 'CZ / American Diamond'];
const LAB_STONES = ['Lab-grown diamond', 'Moissanite'];
const PURITIES: { label: string; value: string }[] = [
  { label: '14 KT Gold', value: 'K14' },
  { label: '18 KT Gold', value: 'K18' },
  { label: '22 KT Gold', value: 'K22' },
  { label: 'Silver 925', value: 'SILVER_925' },
];
const PRICE_BANDS: { label: string; min?: number; max?: number }[] = [
  { label: 'Under ₹10,000',           max: 10000 },
  { label: '₹10,000 – ₹25,000',       min: 10000, max: 25000 },
  { label: '₹25,000 – ₹50,000',       min: 25000, max: 50000 },
  { label: '₹50,000 – ₹1,00,000',     min: 50000, max: 100000 },
  { label: 'Above ₹1,00,000',         min: 100000 },
];

function priceHref(slug: string, b: { min?: number; max?: number }) {
  const qs = new URLSearchParams();
  if (b.min) qs.set('priceMin', String(b.min));
  if (b.max) qs.set('priceMax', String(b.max));
  return `/c/${slug}?${qs.toString()}`;
}

async function seedSectionsForCategory(catId: string, catName: string, catSlug: string, children: { id: string; name: string; slug: string }[]) {
  // Wipe existing sections so re-runs are idempotent.
  await prisma.categoryMenuSection.deleteMany({ where: { categoryId: catId } });

  // FEATURED — links to the children (the style subcategories already seeded)
  if (children.length > 0) {
    await prisma.categoryMenuSection.create({
      data: {
        categoryId: catId, title: 'Featured', sortOrder: 0,
        items: {
          create: children.slice(0, 8).map((kid, i) => ({
            label: kid.name, href: `/c/${kid.slug}`, sortOrder: i,
          })),
        },
      },
    });
  }

  // NATURAL GEMSTONE
  await prisma.categoryMenuSection.create({
    data: {
      categoryId: catId, title: `Natural Gemstone ${catName}`, sortOrder: 10,
      items: {
        create: STONES.map((s, i) => ({
          label: `${s} ${catName}`,
          href: `/c/${catSlug}?stone=${encodeURIComponent(s)}`,
          sortOrder: i,
        })),
      },
    },
  });

  // LAB-GROWN
  await prisma.categoryMenuSection.create({
    data: {
      categoryId: catId, title: `Lab-Grown ${catName}`, sortOrder: 20,
      items: {
        create: LAB_STONES.map((s, i) => ({
          label: `${s} ${catName}`,
          href: `/c/${catSlug}?stone=${encodeURIComponent(s)}`,
          sortOrder: i,
        })),
      },
    },
  });

  // BY METAL PURITY
  await prisma.categoryMenuSection.create({
    data: {
      categoryId: catId, title: `${catName} by Metal Purity`, sortOrder: 30,
      items: {
        create: PURITIES.map((p, i) => ({
          label: `${p.label} ${catName}`,
          href: `/c/${catSlug}?purity=${p.value}`,
          sortOrder: i,
        })),
      },
    },
  });

  // BY PRICE RANGE
  await prisma.categoryMenuSection.create({
    data: {
      categoryId: catId, title: `${catName} by Price Range`, sortOrder: 40,
      items: {
        create: PRICE_BANDS.map((b, i) => ({
          label: b.label, href: priceHref(catSlug, b), sortOrder: i,
        })),
      },
    },
  });
}

async function seedCollections() {
  const collections = [
    {
      slug: 'engagement-wedding',
      name: 'Engagement & Wedding',
      description: 'Rings, bands and bridal sets for the big moment.',
      sortOrder: 0,
      featured: true,
    },
    {
      slug: 'bridal',
      name: 'Bridal',
      description: 'Curated bridal sets, mangalsutras and statement pieces.',
      sortOrder: 10,
      featured: true,
    },
    {
      slug: 'gifts',
      name: 'Gifts',
      description: 'Thoughtful jewellery gifts for every occasion.',
      sortOrder: 20,
      featured: true,
    },
    {
      slug: 'mens-jewellery',
      name: "Men's Jewellery",
      description: 'Rings, cufflinks, kadas and chains for him.',
      sortOrder: 30,
    },
    {
      slug: 'new-arrivals',
      name: 'New Arrivals',
      description: 'The latest additions across every category.',
      sortOrder: 40,
    },
  ];
  for (const c of collections) {
    await prisma.collection.upsert({
      where: { slug: c.slug },
      update: { name: c.name, description: c.description, sortOrder: c.sortOrder, featured: c.featured ?? false, isActive: true },
      create: { ...c, isActive: true },
    });
  }
  console.log(`[ok] upserted ${collections.length} collections`);
}

async function main() {
  // Only seed menu sections for top-level jewellery categories
  const roots = await prisma.category.findMany({
    where: { parentId: null, isActive: true },
    include: {
      children: {
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: { id: true, name: true, slug: true },
      },
    },
    orderBy: { sortOrder: 'asc' },
  });

  for (const root of roots) {
    await seedSectionsForCategory(root.id, root.name, root.slug, root.children);
    console.log(`[ok] menu sections seeded for "${root.name}"`);
  }

  await seedCollections();
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
