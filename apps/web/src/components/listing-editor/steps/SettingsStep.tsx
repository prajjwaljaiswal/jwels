'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { StepHeader, StepProps, Field } from '../StepShell';
import { RenewalMode } from '../types';

interface Section { id: string; name: string; slug: string }

export function SettingsStep({ draft, setDraft }: StepProps) {
  const [sections, setSections] = useState<Section[]>([]);

  useEffect(() => {
    api<Section[]>('/api/vendors/me/sections', { silent: true })
      .then(setSections).catch(() => setSections([]));
  }, []);

  return (
    <>
      <StepHeader
        title="Settings"
        subtitle="Choose how this listing displays in your shop and how it renews."
      />
      <div className="p-6 space-y-6">
        <Field label="Shop section" hint="Group listings inside your storefront">
          <div className="flex gap-2 max-w-md">
            <select className="input-field flex-1" value={draft.shopSection}
              onChange={(e) => setDraft({ shopSection: e.target.value })}>
              <option value="">None</option>
              {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <Link href="/vendor/sections" target="_blank"
              className="px-3 h-10 inline-flex items-center rounded-pill border border-line text-sm font-semibold text-ink-700 hover:bg-canvas">
              Manage
            </Link>
          </div>
          {sections.length === 0 && (
            <span className="block text-[11px] text-ink-500 mt-1">
              No sections yet — <Link href="/vendor/sections" target="_blank" className="font-semibold text-brand-700 hover:underline">create one</Link> to group your listings.
            </span>
          )}
        </Field>

        <button type="button"
          onClick={() => setDraft({ isActive: !draft.isActive })}
          className="w-full flex items-start gap-3 p-3 rounded-md border border-line bg-canvas hover:bg-surface text-left transition">
          <span className={['mt-0.5 h-5 w-9 rounded-full transition-colors shrink-0 relative', draft.isActive ? 'bg-brand-600' : 'bg-ink-300'].join(' ')}>
            <span className={['absolute top-0.5 h-4 w-4 bg-white rounded-full shadow transition-transform', draft.isActive ? 'translate-x-4' : 'translate-x-0.5'].join(' ')} />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-semibold text-ink-900">
              Listing visible {draft.isActive ? <span className="text-emerald-600">(Active)</span> : <span className="text-ink-500">(Hidden)</span>}
            </span>
            <span className="block text-xs text-ink-500 mt-0.5">
              Turn off to hide this listing from shoppers without deleting it.
            </span>
          </span>
        </button>

        <button type="button"
          onClick={() => setDraft({ featured: !draft.featured })}
          className="w-full flex items-start gap-3 p-3 rounded-md border border-line bg-canvas hover:bg-surface text-left transition">
          <span className={['mt-0.5 h-5 w-9 rounded-full transition-colors shrink-0 relative', draft.featured ? 'bg-brand-600' : 'bg-ink-300'].join(' ')}>
            <span className={['absolute top-0.5 h-4 w-4 bg-white rounded-full shadow transition-transform', draft.featured ? 'translate-x-4' : 'translate-x-0.5'].join(' ')} />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-semibold text-ink-900">Feature this listing</span>
            <span className="block text-xs text-ink-500 mt-0.5">
              Showcase this listing at the top of your shop home to make it stand out.
            </span>
          </span>
        </button>

        <Field label="Warranty / exchange policy" hint="Shown as a badge on the product page">
          <input className="input-field" maxLength={200}
            placeholder="e.g. Lifetime Warranty / Exchange Available"
            value={draft.warranty}
            onChange={(e) => setDraft({ warranty: e.target.value })} />
        </Field>

        <Field label="Certificate image" hint="Upload an IGI / GIA / BIS hallmark certificate scan (JPG, PNG, or PDF)">
          <input type="file" accept="image/*,application/pdf"
            onChange={(e) => setDraft({ certificateFile: e.target.files?.[0] ?? null })} />
          {draft.existingCertificateUrl && !draft.certificateFile && (
            <a href={draft.existingCertificateUrl} target="_blank" rel="noreferrer"
              className="inline-block mt-2 text-xs text-brand-700 font-semibold hover:underline">
              Current certificate ↗
            </a>
          )}
        </Field>

        <div>
          <p className="text-sm font-semibold text-ink-900">Renewal options <span className="text-danger">*</span></p>
          <p className="text-xs text-ink-500 mt-0.5 mb-3">Listings stay live for four months and then renew or expire.</p>

          <div className="space-y-2">
            <RenewalRow id="AUTOMATIC" label="Automatic"
              desc="This listing will auto-renew when it expires (recommended)."
              checked={draft.renewalMode === 'AUTOMATIC'}
              onSelect={() => setDraft({ renewalMode: 'AUTOMATIC' })} />
            <RenewalRow id="MANUAL" label="Manual"
              desc="I'll renew expired listings myself."
              checked={draft.renewalMode === 'MANUAL'}
              onSelect={() => setDraft({ renewalMode: 'MANUAL' })} />
          </div>
        </div>
      </div>
    </>
  );
}

function RenewalRow({ id, label, desc, checked, onSelect }: {
  id: RenewalMode; label: string; desc: string; checked: boolean; onSelect: () => void;
}) {
  return (
    <button type="button" onClick={onSelect}
      className={[
        'w-full flex items-start gap-3 p-3 rounded-md border text-left transition',
        checked ? 'border-brand-600 bg-brand-50 ring-1 ring-brand-600' : 'border-line bg-surface hover:border-ink-300',
      ].join(' ')}
    >
      <span className={[
        'mt-0.5 h-5 w-5 rounded-full border-2 shrink-0 flex items-center justify-center',
        checked ? 'border-brand-600' : 'border-ink-300',
      ].join(' ')}>
        {checked && <span className="h-2.5 w-2.5 rounded-full bg-brand-600" />}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold text-ink-900">{label}</span>
        <span className="block text-xs text-ink-500 mt-0.5">{desc}</span>
      </span>
    </button>
  );
}
