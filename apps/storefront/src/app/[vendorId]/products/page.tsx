'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useVendor } from '@/lib/vendor-context';
import { ProductCard, type ProductCardData } from '@/components/storefront/ProductCard';
import { SearchExperience } from '@/components/search/SearchExperience';

const ALGOLIA_READY =
  !!process.env.NEXT_PUBLIC_ALGOLIA_APP_ID && !!process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY;

export default function VendorProductsPage() {
  const { vendorId } = useParams<{ vendorId: string }>();
  const searchParams = useSearchParams();
  const categorySlug = searchParams.get('category');
  if (ALGOLIA_READY) {
    return <SearchExperience vendorId={vendorId} hideVendorFacet categorySlug={categorySlug ?? undefined} />;
  }
  return <LegacyVendorProducts categorySlug={categorySlug ?? undefined} />;
}

interface Section { id: string; name: string; slug: string }

function LegacyVendorProducts({ categorySlug }: { categorySlug?: string }) {
  const { vendor, storeKey } = useVendor();
  const [products, setProducts] = useState<ProductCardData[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [section, setSection] = useState('all');

  useEffect(() => {
    api<{ products: any[]; sections: Section[] }>(`/api/vendors/${vendor.id}`, { auth: false })
      .then(({ products, sections }) => {
        setProducts(products.map(toCardData));
        setSections(sections ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [vendor.id]);

  const filtered = useMemo(() => {
    let out = products;
    if (categorySlug) {
      out = out.filter((p: any) => p.category?.slug === categorySlug);
    }
    if (section !== 'all') {
      out = out.filter((p: any) => p.shopSection?.slug === section);
    }
    if (q.trim()) {
      const lc = q.trim().toLowerCase();
      out = out.filter((p) => p.name.toLowerCase().includes(lc));
    }
    return out;
  }, [products, categorySlug, section, q]);

  return (
    <div className="max-w-6xl mx-auto px-5 py-8">
      <div className="flex items-baseline justify-between gap-4 flex-wrap mb-6">
        <h1 className="font-display text-3xl">
          {vendor.shopName} · {categorySlug
            ? (products.find((p: any) => p.category?.slug === categorySlug) as any)?.category?.name || categorySlug
            : 'Shop all'}
        </h1>
        <Link href={`/${storeKey}`} className="text-sm hover:underline">← Back to shop</Link>
      </div>

      <div className="flex gap-3 flex-wrap mb-6">
        <input
          className="input-field flex-1 min-w-[240px]"
          placeholder="Search in this shop…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {sections.length > 0 && (
          <select className="input-field" value={section} onChange={(e) => setSection(e.target.value)}>
            <option value="all">All sections</option>
            {sections.map((s) => (
              <option key={s.id} value={s.slug}>{s.name}</option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <p className="text-ink-700">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border border-line rounded-md bg-surface">
          <p className="font-display text-xl mb-1">No products found</p>
          <p className="text-sm text-ink-700">Try clearing filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {filtered.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function toCardData(p: any): ProductCardData & { category?: { slug: string }; shopSection?: { slug: string } } {
  return {
    id: p.id,
    name: p.name,
    price: p.price,
    images: p.images ?? [],
    vendor: { shopName: p.vendor?.shopName ?? '' },
    variationCombos: p.variationCombos,
    category: p.category ? { slug: p.category.slug, name: p.category.name } : undefined,
    shopSection: p.shopSection ? { slug: p.shopSection.slug } : undefined,
  } as any;
}
