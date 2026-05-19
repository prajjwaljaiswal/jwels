'use client';
import type { EmailCaptureSettings } from './EmailCapture';
import type { EditorContext } from '../types';

export function EmailCaptureEditor({ settings: s, onChange }: {
  settings: EmailCaptureSettings;
  onChange: (next: EmailCaptureSettings) => void;
  ctx: EditorContext;
}) {
  return (
    <div className="space-y-3">
      <label className="block">
        <span className="block text-xs font-medium text-ink-700 mb-1">Eyebrow (optional)</span>
        <input className="input-field" value={s.eyebrow} onChange={(e) => onChange({ ...s, eyebrow: e.target.value })} />
      </label>
      <label className="block">
        <span className="block text-xs font-medium text-ink-700 mb-1">Heading</span>
        <input className="input-field" value={s.heading} onChange={(e) => onChange({ ...s, heading: e.target.value })} />
      </label>
      <label className="block">
        <span className="block text-xs font-medium text-ink-700 mb-1">Subheading</span>
        <input className="input-field" value={s.subheading} onChange={(e) => onChange({ ...s, subheading: e.target.value })} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-xs font-medium text-ink-700 mb-1">Placeholder</span>
          <input className="input-field" value={s.placeholder} onChange={(e) => onChange({ ...s, placeholder: e.target.value })} />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-ink-700 mb-1">Button label</span>
          <input className="input-field" value={s.ctaLabel} onChange={(e) => onChange({ ...s, ctaLabel: e.target.value })} />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-ink-700 mb-1">Incentive code (optional)</span>
          <input className="input-field" value={s.incentiveCode} onChange={(e) => onChange({ ...s, incentiveCode: e.target.value })} />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-ink-700 mb-1">Background</span>
          <select className="input-field" value={s.background}
            onChange={(e) => onChange({ ...s, background: e.target.value as any })}>
            <option value="none">None</option>
            <option value="canvas">Canvas</option>
            <option value="brand">Brand tint</option>
          </select>
        </label>
      </div>
    </div>
  );
}
