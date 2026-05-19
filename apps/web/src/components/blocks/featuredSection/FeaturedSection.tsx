'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { ProductCard, type ProductCardData } from '@/components/storefront/ProductCard';
import type { RenderContext } from '../types';

export interface FeaturedSectionSettings {
  sectionId: string;
  heading: string;
  layout: 'grid' | 'carousel';
  limit: number;
}

export function FeaturedSectionRenderer({
  settings: s,
  ctx,
}: {
  settings: FeaturedSectionSettings;
  ctx: RenderContext;
}) {
  const [products, setProducts] = useState<ProductCardData[]>([]);

  useEffect(() => {
    if (!s.sectionId) {
      setProducts([]);
      return;
    }
    let alive = true;
    const params = new URLSearchParams({
      sectionId: s.sectionId,
      limit: String(s.limit),
    });
    if (ctx.vendorId) params.set('vendorId', ctx.vendorId);
    api<{ items: ProductCardData[] }>(`/api/products?${params}`, { auth: false, silent: true })
      .then((data) => {
        if (alive) setProducts(Array.isArray(data?.items) ? data.items : []);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [ctx.vendorId, s.sectionId, s.limit]);

  if (!s.sectionId) {
    return (
      <section className="px-6 sm:px-10 py-10">
        <p className="text-sm text-ink-500 italic">Featured section — pick a section in the editor.</p>
      </section>
    );
  }

  return (
    <section className="px-6 sm:px-10 py-10">
      {s.heading && <h2 className="text-2xl font-semibold mb-6">{s.heading}</h2>}
      {products.length === 0 ? (
        <p className="text-sm text-ink-600">No products in this section yet.</p>
      ) : s.layout === 'carousel' ? (
        <div className="flex gap-4 overflow-x-auto pb-2 -mx-2 px-2 snap-x">
          {products.map((p) => (
            <div key={p.id} className="min-w-[220px] max-w-[260px] snap-start">
              <ProductCard product={p} />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </section>
  );
}

export function defaultFeaturedSection(): FeaturedSectionSettings {
  return { sectionId: '', heading: '', layout: 'grid', limit: 8 };
}
