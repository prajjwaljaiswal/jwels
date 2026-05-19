'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { StepHeader, StepProps, Field } from '../StepShell';
import { Purity, Gender, SHOWS_PURITY, SHOWS_HALLMARK, SHOWS_BASE_METAL, SHOWS_SAFETY } from '../types';

interface AttributeOption { id: string; value: string }
interface Attribute { id: string; name: string; inputType: 'SELECT' | 'TEXT' | 'NUMBER'; isRequired: boolean; options: AttributeOption[] }

const MATERIAL_OPTIONS = [
  'Yellow Gold', 'White Gold', 'Rose Gold',
  'Sterling Silver', 'Oxidised Silver',
  'Platinum',
  'Brass', 'Alloy', 'Copper', 'German Silver', 'Stainless Steel', 'Aluminium',
  'Pearl', 'Bead', 'Resin', 'Wood', 'Terracotta', 'Thread', 'Fabric',
];

const PURITY_OPTIONS: { value: Exclude<Purity, ''>; label: string }[] = [
  { value: 'K14',          label: '14K' },
  { value: 'K18',          label: '18K' },
  { value: 'K22',          label: '22K' },
  { value: 'K24',          label: '24K' },
  { value: 'SILVER_925',   label: 'Silver 925' },
  { value: 'PLATINUM_950', label: 'Platinum 950' },
  { value: 'OTHER',        label: 'Other' },
];

const GENDER_OPTIONS: { value: Exclude<Gender, ''>; label: string }[] = [
  { value: 'WOMEN',   label: 'Women' },
  { value: 'MEN',     label: 'Men' },
  { value: 'UNISEX',  label: 'Unisex' },
  { value: 'KIDS',    label: 'Kids' },
];

const CERTIFIERS = ['BIS', 'IGI', 'SGL', 'GIA', 'GSI', 'Other'];
const PLATING_OPTIONS = ['Rhodium', 'Gold-plated', 'Rose-gold plated', 'Silver-plated', 'Oxidised', 'None'];

