import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ProductCard, type ProductCardData } from '@/components/storefront/ProductCard';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface Category {
  id: string; name: string; slug: string;
  description: string | null;
  imageUrl: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  metaImageUrl: string | null;
  parent: { id: string; name: string; slug: string } | null;
  children: { id: string; name: string; slug: string; imageUrl: string | null }[];
}

async function fetchCategory(slug: string): Promise<Category | null> {
  try {
    const res = await fetch(`${API}/api/categories/by-slug/${encodeURIComponent(slug)}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

type Filters = {
  purity?: string; stone?: string;
  priceMin?: string; priceMax?: string;
  gender?: string; jewelleryType?: string;
};

async function fetchProducts(slug: string, filters: Filters): Promise<ProductCardData[]> {
  try {
    const qs = new URLSearchParams({ category: slug, limit: '24' });
    for (const [k, v] of Object.entries(filters)) if (v) qs.set(k, v);
    const res = await fetch(`${API}/api/products?${qs.toString()}`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const data = await res.json();
    return data.items ?? [];
  } catch { return []; }
}

function pickFilter(searchParams: { [k: string]: string | string[] | undefined }): Filters {
  const pick = (k: string) => {
    const v = searchParams[k];
    return typeof v === 'string' && v.length > 0 ? v : undefined;
  };
  return {
    purity:        pick('purity'),
    stone:         pick('stone'),
    priceMin:      pick('priceMin'),
    priceMax:      pick('priceMax'),
    gender:        pick('gender'),
    jewelleryType: pick('jewelleryType'),
  };
}

function describeFilters(f: Filters): string {
  const bits: string[] = [];
  if (f.stone) bits.push(f.stone);
  if (f.purity) bits.push(f.purity.replace('K', '').replace('_', ' '));
  if (f.gender) bits.push(f.gender.toLowerCase());
  if (f.priceMin || f.priceMax) {
    bits.push(`₹${f.priceMin || 0}–${f.priceMax || '∞'}`);
  }
  return bits.join(' · ');
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const cat = await fetchCategory(params.slug);
  if (!cat) return { title: 'Category not found' };
  const title = cat.metaTitle || `${cat.name} — Vrindaonline`;
  const description = cat.metaDescription || cat.description || `Shop ${cat.name} at Vrindaonline.`;
  const image = cat.metaImageUrl || cat.imageUrl || undefined;
  return {
    title,
    description,
    openGraph: { title, description, images: image ? [image] : undefined },
    twitter: { card: 'summary_large_image', title, description, images: image ? [image] : undefined },
  };
}

export default async function CategoryLandingPage({ params, searchParams }: {
  params: { slug: string };
  searchParams: { [k: string]: string | string[] | undefined };
}) {
  const cat = await fetchCategory(params.slug);
  if (!cat) notFound();
  const filters = pickFilter(searchParams);
  const products = await fetchProducts(params.slug, filters);
  const filterLabel = describeFilters(filters);

  return (
    <div className="max-w-container mx-auto px-6 py-8">
      <nav className="text-xs text-ink-500 mb-4 flex items-center gap-1.5">
        <Link href="/" className="hover:text-brand-700">Home</Link>
        <span>/</span>
        <Link href="/products" className="hover:text-brand-700">All jewellery</Link>
        {cat.parent && <>
          <span>/</span>
          <Link href={`/c/${cat.parent.slug}`} className="hover:text-brand-700">{cat.parent.name}</Link>
        </>}
        <span>/</span>
        <span className="text-ink-900">{cat.name}</span>
      </nav>

      {/* Hero */}
      <div className="relative rounded-xl overflow-hidden bg-canvas border border-line mb-8">
        {cat.imageUrl && (
          <img src={cat.imageUrl} alt="" className="w-full h-56 md:h-72 object-cover" />
        )}
        <div className={cat.imageUrl ? 'absolute inset-0 bg-gradient-to-r from-ink-900/70 via-ink-900/40 to-transparent flex items-end p-6' : 'p-6'}>
          <div className={cat.imageUrl ? 'text-white' : 'text-ink-900'}>
            <h1 className="font-display text-3xl md:text-4xl">{cat.name}</h1>
            {cat.description && (
              <p className={`mt-2 text-sm md:text-base max-w-2xl ${cat.imageUrl ? 'text-white/90' : 'text-ink-700'}`}>
                {cat.description}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Subcategory chips */}
      {cat.children.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-8">
          <Link href={`/c/${cat.slug}`}
            className="text-sm rounded-pill px-4 py-2 border border-brand-600 bg-brand-50 text-brand-700 font-semibold">
            All {cat.name}
          </Link>
          {cat.children.map((kid) => (
            <Link key={kid.id} href={`/c/${kid.slug}`}
              className="text-sm rounded-pill px-4 py-2 border border-line bg-surface text-ink-700 hover:border-ink-300">
              {kid.name}
            </Link>
          ))}
        </div>
      )}

      {filterLabel && (
        <div className="mb-4 flex items-center gap-3 flex-wrap">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-500">Filtered by:</span>
          <span className="text-xs rounded-pill bg-brand-50 border border-brand-200 text-brand-700 px-3 py-1 font-semibold">{filterLabel}</span>
          <Link href={`/c/${cat.slug}`} className="text-xs text-ink-500 hover:text-ink-900 underline">Clear</Link>
        </div>
      )}

      {/* Products */}
      <div className="flex items-end justify-between mb-4">
        <p className="text-sm text-ink-700">{products.length} item{products.length === 1 ? '' : 's'}</p>
        <Link href={`/products?category=${cat.slug}`} className="text-sm font-semibold text-brand-700 hover:text-brand-800">
          See all in {cat.name} →
        </Link>
      </div>

      {products.length === 0 ? (
        <div className="rounded-md border border-dashed border-line p-12 text-center text-ink-500">
          No products in this category yet.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
          {products.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </div>
  );
}
