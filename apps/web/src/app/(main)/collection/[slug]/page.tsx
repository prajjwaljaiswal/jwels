import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ProductCard, type ProductCardData } from '@/components/storefront/ProductCard';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface Collection {
  id: string; slug: string; name: string;
  description: string | null;
  imageUrl: string | null;
  bannerUrl: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  metaImageUrl: string | null;
  products: ProductCardData[];
}

async function fetchCollection(slug: string): Promise<Collection | null> {
  try {
    const res = await fetch(`${API}/api/collections/by-slug/${encodeURIComponent(slug)}`, {
      next: { revalidate: 120 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const col = await fetchCollection(params.slug);
  if (!col) return { title: 'Collection not found' };
  const title = col.metaTitle || `${col.name} — Vrindaonline`;
  const description = col.metaDescription || col.description || `Shop our ${col.name} collection at Vrindaonline.`;
  const image = col.metaImageUrl || col.bannerUrl || col.imageUrl || undefined;
  return {
    title,
    description,
    openGraph: { title, description, images: image ? [image] : undefined },
    twitter: { card: 'summary_large_image', title, description, images: image ? [image] : undefined },
  };
}

export default async function CollectionPage({ params }: { params: { slug: string } }) {
  const col = await fetchCollection(params.slug);
  if (!col) notFound();

  return (
    <div className="max-w-container mx-auto px-6 py-8">
      <nav className="text-xs text-ink-500 mb-4 flex items-center gap-1.5">
        <Link href="/" className="hover:text-brand-700">Home</Link>
        <span>/</span>
        <Link href="/products" className="hover:text-brand-700">Collections</Link>
        <span>/</span>
        <span className="text-ink-900">{col.name}</span>
      </nav>

      <div className="relative rounded-xl overflow-hidden bg-canvas border border-line mb-8">
        {(col.bannerUrl || col.imageUrl) && (
          <img src={col.bannerUrl || col.imageUrl || ''} alt="" className="w-full h-56 md:h-80 object-cover" />
        )}
        <div className={(col.bannerUrl || col.imageUrl) ? 'absolute inset-0 bg-gradient-to-r from-ink-900/70 via-ink-900/40 to-transparent flex items-end p-6' : 'p-6'}>
          <div className={(col.bannerUrl || col.imageUrl) ? 'text-white' : 'text-ink-900'}>
            <p className="text-xs uppercase tracking-wider opacity-80 mb-1">Collection</p>
            <h1 className="font-display text-3xl md:text-4xl">{col.name}</h1>
            {col.description && (
              <p className={`mt-2 text-sm md:text-base max-w-2xl ${(col.bannerUrl || col.imageUrl) ? 'text-white/90' : 'text-ink-700'}`}>
                {col.description}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-end justify-between mb-4">
        <p className="text-sm text-ink-700">{col.products.length} item{col.products.length === 1 ? '' : 's'}</p>
        <Link href={`/products?collection=${col.slug}`} className="text-sm font-semibold text-brand-700 hover:text-brand-800">
          Open in filter view →
        </Link>
      </div>

      {col.products.length === 0 ? (
        <div className="rounded-md border border-dashed border-line p-12 text-center text-ink-500">
          No products in this collection yet.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
          {col.products.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </div>
  );
}