export function DetailsStep({ draft, setDraft }: StepProps) {
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const jt = draft.jewelleryType || 'FASHION';
  const showPurity    = draft.jewelleryType ? SHOWS_PURITY[jt as Exclude<typeof jt, ''>]    : false;
  const showHallmark  = draft.jewelleryType ? SHOWS_HALLMARK[jt as Exclude<typeof jt, ''>]  : false;
  const showBaseMetal = draft.jewelleryType ? SHOWS_BASE_METAL[jt as Exclude<typeof jt, ''>]: true;
  const showSafety    = draft.jewelleryType ? SHOWS_SAFETY[jt as Exclude<typeof jt, ''>]    : true;

  useEffect(() => {
    if (!draft.categoryId) { setAttributes([]); return; }
    api<Attribute[]>(`/api/categories/${draft.categoryId}/attributes?includeAncestors=1`, { auth: false })
      .then(setAttributes)
      .catch(() => setAttributes([]));
  }, [draft.categoryId]);

  function toggleMaterial(m: string) {
    const has = draft.materials.includes(m);
    setDraft({ materials: has ? draft.materials.filter((x) => x !== m) : [...draft.materials, m] });
  }

  return (
    <>
      <StepHeader
        title="Item details"
        subtitle="Help buyers understand your item better, and any special options you offer."
      />
      <div className="p-6 space-y-5">
        <Field label="Title" required hint={`${draft.title.length}/140`}>
          <textarea
            className="input-field min-h-[60px] resize-none"
            placeholder="e.g. 22k Gold Kundan Choker — Handcrafted Bridal Necklace"
            maxLength={140}
            value={draft.title}
            onChange={(e) => setDraft({ title: e.target.value })}
          />
          <span className="block text-[11px] text-ink-500 mt-1">
            Make sure your title is easy to understand and clearly describes the item you're selling.
          </span>
        </Field>

        <Field label="Brand" hint="Optional — brand or maker name (e.g. Angara, Tanishq, your studio)">
          <input className="input-field" placeholder="Brand name"
            value={draft.brand} maxLength={60}
            onChange={(e) => setDraft({ brand: e.target.value })} />
        </Field>

        <Field label="Description" required hint={`${draft.description.length} chars`}>
          <textarea
            className="input-field min-h-[160px] resize-y"
            placeholder="Materials, dimensions, what's included, care instructions…"
            value={draft.description}
            onChange={(e) => setDraft({ description: e.target.value })}
          />
          <span className="block text-[11px] text-ink-500 mt-1">
            What makes your item special? Buyers see the first few lines unless they expand.
          </span>
        </Field>

        <Field label="Key features / highlights" hint="Short bullet points shown on the product page (one per line)">
          <textarea className="input-field min-h-[100px] resize-y"
            placeholder={"Premium bezel-set lab-grown diamond\nEthically sourced\nLifetime exchange available"}
            value={draft.highlights.join('\n')}
            onChange={(e) => setDraft({ highlights: e.target.value.split('\n').map((s) => s.slice(0, 120)) })} />
          <span className="block text-[11px] text-ink-500 mt-1">
            Up to ~8 bullets. Keep each under 120 characters.
          </span>
        </Field>

        <details className="rounded-md border border-line p-4">
          <summary className="text-sm font-semibold text-ink-900 cursor-pointer">SEO &amp; search visibility (optional)</summary>
          <div className="space-y-4 mt-3">
            <Field label="SEO title" hint={`${draft.seoTitle.length}/120 — shown as the page title in Google`}>
              <input className="input-field" maxLength={120}
                placeholder={draft.title || 'Page title'}
                value={draft.seoTitle}
                onChange={(e) => setDraft({ seoTitle: e.target.value })} />
            </Field>
            <Field label="Meta description" hint={`${draft.seoDescription.length}/320 — the snippet under the title in search results`}>
              <textarea className="input-field min-h-[70px] resize-y" maxLength={320}
                placeholder="One-line summary of the product for search engines."
                value={draft.seoDescription}
                onChange={(e) => setDraft({ seoDescription: e.target.value })} />
            </Field>
          </div>
        </details>

        <Field label="Materials" hint="Pick everything that applies — used for search and storefront filters">
          <div className="flex flex-wrap gap-2">
            {MATERIAL_OPTIONS.map((m) => {
              const active = draft.materials.includes(m);
              return (
                <button key={m} type="button" onClick={() => toggleMaterial(m)}
                  className={[
                    'text-xs rounded-pill px-3 py-1 border transition',
                    active
                      ? 'bg-brand-50 border-brand-600 text-brand-700 font-semibold'
                      : 'bg-surface border-line text-ink-700 hover:border-ink-300',
                  ].join(' ')}>
                  {m}
                </button>
              );
            })}
          </div>
        </Field>

        {/* ── Jewellery identity (conditional by type) ───────── */}
        {draft.jewelleryType && (
          <div className="border-t border-line pt-5 space-y-4">
            <div>
              <p className="text-sm font-semibold text-ink-900">Jewellery identity</p>
              <p className="text-xs text-ink-500 mt-0.5">Fields below adapt to your selected type ({draft.jewelleryType.replace('_', '-').toLowerCase()}).</p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {showPurity && (
                <Field label="Purity" hint="Gold karat or silver/platinum grade">
                  <select className="input-field" value={draft.purity}
                    onChange={(e) => setDraft({ purity: e.target.value as Purity })}>
                    <option value="">— Select —</option>
                    {PURITY_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </Field>
              )}

              {showBaseMetal && (
                <Field label="Base metal" hint="The underlying metal beneath any plating">
                  <input className="input-field" placeholder="e.g. Brass, Alloy, Sterling Silver"
                    value={draft.baseMetal} maxLength={60}
                    onChange={(e) => setDraft({ baseMetal: e.target.value })} />
                </Field>
              )}

              <Field label="Plating / finish" hint="If the piece is plated">
                <select className="input-field" value={draft.plating}
                  onChange={(e) => setDraft({ plating: e.target.value })}>
                  <option value="">— Select —</option>
                  {PLATING_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </Field>

              <Field label="For" hint="Who is this jewellery designed for?">
                <select className="input-field" value={draft.gender}
                  onChange={(e) => setDraft({ gender: e.target.value as Gender })}>
                  <option value="">— Select —</option>
                  {GENDER_OPTIONS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                </select>
              </Field>
            </div>

            {showHallmark && (
              <div className="rounded-md border border-line p-4 bg-canvas/30">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" className="h-4 w-4 accent-brand-600"
                    checked={draft.hallmarked}
                    onChange={(e) => setDraft({ hallmarked: e.target.checked })} />
                  <span className="text-sm font-semibold text-ink-900">Hallmarked / certified</span>
                </label>
                {draft.hallmarked && (
                  <div className="grid md:grid-cols-2 gap-4 mt-3">
                    <Field label="Certified by">
                      <select className="input-field" value={draft.certifiedBy}
                        onChange={(e) => setDraft({ certifiedBy: e.target.value })}>
                        <option value="">— Select —</option>
                        {CERTIFIERS.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </Field>
                    <Field label="Certificate number">
                      <input className="input-field" placeholder="e.g. IGI-3489201"
                        value={draft.certificateNumber} maxLength={80}
                        onChange={(e) => setDraft({ certificateNumber: e.target.value })} />
                    </Field>
                  </div>
                )}
              </div>
            )}

            {showSafety && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-700 mb-2">Safety & wear</p>
                <div className="flex flex-wrap gap-3 text-sm">
                  {([
                    ['antiTarnish',    'Anti-tarnish'],
                    ['nickelFree',     'Nickel-free'],
                    ['hypoallergenic', 'Hypoallergenic'],
                    ['leadFree',       'Lead-free'],
                  ] as const).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" className="h-4 w-4 accent-brand-600"
                        checked={(draft as any)[key]}
                        onChange={(e) => setDraft({ [key]: e.target.checked } as any)} />
                      <span className="text-ink-700">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <Field label="Care instructions" hint="Optional — how to keep it looking new">
              <textarea className="input-field min-h-[70px] resize-y" maxLength={1000}
                placeholder="e.g. Store in a dry pouch, avoid water and perfume."
                value={draft.careInstructions}
                onChange={(e) => setDraft({ careInstructions: e.target.value })} />
            </Field>

            <details className="rounded-md border border-line p-4">
              <summary className="text-sm font-semibold text-ink-900 cursor-pointer">Tax & origin info</summary>
              <div className="grid md:grid-cols-3 gap-4 mt-3">
                <Field label="HSN code" hint="Defaults to 7113 (precious) / 7117 (imitation)">
                  <input className="input-field" placeholder={draft.jewelleryType === 'FASHION' || draft.jewelleryType === 'HANDCRAFTED' ? '7117' : '7113'}
                    value={draft.hsnCode} maxLength={20}
                    onChange={(e) => setDraft({ hsnCode: e.target.value })} />
                </Field>
                <Field label="GST rate %" hint="Default 3%">
                  <input className="input-field" type="number" min="0" max="100" step="0.01"
                    placeholder="3"
                    value={draft.gstRatePercent}
                    onChange={(e) => setDraft({ gstRatePercent: e.target.value })} />
                </Field>
                <Field label="Country of origin">
                  <input className="input-field" value={draft.countryOfOrigin} maxLength={40}
                    onChange={(e) => setDraft({ countryOfOrigin: e.target.value })} />
                </Field>
              </div>
            </details>
          </div>
        )}

        {!draft.categoryId && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            Pick a category first to see additional details for your listing.
          </div>
        )}

        {attributes.length > 0 && (
          <div className="border-t border-line pt-5">
            <p className="text-sm font-semibold text-ink-900 mb-3">Category details</p>
            <div className="grid md:grid-cols-2 gap-4">
              {attributes.map((attr) => (
                <Field key={attr.id} label={attr.name} required={attr.isRequired}>
                  {attr.inputType === 'SELECT' ? (
                    <select className="input-field"
                      value={draft.attrValues[attr.id] || ''}
                      onChange={(e) => setDraft({ attrValues: { ...draft.attrValues, [attr.id]: e.target.value } })}>
                      <option value="">— Select —</option>
                      {attr.options.map((o) => <option key={o.id} value={o.value}>{o.value}</option>)}
                    </select>
                  ) : (
                    <input type={attr.inputType === 'NUMBER' ? 'number' : 'text'} className="input-field"
                      value={draft.attrValues[attr.id] || ''}
                      onChange={(e) => setDraft({ attrValues: { ...draft.attrValues, [attr.id]: e.target.value } })} />
                  )}
                </Field>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
