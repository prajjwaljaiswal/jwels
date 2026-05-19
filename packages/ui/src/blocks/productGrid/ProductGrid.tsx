'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { ProductCard, type ProductCardData } from '@/components/storefront/ProductCard';
import type { RenderContext } from '../types';

export interface ProductGridSettings {
  heading: string;
  source: 'all' | 'section' | 'manual';
  sectionId: string;
  productIds: string[];
  columns: 2 | 3 | 4;
  limit: number;
}

const colClass: Record<ProductGridSettings['columns'], string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-2 sm:grid-cols-3',
  4: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
};

export function ProductGridRenderer({
  settings: s,
  ctx,
}: {
  settings: ProductGridSettings;
  ctx: RenderContext;
}) {
  const [products, setProducts] = useState<ProductCardData[]>([]);

  useEffect(() => {
    let alive = true;
    const params = new URLSearchParams({ limit: String(s.limit) });
    if (ctx.vendorId) params.set('vendorId', ctx.vendorId);
    if (s.source === 'section' && s.sectionId) params.set('sectionId', s.sectionId);
    if (s.source === 'manual' && s.productIds.length) params.set('ids', s.productIds.join(','));
    api<{ items: ProductCardData[] }>(`/api/products?${params}`, { auth: false, silent: true })
      .then((data) => {
        if (alive) setProducts(Array.isArray(data?.items) ? data.items : []);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [ctx.vendorId, s.source, s.sectionId, s.productIds.join(','), s.limit]);

  return (
    <section className="px-6 sm:px-10 py-10">
      {s.heading && <h2 className="text-2xl font-semibold mb-6">{s.heading}</h2>}
      {products.length === 0 ? (
        <p className="text-sm text-ink-600">No products to show yet.</p>
      ) : (
        <div className={`grid gap-4 ${colClass[s.columns]}`}>
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </section>
  );
}

export function defaultProductGrid(): ProductGridSettings {
  return {
    heading: 'Featured products',
    source: 'all',
    sectionId: '',
    productIds: [],
    columns: 3,
    limit: 12,
  };
}
