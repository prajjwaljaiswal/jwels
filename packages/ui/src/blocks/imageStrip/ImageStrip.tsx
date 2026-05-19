'use client';
import Link from 'next/link';

export interface ImageStripItem { imageUrl: string; alt: string; href: string; }
export interface ImageStripSettings {
  heading: string;
  aspect: '4:5' | '1:1' | '3:4' | '16:9';
  items: ImageStripItem[];
}

const aspectClass: Record<ImageStripSettings['aspect'], string> = {
  '4:5':  'aspect-[4/5]',
  '1:1':  'aspect-square',
  '3:4':  'aspect-[3/4]',
  '16:9': 'aspect-[16/9]',
};

export function ImageStripRenderer({ settings: s }: { settings: ImageStripSettings }) {
  if (s.items.length === 0) return null;
  const cols = Math.min(s.items.length, 4);
  return (
    <section className="py-6">
      {s.heading && <h2 className="font-display text-2xl md:text-3xl text-ink-900 text-center mb-4">{s.heading}</h2>}
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
        {s.items.map((it, i) => {
          const img = <img src={it.imageUrl} alt={it.alt} className="w-full h-full object-cover" />;
          return (
            <div key={i} className={`${aspectClass[s.aspect]} overflow-hidden`}>
              {it.href ? <Link href={it.href} className="block w-full h-full">{img}</Link> : img}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function defaultImageStrip(): ImageStripSettings {
  return { heading: '', aspect: '4:5', items: [] };
}
