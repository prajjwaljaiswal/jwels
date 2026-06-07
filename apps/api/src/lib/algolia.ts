import { algoliasearch, type SearchClient } from 'algoliasearch';
import { prisma } from './prisma';

const appId = process.env.ALGOLIA_APP_ID || '';
const adminKey = process.env.ALGOLIA_ADMIN_KEY || '';
const prefix = process.env.ALGOLIA_INDEX_PREFIX || 'jewel';

export const PRODUCTS_INDEX = `${prefix}_products`;

let client: SearchClient | null = null;
function getClient(): SearchClient | null {
  if (!appId || !adminKey) return null;
  if (!client) client = algoliasearch(appId, adminKey);
  return client;
}

export function algoliaEnabled(): boolean {
  return !!appId && !!adminKey;
}

interface IndexableProduct {
  objectID: string;
  name: string;
  description: string | null;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  vendorId: string;
  vendorName: string;
  price: number;
  inStock: boolean;
  stockQuantity: number;
  metalType: string | null;
  materials: string[];
  tags: string[];
  featured: boolean;
  image: string | null;
  averageRating: number;
  reviewCount: number;
  createdAtTs: number;
}

async function buildRecord(productId: string): Promise<IndexableProduct | null> {
  const p = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      vendor: { select: { id: true, shopName: true } },
      category: { select: { id: true, name: true, slug: true } },
      reviews: { select: { rating: true } },
    },
  });
  if (!p) return null;
  const ratings = p.reviews.map((r) => r.rating);
  const avg = ratings.length ? ratings.reduce((s, n) => s + n, 0) / ratings.length : 0;
  return {
    objectID: p.id,
    name: p.name,
    description: p.description,
    categoryId: p.categoryId,
    categoryName: p.category.name,
    categorySlug: p.category.slug,
    vendorId: p.vendorId,
    vendorName: p.vendor.shopName,
    price: Number(p.price),
    inStock: p.stockQuantity > 0,
    stockQuantity: p.stockQuantity,
    metalType: p.metalType,
    materials: p.materials ?? [],
    tags: p.tags ?? [],
    featured: p.featured,
    image: p.images[0] ?? null,
    averageRating: Number(avg.toFixed(2)),
    reviewCount: ratings.length,
    createdAtTs: p.createdAt.getTime(),
  };
}

export async function indexProduct(productId: string): Promise<void> {
  const c = getClient();
  if (!c) return;
  const record = await buildRecord(productId);
  if (!record) return;
  // Only push ACTIVE products — drafts and inactive products shouldn't be searchable
  const p = await prisma.product.findUnique({ where: { id: productId }, select: { isActive: true, status: true } });
  if (!p || !p.isActive || p.status !== 'ACTIVE') {
    await removeProductFromIndex(productId);
    return;
  }
  await c.saveObject({ indexName: PRODUCTS_INDEX, body: record });
}

export async function removeProductFromIndex(productId: string): Promise<void> {
  const c = getClient();
  if (!c) return;
  await c.deleteObject({ indexName: PRODUCTS_INDEX, objectID: productId });
}

/** Re-push every active product. Used by scripts/reindex.ts and manual ops. */
export async function reindexAll(): Promise<{ pushed: number }> {
  const c = getClient();
  if (!c) throw new Error('Algolia not configured (ALGOLIA_APP_ID / ALGOLIA_ADMIN_KEY missing)');
  const products = await prisma.product.findMany({
    where: { isActive: true, status: 'ACTIVE' },
    select: { id: true },
  });
  const records: IndexableProduct[] = [];
  for (const { id } of products) {
    const rec = await buildRecord(id);
    if (rec) records.push(rec);
  }
  if (records.length > 0) {
    await c.saveObjects({
      indexName: PRODUCTS_INDEX,
      objects: records as unknown as Record<string, unknown>[],
    });
  }
  return { pushed: records.length };
}

/** One-time setup: configure searchable attributes, facets, ranking, synonyms. */
export async function configureIndex(): Promise<void> {
  const c = getClient();
  if (!c) throw new Error('Algolia not configured');
  await c.setSettings({
    indexName: PRODUCTS_INDEX,
    indexSettings: {
      searchableAttributes: [
        'name',
        'unordered(description)',
        'tags',
        'materials',
        'categoryName',
        'vendorName',
        'metalType',
      ],
      attributesForFaceting: [
        'searchable(categoryName)',
        'searchable(vendorName)',
        'filterOnly(vendorId)',
        'filterOnly(categoryId)',
        'filterOnly(categorySlug)',
        'metalType',
        'materials',
        'tags',
        'inStock',
        'featured',
        'price',
        'averageRating',
      ],
      customRanking: ['desc(featured)', 'desc(averageRating)', 'desc(reviewCount)', 'desc(createdAtTs)'],
      ranking: ['typo', 'geo', 'words', 'filters', 'proximity', 'attribute', 'exact', 'custom'],
      attributesToHighlight: ['name', 'description'],
      attributesToSnippet: ['description:30'],
      highlightPreTag: '<mark>',
      highlightPostTag: '</mark>',
    },
  });

  // Synonyms — Indian jewellery jargon → English. Two-way.
  const synonyms = [
    ['jhumka', 'jhumki', 'earring', 'earrings'],
    ['kada', 'bangle', 'bracelet'],
    ['mangalsutra', 'necklace', 'pendant'],
    ['nath', 'nose ring', 'nosepin'],
    ['payal', 'anklet'],
    ['maang tikka', 'forehead ornament'],
    ['kundan', 'polki'],
    ['haar', 'necklace'],
    ['chudi', 'bangle'],
    ['gold', 'sona'],
    ['silver', 'chandi'],
  ];
  await c.saveSynonyms({
    indexName: PRODUCTS_INDEX,
    synonymHit: synonyms.map((words, i) => ({
      objectID: `syn_${i}`,
      type: 'synonym' as const,
      synonyms: words,
    })),
    replaceExistingSynonyms: true,
  });
}
