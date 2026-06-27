'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/dashboard/DashboardShell';

interface Product {
  id: string;
  slug: string | null;
  name: string;
  price: string;
  stockQuantity: number;
  isActive: boolean;
  images: string[];
}

export default function ProductsListPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[] | null>(null);

  useEffect(() => {
    let active = true;
    api<Product[]>('/api/products/vendor/mine')
      .then((rows) => { if (active) setProducts(rows); })
      .catch(() => { if (active) setProducts([]); });
    return () => { active = false; };
  }, []);

  return (
    <div className="pb-16">
      <PageHeader
        title="Listings"
        subtitle={products ? `${products.length} listing${products.length === 1 ? '' : 's'}` : 'Loading…'}
        actions={
          <Link href="/products/new"
            className="text-sm font-semibold px-4 h-10 inline-flex items-center rounded-pill bg-brand-600 hover:bg-brand-700 text-white transition">
            + Add listing
          </Link>
        }
      />

      {products === null ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-surface border border-line rounded-md overflow-hidden animate-pulse">
              <div className="aspect-square bg-canvas" />
              <div className="p-3 space-y-2">
                <div className="h-3.5 bg-canvas rounded w-3/4" />
                <div className="h-3 bg-canvas rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-sm text-ink-500 mb-4">You haven&apos;t added any listings yet.</p>
          <Link href="/products/new"
            className="text-sm font-semibold px-5 h-10 inline-flex items-center rounded-pill bg-brand-600 hover:bg-brand-700 text-white transition">
            + Add your first listing
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => router.push(`/products/${p.id}/edit`)}
              className="group text-left bg-surface border border-line rounded-md overflow-hidden transition hover:shadow-card hover:border-ink-300"
            >
              <div className="aspect-square bg-canvas overflow-hidden relative">
                {p.images?.[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.images[0]} alt={p.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-ink-300 text-xs">No image</div>
                )}
                {!p.isActive && (
                  <span className="absolute top-2 right-2 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-pill bg-ink-900/70 text-white">
                    Inactive
                  </span>
                )}
              </div>
              <div className="p-3">
                <p className="text-sm font-semibold text-ink-900 line-clamp-1">{p.name}</p>
                <p className="text-xs text-ink-500 mt-0.5">
                  ₹{p.price} · {p.stockQuantity} in stock
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
