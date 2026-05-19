'use client';
import type { FeatureStripSettings, FeatureStripItem } from './FeatureStrip';
import type { EditorContext } from '../types';
import { ImageField } from '@/components/blocks/system/formPrimitives';

export function FeatureStripEditor({ settings: s, onChange }: {
  settings: FeatureStripSettings;
  onChange: (next: FeatureStripSettings) => void;
  ctx: EditorContext;
}) {
  function updateItem(i: number, patch: Partial<FeatureStripItem>) {
    onChange({ ...s, items: s.items.map((it, idx) => idx === i ? { ...it, ...patch } : it) });
  }
  function addItem() {
    onChange({ ...s, items: [...s.items, { iconUrl: '', label: '', sublabel: '', href: '' }] });
  }
  function removeItem(i: number) {
    onChange({ ...s, items: s.items.filter((_, idx) => idx !== i) });
  }

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="block text-xs font-medium text-ink-700 mb-1">Heading (optional)</span>
        <input className="input-field" value={s.heading} onChange={(e) => onChange({ ...s, heading: e.target.value })} />
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

      <div className="space-y-2">
        {s.items.map((it, i) => (
          <div key={i} className="rounded-md border border-line p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wide text-ink-500">Item #{i + 1}</span>
              <button type="button" onClick={() => removeItem(i)}
                className="text-xs text-danger">Remove</button>
            </div>
            <ImageField label="Icon (optional)" value={it.iconUrl} onChange={(url) => updateItem(i, { iconUrl: url })} />
            <input className="input-field h-9 text-sm" placeholder="Label"
              value={it.label} onChange={(e) => updateItem(i, { label: e.target.value })} />
            <input className="input-field h-9 text-sm" placeholder="Sub-label (optional)"
              value={it.sublabel} onChange={(e) => updateItem(i, { sublabel: e.target.value })} />
            <input className="input-field h-9 text-sm" placeholder="Link (optional)"
              value={it.href} onChange={(e) => updateItem(i, { href: e.target.value })} />
          </div>
        ))}
        <button type="button" onClick={addItem}
          className="text-xs font-semibold text-brand-700 hover:text-brand-800">+ Add item</button>
      </div>
    </div>
  );
}
