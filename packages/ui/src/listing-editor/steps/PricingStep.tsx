'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { StepHeader, StepProps, Field, ComingSoonBadge } from '../StepShell';
import { useCurrency, CURRENCIES } from '@/lib/currency';
import { MakingChargeType, SHOWS_WEIGHT, SHOWS_MAKING_CHARGE } from '../types';

interface ReturnPolicy {
  id: string; name: string; accepted: boolean; days: number; buyerPaysReturn: boolean; notes: string | null;
}

interface ShippingMethod {
  id: string;
  name: string;
  carrier: string;
  serviceType: string;
  baseRate: string;
  etaMinDays: number;
  etaMaxDays: number;
  isActive: boolean;
}

export function PricingStep({ draft, setDraft }: StepProps) {
  const { code } = useCurrency();
  const currencySymbol = CURRENCIES[code].symbol;
  const [methods, setMethods] = useState<ShippingMethod[]>([]);
  const [policies, setPolicies] = useState<ReturnPolicy[]>([]);
  const [showSku, setShowSku] = useState(!!draft.sku);

  useEffect(() => {
    api<ShippingMethod[]>('/api/shipping/vendor/methods', { silent: true })
      .then((rows) => setMethods(rows.filter((r) => r.isActive)))
      .catch(() => setMethods([]));
    api<ReturnPolicy[]>('/api/vendors/me/return-policies', { silent: true })
      .then(setPolicies).catch(() => setPolicies([]));
  }, []);

  const selectedPolicy = policies.find((p) => p.id === draft.returnPolicyId);

  const selectedMethod = methods.find((m) => m.id === draft.shippingMethodId);

  const jt = draft.jewelleryType;
  const showWeight = jt ? SHOWS_WEIGHT[jt as Exclude<typeof jt, ''>] : false;
  const showMakingCharge = jt ? SHOWS_MAKING_CHARGE[jt as Exclude<typeof jt, ''>] : false;

  return (
    <>
      <StepHeader
        title="Pricing & shipping"
        subtitle="Set your item price, how many are available, and how it ships."
      />

      <div className="p-6 space-y-6">
        <section>
          <p className="text-sm font-semibold text-ink-900">Price and inventory</p>
          <p className="text-xs text-ink-500 mt-0.5 mb-4">Set your item price, and how many are available for sale.</p>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label={`Price (${currencySymbol})`} required>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500 text-sm">{currencySymbol}</span>
                <input className="input-field pl-7" type="number" min="0" step="0.01"
                  value={draft.price} onChange={(e) => setDraft({ price: e.target.value })} required />
              </div>
            </Field>
            <Field label="Quantity" required>
              <input className="input-field" type="number" min="0"
                value={draft.stockQuantity} onChange={(e) => setDraft({ stockQuantity: e.target.value })} required />
            </Field>
          </div>

          <button type="button"
            onClick={() => setDraft({ acceptsOffers: !draft.acceptsOffers })}
            className="mt-4 w-full flex items-start gap-3 p-3 rounded-md border border-line bg-canvas hover:bg-surface text-left transition">
            <span className={['mt-0.5 h-5 w-9 rounded-full transition-colors shrink-0 relative', draft.acceptsOffers ? 'bg-brand-600' : 'bg-ink-300'].join(' ')}>
              <span className={['absolute top-0.5 h-4 w-4 bg-white rounded-full shadow transition-transform', draft.acceptsOffers ? 'translate-x-4' : 'translate-x-0.5'].join(' ')} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-semibold text-ink-900">
                Let buyers make offers
              </span>
              <span className="block text-xs text-ink-500 mt-0.5">
                Offers help you learn the pricing sweet spot while protecting your bottom line.
              </span>
            </span>
          </button>

          {!showSku ? (
            <button type="button" onClick={() => setShowSku(true)}
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-800">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
              Add SKU
            </button>
          ) : (
            <div className="mt-4">
              <Field label="SKU" hint="Optional — for your inventory tracking">
                <input className="input-field max-w-xs" value={draft.sku}
                  onChange={(e) => setDraft({ sku: e.target.value })} placeholder="e.g. CHK-022-G" />
              </Field>
            </div>
          )}
        </section>

        {(showWeight || showMakingCharge) && (
          <section className="border-t border-line pt-6">
            <p className="text-sm font-semibold text-ink-900">Weight & making charges</p>
            <p className="text-xs text-ink-500 mt-0.5 mb-4">Shown on the product page and used by buyers to compare value.</p>

            {showWeight && (
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Gross weight (g)" hint="Total weight including stones">
                  <input className="input-field" type="number" min="0" step="0.001"
                    value={draft.grossWeightGrams}
                    onChange={(e) => setDraft({ grossWeightGrams: e.target.value })} />
                </Field>
                <Field label="Net weight (g)" hint="Metal-only weight">
                  <input className="input-field" type="number" min="0" step="0.001"
                    value={draft.netWeightGrams}
                    onChange={(e) => setDraft({ netWeightGrams: e.target.value })} />
                </Field>
              </div>
            )}

            {showMakingCharge && (
              <div className="grid sm:grid-cols-3 gap-4 mt-3">
                <Field label="Making charge type">
                  <select className="input-field" value={draft.makingChargeType}
                    onChange={(e) => setDraft({ makingChargeType: e.target.value as MakingChargeType })}>
                    <option value="">— Select —</option>
                    <option value="PER_GRAM">Per gram</option>
                    <option value="FLAT">Flat</option>
                    <option value="PERCENT">Percent of gold value</option>
                  </select>
                </Field>
                <Field label="Making charge value">
                  <input className="input-field" type="number" min="0" step="0.01"
                    value={draft.makingChargeValue}
                    onChange={(e) => setDraft({ makingChargeValue: e.target.value })} />
                </Field>
                <Field label="Wastage %" hint="Typically 0–15% for traditional pieces">
                  <input className="input-field" type="number" min="0" max="100" step="0.01"
                    value={draft.wastagePercent}
                    onChange={(e) => setDraft({ wastagePercent: e.target.value })} />
                </Field>
              </div>
            )}

          </section>
        )}

        <section className="border-t border-line pt-6">
          <details className="rounded-md border border-line p-3">
            <summary className="text-sm font-semibold text-ink-900 cursor-pointer">Dimensions & processing time</summary>
            <div className="grid sm:grid-cols-3 gap-3 mt-3">
              <Field label="Length (mm)">
                <input className="input-field" type="number" min="0" value={draft.lengthMm}
                  onChange={(e) => setDraft({ lengthMm: e.target.value })} />
              </Field>
              <Field label="Width (mm)">
                <input className="input-field" type="number" min="0" value={draft.widthMm}
                  onChange={(e) => setDraft({ widthMm: e.target.value })} />
              </Field>
              <Field label="Height (mm)">
                <input className="input-field" type="number" min="0" value={draft.heightMm}
                  onChange={(e) => setDraft({ heightMm: e.target.value })} />
              </Field>
              <Field label="Processing — min (days)">
                <input className="input-field" type="number" min="0" value={draft.processingMin}
                  onChange={(e) => setDraft({ processingMin: e.target.value })} />
              </Field>
              <Field label="Processing — max (days)">
                <input className="input-field" type="number" min="0" value={draft.processingMax}
                  onChange={(e) => setDraft({ processingMax: e.target.value })} />
              </Field>
            </div>
          </details>
        </section>

        <section className="border-t border-line pt-6">
          <p className="text-sm font-semibold text-ink-900">Shipping, processing, and returns</p>
          <p className="text-xs text-ink-500 mt-0.5 mb-4">
            Give clear expectations about delivery time and cost.
          </p>

          {methods.length === 0 ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <p className="font-semibold mb-1">No shipping methods configured</p>
              <p className="text-xs">
                You'll need at least one before publishing.{' '}
                <Link href="/shipping" className="underline font-semibold hover:no-underline">Set up shipping →</Link>
              </p>
            </div>
          ) : selectedMethod ? (
            <div className="rounded-md border border-line bg-canvas p-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-md bg-brand-50 text-brand-700 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="6" width="15" height="13" rx="2"/><path d="M16 8h4l3 4v6h-3"/><circle cx="6" cy="19" r="2"/><circle cx="19" cy="19" r="2"/></svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink-900">{selectedMethod.name}</p>
                <p className="text-xs text-ink-500">
                  {selectedMethod.carrier} · {selectedMethod.etaMinDays}–{selectedMethod.etaMaxDays} days
                  {Number(selectedMethod.baseRate) > 0 ? ` · ${currencySymbol}${selectedMethod.baseRate} base` : ' · Free'}
                </p>
              </div>
              <button type="button" onClick={() => setDraft({ shippingMethodId: '' })}
                className="text-xs font-semibold text-brand-700 hover:text-brand-800">Change profile</button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-700">Choose a shipping profile</p>
              {methods.map((m) => (
                <button key={m.id} type="button" onClick={() => setDraft({ shippingMethodId: m.id })}
                  className="w-full text-left rounded-md border border-line bg-surface hover:border-ink-300 p-3 transition">
                  <p className="text-sm font-semibold text-ink-900">{m.name}</p>
                  <p className="text-xs text-ink-500 mt-0.5">
                    {m.carrier} · {m.etaMinDays}–{m.etaMaxDays} days
                    {Number(m.baseRate) > 0 ? ` · ${currencySymbol}${m.baseRate} base` : ' · Free'}
                  </p>
                </button>
              ))}
              <Link href="/shipping" className="inline-block text-sm font-semibold text-brand-700 hover:text-brand-800 mt-2">
                + Create new shipping method
              </Link>
            </div>
          )}

          <p className="text-[11px] text-ink-500 mt-3">
            The selected profile is saved on this listing as the default for buyer quotes.
          </p>
        </section>

        <section className="border-t border-line pt-6">
          <p className="text-sm font-semibold text-ink-900">Returns and exchanges</p>
          <p className="text-xs text-ink-500 mt-0.5 mb-3">Pick a reusable return policy. Manage them in <Link href="/policies" target="_blank" className="font-semibold text-brand-700 hover:underline">Return policies</Link>.</p>

          {policies.length === 0 ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <p className="font-semibold mb-1">No return policies yet</p>
              <p className="text-xs">
                Create at least one to attach to your listings.{' '}
                <Link href="/policies" target="_blank" className="underline font-semibold hover:no-underline">Create one →</Link>
              </p>
            </div>
          ) : selectedPolicy ? (
            <div className="rounded-md border border-line bg-canvas p-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-md bg-brand-50 text-brand-700 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h18M12 3l-9 9 9 9"/></svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink-900">{selectedPolicy.name}</p>
                <p className="text-xs text-ink-500">
                  {selectedPolicy.accepted ? `${selectedPolicy.days}-day returns` : 'No returns accepted'}
                  {selectedPolicy.accepted && (selectedPolicy.buyerPaysReturn ? ' · buyer pays return shipping' : ' · seller pays return shipping')}
                </p>
              </div>
              <button type="button" onClick={() => setDraft({ returnPolicyId: '' })}
                className="text-xs font-semibold text-brand-700 hover:text-brand-800">Change</button>
            </div>
          ) : (
            <div className="space-y-2">
              {policies.map((p) => (
                <button key={p.id} type="button" onClick={() => setDraft({ returnPolicyId: p.id })}
                  className="w-full text-left rounded-md border border-line bg-surface hover:border-ink-300 p-3 transition">
                  <p className="text-sm font-semibold text-ink-900">{p.name}</p>
                  <p className="text-xs text-ink-500 mt-0.5">
                    {p.accepted ? `${p.days}-day returns` : 'No returns accepted'}
                    {p.accepted && (p.buyerPaysReturn ? ' · buyer pays' : ' · seller pays')}
                  </p>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
