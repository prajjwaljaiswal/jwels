'use client';
import { useState } from 'react';

export interface EmailCaptureSettings {
  eyebrow: string;
  heading: string;
  subheading: string;
  placeholder: string;
  ctaLabel: string;
  incentiveCode: string;
  background: 'none' | 'canvas' | 'brand';
}

const bgClass: Record<EmailCaptureSettings['background'], string> = {
  none: '',
  canvas: 'bg-canvas',
  brand: 'bg-brand-50',
};

export function EmailCaptureRenderer({ settings: s }: { settings: EmailCaptureSettings }) {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  return (
    <section className={`${bgClass[s.background]} py-10 border-y border-line`}>
      <div className="max-w-2xl mx-auto px-6 text-center">
        {s.eyebrow && <p className="text-xs uppercase tracking-wider font-semibold text-brand-700 mb-2">{s.eyebrow}</p>}
        <h2 className="font-display text-2xl md:text-3xl text-ink-900">{s.heading}</h2>
        {s.subheading && <p className="text-sm text-ink-500 mt-1">{s.subheading}</p>}
        {done ? (
          <p className="mt-4 text-sm font-semibold text-success">
            Thanks! {s.incentiveCode ? `Use code ${s.incentiveCode} on your first order.` : 'Check your inbox.'}
          </p>
        ) : (
          <form
            onSubmit={(e) => { e.preventDefault(); if (email.trim()) setDone(true); }}
            className="mt-5 flex max-w-md mx-auto rounded-pill bg-surface border border-line overflow-hidden focus-within:ring-2 focus-within:ring-brand-600"
          >
            <input type="email" required
              value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder={s.placeholder}
              className="flex-1 px-5 h-11 bg-transparent text-sm focus:outline-none" />
            <button type="submit"
              className="m-1 h-9 px-5 rounded-pill bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700">
              {s.ctaLabel}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}

export function defaultEmailCapture(): EmailCaptureSettings {
  return {
    eyebrow: '',
    heading: 'Get 5% off your first order',
    subheading: 'Sign up for updates on new arrivals and exclusive offers.',
    placeholder: 'Your email address',
    ctaLabel: 'Sign up',
    incentiveCode: '',
    background: 'canvas',
  };
}
