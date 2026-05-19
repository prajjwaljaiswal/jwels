'use client';
import Link from 'next/link';

export interface IconGridItem {
  iconUrl: string; iconColor: string; title: string; caption: string; href: string;
}
export interface IconGridSettings {
  heading: string; subheading: string;
  columns: 3 | 4 | 5 | 6 | 12;
  items: IconGridItem[];
}

const colClass: Record<IconGridSettings['columns'], string> = {
  3:  'grid-cols-3',
  4:  'grid-cols-4',
  5:  'grid-cols-5',
  6:  'grid-cols-3 md:grid-cols-6',
  12: 'grid-cols-4 md:grid-cols-6 lg:grid-cols-12',
};

export function IconGridRenderer({ settings: s }: { settings: IconGridSettings }) {
  if (s.items.length === 0) return null;
  return (
    <section className="max-w-container mx-auto px-6 py-10">
      {s.heading && <h2 className="font-display text-2xl md:text-3xl text-ink-900 text-center">{s.heading}</h2>}
      {s.subheading && <p className="text-sm text-ink-500 text-center mt-1">{s.subheading}</p>}
      <div className={`mt-6 grid ${colClass[s.columns]} gap-y-6 gap-x-4`}>
        {s.items.map((it, i) => {
          const inner = (
            <div className="flex flex-col items-center text-center">
              <div
                className="h-14 w-14 rounded-full flex items-center justify-center mb-2 border border-line"
                style={it.iconColor ? { backgroundColor: it.iconColor } : undefined}
              >
                {it.iconUrl
                  ? <img src={it.iconUrl} alt="" className="h-9 w-9 object-contain" />
                  : <span className="text-lg font-display text-ink-900">{it.title?.[0] ?? '·'}</span>}
              </div>
              <p className="text-xs font-semibold text-ink-900">{it.title}</p>
              {it.caption && <p className="text-[11px] text-ink-500 leading-tight mt-0.5">{it.caption}</p>}
            </div>
          );
          return it.href
            ? <Link key={i} href={it.href} className="hover:opacity-80 transition">{inner}</Link>
            : <div key={i}>{inner}</div>;
        })}
      </div>
    </section>
  );
}

export function defaultIconGrid(): IconGridSettings {
  return { heading: '', subheading: '', columns: 6, items: [] };
}
