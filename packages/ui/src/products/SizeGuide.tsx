'use client';
import { useState } from 'react';

// Category-aware size guide. The marketplace is multi-category (fine + fashion
// jewellery + kurtis/apparel + shoes), so the chart shown depends on the
// product's category — a ring sizer for rings, a clothing chart for kurtis, etc.

type Chart = { columns: string[]; rows: (string | number)[][]; note?: string };

const CHARTS: Record<string, Chart> = {
  rings: {
    columns: ['India size', 'Diameter (mm)', 'Circumference (mm)'],
    rows: [
      [6, 14.0, 44.0], [8, 14.8, 46.5], [10, 15.7, 49.3], [12, 16.5, 51.8],
      [14, 17.3, 54.4], [16, 18.1, 57.0], [18, 19.0, 59.5], [20, 19.8, 62.1],
    ],
    note: 'Wrap a thin strip of paper around your finger, mark where it overlaps, and measure the length (circumference) in mm.',
  },
  bangles: {
    columns: ['Size', 'Diameter (inch)', 'Diameter (cm)'],
    rows: [
      ['2.2', 2.2, 5.6], ['2.4', 2.4, 6.1], ['2.6', 2.6, 6.5], ['2.8', 2.8, 7.1], ['2.10', 2.83, 7.2],
    ],
    note: 'Press your thumb to your little finger and measure across the widest part of your hand, then match to the diameter.',
  },
  bracelets: {
    columns: ['Size', 'Wrist (inch)', 'Bracelet length (inch)'],
    rows: [['S', '5.5–6.0', 6.5], ['M', '6.0–6.5', 7.0], ['L', '6.5–7.0', 7.5], ['XL', '7.0–7.5', 8.0]],
    note: 'Measure snugly around your wrist; add ~0.5–1 inch for comfort.',
  },
  clothing: {
    columns: ['Size', 'Bust (inch)', 'Waist (inch)', 'Hip (inch)'],
    rows: [
      ['XS', 32, 26, 35], ['S', 34, 28, 37], ['M', 36, 30, 39],
      ['L', 38, 32, 41], ['XL', 40, 34, 43], ['XXL', 42, 36, 45], ['XXXL', 44, 38, 47],
    ],
    note: 'Measure over light clothing. If between sizes, pick the larger for a relaxed fit.',
  },
  shoes: {
    columns: ['UK', 'EU', 'Foot length (cm)'],
    rows: [['UK 4', 37, 23.5], ['UK 5', 38, 24.3], ['UK 6', 39, 25.1], ['UK 7', 41, 25.9], ['UK 8', 42, 26.7], ['UK 9', 43, 27.5], ['UK 10', 44, 28.3]],
    note: 'Measure your foot from heel to longest toe in the evening (feet swell during the day).',
  },
};

// Map common category slugs/names to a chart key.
function chartFor(category?: { slug?: string; name?: string }): string | null {
  const s = (category?.slug || category?.name || '').toLowerCase();
  if (!s) return null;
  if (s.includes('ring')) return 'rings';
  if (s.includes('bangle')) return 'bangles';
  if (s.includes('bracelet')) return 'bracelets';
  if (s.includes('shoe') || s.includes('footwear')) return 'shoes';
  if (s.includes('cloth') || s.includes('kurti') || s.includes('apparel') || s.includes('dress') || s.includes('saree') || s.includes('top')) return 'clothing';
  return null;
}

export function SizeGuide({ category }: { category?: { slug?: string; name?: string } }) {
  const [open, setOpen] = useState(false);
  const key = chartFor(category);
  if (!key) return null;
  const chart = CHARTS[key];

  return (
    <div className="pt-3">
      <button onClick={() => setOpen((o) => !o)} className="text-sm font-semibold text-brand-700 hover:underline inline-flex items-center gap-1">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 6h18M3 12h18M3 18h18" />
        </svg>
        Size guide
      </button>
      {open && (
        <div className="mt-3 rounded-md border border-line bg-canvas p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-ink-500">
                  {chart.columns.map((c) => <th key={c} className="py-1.5 pr-4 font-semibold">{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {chart.rows.map((row, i) => (
                  <tr key={i} className="border-t border-line">
                    {row.map((cell, j) => <td key={j} className="py-1.5 pr-4 text-ink-800">{cell}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {chart.note && <p className="text-xs text-ink-500 mt-3">{chart.note}</p>}
        </div>
      )}
    </div>
  );
}
