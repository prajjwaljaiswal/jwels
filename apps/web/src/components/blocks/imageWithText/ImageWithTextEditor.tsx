'use client';
import { ImageField } from '@/components/blocks/system/formPrimitives';
import type { ImageWithTextSettings } from './ImageWithText';
import type { EditorContext } from '../types';

export function ImageWithTextEditor({
  settings: s,
  onChange,
}: {
  settings: ImageWithTextSettings;
  onChange: (next: ImageWithTextSettings) => void;
  ctx: EditorContext;
}) {
  return (
    <div className="space-y-3">
      <ImageField label="Image" value={s.imageUrl} onChange={(url) => onChange({ ...s, imageUrl: url })} />
      <Field label="Image position">
        <select
          className="input-field"
          value={s.imagePosition}
          onChange={(e) => onChange({ ...s, imagePosition: e.target.value as ImageWithTextSettings['imagePosition'] })}
        >
          <option value="left">Left</option>
          <option value="right">Right</option>
        </select>
      </Field>
      <Field label="Heading">
        <input className="input-field" value={s.heading} maxLength={200} onChange={(e) => onChange({ ...s, heading: e.target.value })} />
      </Field>
      <Field label="Body">
        <textarea className="input-field" rows={4} value={s.body} maxLength={2000} onChange={(e) => onChange({ ...s, body: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Button label (optional)">
          <input className="input-field" value={s.ctaLabel} maxLength={40} onChange={(e) => onChange({ ...s, ctaLabel: e.target.value })} />
        </Field>
        <Field label="Button link">
          <input className="input-field" value={s.ctaHref} onChange={(e) => onChange({ ...s, ctaHref: e.target.value })} />
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
