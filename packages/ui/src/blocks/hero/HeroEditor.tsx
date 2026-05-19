'use client';
import { ImageField } from '@/components/blocks/system/formPrimitives';
import type { HeroSettings } from './Hero';
import type { EditorContext } from '../types';

export function HeroEditor({
  settings: s,
  onChange,
}: {
  settings: HeroSettings;
  onChange: (next: HeroSettings) => void;
  ctx: EditorContext;
}) {
  return (
    <div className="space-y-3">
      <Field label="Headline">
        <input
          className="input-field"
          value={s.headline}
          maxLength={120}
          onChange={(e) => onChange({ ...s, headline: e.target.value })}
        />
      </Field>
      <Field label="Subheadline">
        <input
          className="input-field"
          value={s.subheadline}
          maxLength={200}
          onChange={(e) => onChange({ ...s, subheadline: e.target.value })}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Button label">
          <input
            className="input-field"
            value={s.ctaLabel}
            maxLength={40}
            onChange={(e) => onChange({ ...s, ctaLabel: e.target.value })}
          />
        </Field>
        <Field label="Button link">
          <input
            className="input-field"
            value={s.ctaHref}
            placeholder="#products or /store/abc"
            onChange={(e) => onChange({ ...s, ctaHref: e.target.value })}
          />
        </Field>
      </div>

      <ImageField
        label="Background image"
        value={s.backgroundImageUrl}
        onChange={(url) => onChange({ ...s, backgroundImageUrl: url })}
      />

      <div className="grid grid-cols-2 gap-3">
        <Field label="Alignment">
          <select
            className="input-field"
            value={s.alignment}
            onChange={(e) => onChange({ ...s, alignment: e.target.value as HeroSettings['alignment'] })}
          >
            <option value="center">Center</option>
            <option value="left">Left</option>
          </select>
        </Field>
        <Field label="Height">
          <select
            className="input-field"
            value={s.height}
            onChange={(e) => onChange({ ...s, height: e.target.value as HeroSettings['height'] })}
          >
            <option value="sm">Small</option>
            <option value="md">Medium</option>
            <option value="lg">Large</option>
          </select>
        </Field>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-ink-700 mb-1">{label}</span>
      {children}
    </label>
  );
}
