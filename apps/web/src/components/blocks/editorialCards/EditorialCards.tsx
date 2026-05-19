'use client';
import Link from 'next/link';

export interface EditorialItem {
  imageUrl: string; eyebrow: string; title: string; body: string; ctaLabel: string; ctaHref: string;
}
export interface EditorialCardsSettings {
  heading: string;
  items: EditorialItem[];
}

export function EditorialCardsRenderer({ settings: s }: { settings: EditorialCardsSettings }) {
  if (s.items.length === 0) return null;
  return (
    <section className="max-w-container mx-auto px-6 py-10">
      {s.heading && <h2 className="font-display text-2xl md:text-3xl text-ink-900 text-center mb-6">{s.heading}</h2>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {s.items.map((it, i) => (
          <article key={i} className="group">
            <Link href={it.ctaHref || '#'} className="block rounded-md overflow-hidden border border-line bg-surface">
              <div className="aspect-[4/3] bg-canvas">
                <img src={it.imageUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
              </div>
            </Link>
            <div className="pt-4">
              {it.eyebrow && <p className="text-[11px] uppercase tracking-wider text-brand-700 font-semibold mb-1">{it.eyebrow}</p>}
              <h3 className="font-display text-lg text-ink-900 leading-snug">{it.title}</h3>
              {it.body && <p className="text-sm text-ink-500 mt-2 line-clamp-3">{it.body}</p>}
              {it.ctaLabel && it.ctaHref && (
                <Link href={it.ctaHref} className="inline-block mt-3 text-sm font-semibold text-brand-700 hover:underline">
                  {it.ctaLabel} →
                </Link>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function defaultEditorialCards(): EditorialCardsSettings {
  return { heading: 'The edit', items: [] };
}
