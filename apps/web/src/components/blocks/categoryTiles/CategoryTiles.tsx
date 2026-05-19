'use client';
import Link from 'next/link';

export interface CategoryTilesItem { imageUrl: string; title: string; href: string; overlay: boolean; }
export interface CategoryTilesSettings {
  heading: string;
  columns: 2 | 3 | 4 | 5;
  items: CategoryTilesItem[];
}

const colClass: Record<CategoryTilesSettings['columns'], string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-2 md:grid-cols-3',
  4: 'grid-cols-2 md:grid-cols-4',
  5: 'grid-cols-2 md:grid-cols-5',
};

export function CategoryTilesRenderer({ settings: s }: { settings: CategoryTilesSettings }) {
  if (s.items.length === 0) return null;
  return (
    <section className="max-w-container mx-auto px-6 py-10">
      {s.heading && <h2 className="font-display text-2xl md:text-3xl text-ink-900 text-center mb-6">{s.heading}</h2>}
      <div className={`grid ${colClass[s.columns]} gap-4`}>
        {s.items.map((it, i) => (
          <Link key={i} href={it.href} className="group relative rounded-lg overflow-hidden border border-line block">
            <div className="aspect-[4/5] bg-canvas">
              <img src={it.imageUrl} alt={it.title} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
            </div>
            {it.overlay ? (
              <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-ink-900/80 to-transparent">
                <p className="text-white font-display text-lg">{it.title}</p>
              </div>
            ) : (
              <p className="absolute inset-x-0 bottom-0 p-3 bg-surface text-center font-semibold text-ink-900">{it.title}</p>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}

export function defaultCategoryTiles(): CategoryTilesSettings {
  return {
    heading: 'Celebrate with us',
    columns: 4,
    items: [],
  };
}
