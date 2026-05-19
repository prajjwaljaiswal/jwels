'use client';
import type { RichTextSettings } from './RichText';

export function RichTextEditor({
  settings: s,
  onChange,
}: {
  settings: RichTextSettings;
  onChange: (next: RichTextSettings) => void;
  ctx: any;
}) {
  return (
    <div className="space-y-3">
      <Field label="Content (HTML supported: p, h2, h3, ul, ol, a, strong, em, …)">
        <textarea
          className="input-field font-mono text-xs"
          rows={12}
          value={s.html}
          maxLength={20000}
          onChange={(e) => onChange({ ...s, html: e.target.value })}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Max width">
          <select
            className="input-field"
            value={s.maxWidth}
            onChange={(e) => onChange({ ...s, maxWidth: e.target.value as RichTextSettings['maxWidth'] })}
          >
            <option value="narrow">Narrow</option>
            <option value="medium">Medium</option>
            <option value="wide">Wide</option>
          </select>
        </Field>
        <Field label="Alignment">
          <select
            className="input-field"
            value={s.align}
            onChange={(e) => onChange({ ...s, align: e.target.value as RichTextSettings['align'] })}
          >
            <option value="left">Left</option>
            <option value="center">Center</option>
          </select>
        </Field>
      </div>
      <p className="text-xs text-ink-500">
        Scripts and unsafe attributes are stripped automatically when published.
      </p>
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
