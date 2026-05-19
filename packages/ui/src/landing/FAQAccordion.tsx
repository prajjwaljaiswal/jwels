'use client';
import { useState } from 'react';

export type FAQItem = { q: string; a: string };

export function FAQAccordion({ items }: { items: FAQItem[] }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="divide-y divide-line border-y border-line">
      {items.map((it, i) => {
        const isOpen = open === i;
        return (
          <div key={i} className="group">
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : i)}
              className="w-full flex items-center justify-between gap-6 py-6 text-left transition-colors hover:text-brand-700"
            >
              <span className="font-display text-xl md:text-2xl text-ink-900 group-hover:text-brand-700 transition-colors">
                {it.q}
              </span>
              <span
                className={`shrink-0 flex h-10 w-10 items-center justify-center rounded-full border transition-all duration-300 ${
                  isOpen
                    ? 'bg-brand-600 text-white border-brand-600 rotate-45'
                    : 'bg-white text-ink-900 border-line group-hover:border-brand-600 group-hover:text-brand-700'
                }`}
                aria-hidden="true"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14" />
                  <path d="M5 12h14" />
                </svg>
              </span>
            </button>
            <div
              className="grid overflow-hidden transition-all duration-500 ease-out"
              style={{
                gridTemplateRows: isOpen ? '1fr' : '0fr',
                opacity: isOpen ? 1 : 0,
              }}
            >
              <div className="min-h-0">
                <p className="pb-7 pr-12 text-ink-700 leading-relaxed max-w-3xl">{it.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
