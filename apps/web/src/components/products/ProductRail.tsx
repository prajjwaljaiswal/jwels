'use client';
import { ProductCard, type ProductCardData } from '@/components/storefront/ProductCard';

interface Props {
  title: string;
  subtitle?: string;
  items: ProductCardData[];
}

export function ProductRail({ title, subtitle, items }: Props) {
  if (items.length === 0) return null;
  return (
    <section className="mt-12">
      <div className="mb-4">
        <h2 className="font-display text-2xl text-ink-900">{title}</h2>
        {subtitle && <p className="text-sm text-ink-700 mt-0.5">{subtitle}</p>}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        {items.slice(0, 12).map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}
