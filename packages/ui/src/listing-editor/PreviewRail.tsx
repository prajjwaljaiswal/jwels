'use client';
import { useEffect, useState } from 'react';
import { ListingDraft } from './types';
import { useCurrency, formatPrice } from '@/lib/currency';

export function PreviewRail({ draft }: { draft: ListingDraft }) {
  const { code } = useCurrency();
  const cover = draft.files[0];
  const [coverUrl, setCoverUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!cover) { setCoverUrl(null); return; }
    const url = URL.createObjectURL(cover);
    setCoverUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [cover]);

  return (
    <div className="rounded-xl border border-line bg-surface overflow-hidden shadow-card">
      <div className="bg-ink-900 text-white text-[10px] font-mono px-3 py-1.5 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-red-400" />
        <span className="h-2 w-2 rounded-full bg-amber-400" />
        <span className="h-2 w-2 rounded-full bg-emerald-400" />
        <span className="ml-2 opacity-70 truncate">storefront preview</span>
      </div>

      <div className="p-3">
        <div className="aspect-square rounded-md overflow-hidden bg-canvas">
          {coverUrl
            ? <img src={coverUrl} alt="" className="w-full h-full object-cover" />
            : <div className="w-full h-full flex flex-col items-center justify-center text-ink-400 text-xs gap-2">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>
                </svg>
                <span>Add a cover photo</span>
              </div>
          }
        </div>

        <p className="text-sm text-ink-900 mt-3 line-clamp-2 min-h-[2.5em] font-medium">
          {draft.title || <span className="text-ink-400">Your listing title</span>}
        </p>
        <p className="text-base font-bold text-ink-900 mt-1">
          {draft.price ? formatPrice(Number(draft.price), code) : <span className="text-ink-400 font-normal">—</span>}
        </p>
        {(() => {
          const badges: string[] = [];
          const purityLabel: Record<string, string> = {
            K14: '14K', K18: '18K', K22: '22K', K24: '24K',
            SILVER_925: 'Silver 925', PLATINUM_950: 'Pt 950', OTHER: '',
          };
          if (draft.purity && purityLabel[draft.purity]) badges.push(purityLabel[draft.purity]);
          if (draft.grossWeightGrams) badges.push(`${draft.grossWeightGrams}g`);
          if (draft.hallmarked) badges.push('Hallmarked');
          if (!draft.purity && draft.baseMetal) badges.push(draft.baseMetal);
          if (draft.plating && draft.plating !== 'None') badges.push(draft.plating);
          if (draft.nickelFree) badges.push('Nickel-free');
          if (draft.gender && draft.gender !== 'WOMEN') badges.push(draft.gender[0] + draft.gender.slice(1).toLowerCase());
          return badges.length > 0 ? (
            <div className="flex flex-wrap gap-1 mt-2">
              {badges.slice(0, 4).map((b) => (
                <span key={b} className="text-[10px] text-brand-700 bg-brand-50 border border-brand-200 rounded-pill px-1.5 py-0.5 font-semibold">{b}</span>
              ))}
            </div>
          ) : null;
        })()}
        {draft.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {draft.tags.slice(0, 4).map((t) => (
              <span key={t} className="text-[10px] text-ink-500 bg-canvas border border-line rounded-pill px-1.5 py-0.5">{t}</span>
            ))}
            {draft.tags.length > 4 && <span className="text-[10px] text-ink-500">+{draft.tags.length - 4}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
