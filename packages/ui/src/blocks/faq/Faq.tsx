'use client';
import { useState } from 'react';

export interface FaqItem { question: string; answer: string }
export interface FaqSettings { heading: string; items: FaqItem[] }

export function FaqRenderer({ settings: s }: { settings: FaqSettings }) {
  if (!s.items.length) {
    return (
      <section className="px-6 sm:px-10 py-10">
        <p className="text-sm text-ink-500 italic">No FAQ items yet.</p>
      </section>
    );
  }
  return (
    <section className="px-6 sm:px-10 py-12">
      {s.heading && <h2 className="text-2xl font-semibold mb-6 text-center">{s.heading}</h2>}
      <div className="max-w-3xl mx-auto divide-y divide-line border border-line rounded-lg">
        {s.items.map((it, i) => (
          <FaqRow key={i} item={it} />
        ))}
      </div>
    </section>
  );
}

function FaqRow({ item }: { item: FaqItem }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between p-4 text-left hover:bg-canvas">
        <span className="font-medium">{item.question}</span>
        <span className="text-ink-500">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="p-4 pt-0 text-ink-700 whitespace-pre-line">{item.answer}</div>}
    </div>
  );
}

export function defaultFaq(): FaqSettings {
  return {
    heading: 'Frequently asked questions',
    items: [
      { question: 'How long does shipping take?', answer: 'Most orders ship in 2–3 business days and arrive within a week.' },
      { question: 'What is your return policy?', answer: 'We accept returns within 14 days of delivery. The item must be unused.' },
    ],
  };
}
