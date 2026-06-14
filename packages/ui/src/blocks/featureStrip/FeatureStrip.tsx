'use client';
import Link from 'next/link';
import type { EditorContext } from '../types';

export interface FeatureStripItem {
  iconUrl: string;
  label: string;
  sublabel: string;
  href: string;
}
export interface FeatureStripSettings {
  heading: string;
  background: 'none' | 'canvas' | 'brand';
  items: FeatureStripItem[];
}

const bgClass: Record<FeatureStripSettings['background'], string> = {
  none: '',
  canvas: 'bg-canvas',
  brand: 'bg-brand-50',
};

export function FeatureStripRenderer({ settings: s }: { settings: FeatureStripSettings }) {
  if (s.items.length === 0) return null;
  return (
    <section className={`w-full ${bgClass[s.background]} border-y border-line`}>
      <div className="max-w-container mx-auto px-6 py-4">
        {s.heading && <p className="text-center text-xs uppercase tracking-wider font-semibold text-ink-700 mb-3">{s.heading}</p>}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-4 text-sm">
          {s.items.map((it, i) => {
            const inner = (
              <div className="flex items-center justify-center gap-2 text-ink-700 text-center">
                {it.iconUrl && <img src={it.iconUrl} alt="" className="h-6 w-6 object-contain" />}
                <div className="leading-tight">
                  <p className="font-semibold text-ink-900">{it.label}</p>
                  {it.sublabel && <p className="text-[11px] text-ink-500">{it.sublabel}</p>}
                </div>
              </div>
            );
            return it.href
              ? <Link key={i} href={it.href} className="hover:opacity-80 transition">{inner}</Link>
              : <div key={i}>{inner}</div>;
          })}
        </div>
      </div>
    </section>
  );
}

export function defaultFeatureStrip(): FeatureStripSettings {
  return {
    heading: '',
    background: 'none',
    items: [
      { iconUrl: '', label: 'BIS Hallmarked', sublabel: '', href: '' },
      { iconUrl: '', label: 'Free 15-Day Returns', sublabel: '', href: '' },
      { iconUrl: '', label: 'Certified Jewellery', sublabel: '', href: '' },
      { iconUrl: '', label: 'Lifetime Exchange', sublabel: '', href: '' },
    ],
  };
}
