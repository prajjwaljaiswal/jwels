'use client';

// Live renderers for the 10 checkout blocks.
//
// IMPORTANT — design note:
// The address / shipping / payment / order-summary flow is a tightly-coupled
// state machine (Razorpay, COD, coupons, shipping quotes) living in
// <LegacyVendorCheckoutPage>. To ship customisation safely, the block-rendered
// checkout route mounts that legacy component once as the "core". These four
// renderers therefore render NOTHING — they exist purely so vendors can include
// them in their layout and so the kind-validator can enforce they're present.
//
// All the other blocks (announcement, trust strip, gift wrap, custom fields,
// FAQ-style content) ARE live and render around the core.

import { useState } from 'react';
import { useCheckoutBlock, CheckoutFallback } from './CheckoutContext';
import { useCurrency, formatPrice } from '@/lib/currency';

// ── Required blocks: rendered by the legacy core ────────────────────────────
export function CheckoutStepsRenderer() { return null; }
export function CheckoutAddressFormRenderer() { return null; }
export function CheckoutShippingRenderer() { return null; }
export function CheckoutPaymentRenderer() { return null; }
export function CheckoutOrderSummaryRenderer() { return null; }

// ── Announcement bar ────────────────────────────────────────────────────────
export function CheckoutAnnouncementRenderer({ settings }: { settings: any; ctx: any }) {
  const co = useCheckoutBlock();
  if (!settings?.text) return null;
  const bg = settings.background === 'brand'
    ? (co?.theme ?? '#F1641E')
    : settings.background === 'canvas' ? '#F8F5EF' : 'transparent';
  const fg = settings.background === 'brand' ? '#FFFFFF' : '#1A1A1A';
  return (
    <div className="text-center text-sm py-2 mb-4 rounded" style={{ background: bg, color: fg }}>
      {settings.text}
    </div>
  );
}

// ── Trust strip ─────────────────────────────────────────────────────────────
export function CheckoutTrustStripRenderer({ settings }: { settings: any; ctx: any }) {
  const co = useCheckoutBlock();
  const items: { iconUrl?: string; label: string }[] =
    (settings?.items && settings.items.length > 0)
      ? settings.items
      : [
          { label: 'Secure payment' },
          { label: '256-bit SSL' },
          { label: 'BIS-hallmarked' },
          { label: '30-day returns' },
        ];
  const theme = co?.theme ?? '#F1641E';
  return (
    <ul className="my-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-ink-700">
      {items.map((it, i) => (
        <li key={i} className="flex items-center gap-2">
          <span style={{ color: theme }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="m5 12 4 4L19 6" />
            </svg>
          </span>
          {it.label}
        </li>
      ))}
    </ul>
  );
}

// ── Gift wrap upsell ────────────────────────────────────────────────────────
export function CheckoutGiftWrapRenderer({ settings }: { settings: any; ctx: any }) {
  const { code } = useCurrency();
  const co = useCheckoutBlock();
  if (!co) return <CheckoutFallback label="Gift wrap upsell" hint="Adds an optional gift-wrap toggle." />;
  return (
    <label
      className="my-3 flex items-start gap-3 p-4 border border-line rounded-md bg-surface cursor-pointer hover:border-ink-300"
      style={co.giftWrap ? { borderColor: co.theme, background: `${co.theme}10` } : undefined}
    >
      <input
        type="checkbox"
        checked={co.giftWrap}
        onChange={(e) => co.setGiftWrap(e.target.checked)}
        className="mt-0.5"
      />
      <div className="flex-1">
        <div className="font-medium">
          {settings?.heading || 'Add a gift wrap'}
          {settings?.price > 0 && (
            <span className="ml-2 text-sm text-ink-500 font-normal">
              + {formatPrice(Number(settings.price), code)}
            </span>
          )}
        </div>
        <div className="text-xs text-ink-500 mt-0.5">
          We'll wrap your order in tissue paper with a hand-tied ribbon and gift note.
        </div>
      </div>
    </label>
  );
}

// ── Custom fields ───────────────────────────────────────────────────────────
export function CheckoutCustomFieldsRenderer({ settings }: { settings: any; ctx: any }) {
  const co = useCheckoutBlock();
  const fields: Array<{ key: string; label: string; type: 'text' | 'textarea' | 'select'; required?: boolean; options?: string[] }> =
    settings?.fields ?? [];

  if (!co) return <CheckoutFallback label="Custom fields" hint="Extra inputs collected at checkout." />;
  if (fields.length === 0) return null;
  return (
    <div className="my-5 p-5 border border-line rounded-md bg-surface">
      {settings?.heading && <h3 className="font-medium mb-3">{settings.heading}</h3>}
      <div className="space-y-3">
        {fields.map((f) => (
          <label key={f.key} className="block text-sm">
            <span className="text-ink-700">
              {f.label}{f.required ? ' *' : ''}
            </span>
            {f.type === 'textarea' ? (
              <textarea
                className="input-field mt-1 w-full h-24 py-2"
                required={f.required}
                value={co.customFields[f.key] ?? ''}
                onChange={(e) => co.setCustomField(f.key, e.target.value)}
              />
            ) : f.type === 'select' ? (
              <select
                className="input-field mt-1 w-full"
                required={f.required}
                value={co.customFields[f.key] ?? ''}
                onChange={(e) => co.setCustomField(f.key, e.target.value)}
              >
                <option value="">— Select —</option>
                {(f.options ?? []).map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                className="input-field mt-1 w-full"
                required={f.required}
                value={co.customFields[f.key] ?? ''}
                onChange={(e) => co.setCustomField(f.key, e.target.value)}
              />
            )}
          </label>
        ))}
      </div>
    </div>
  );
}
