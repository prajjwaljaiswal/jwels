'use client';
import type { ImageStripSettings, ImageStripItem } from './ImageStrip';
import type { EditorContext } from '../types';
import { ImageField } from '@/components/blocks/system/formPrimitives';

export function ImageStripEditor({ settings: s, onChange }: {
  settings: ImageStripSettings;
  onChange: (next: ImageStripSettings) => void;
  ctx: EditorContext;
}) {
  function updateItem(i: number, patch: Partial<ImageStripItem>) {
    onChange({ ...s, items: s.items.map((it, idx) => idx === i ? { ...it, ...patch } : it) });
  }
  function addItem() {
    onChange({ ...s, items: [...s.items, { imageUrl: '', alt: '', href: '' }] });
  }
  function removeItem(i: number) {
    onChange({ ...s, items: s.items.filter((_, idx) => idx !== i) });
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-xs font-medium text-ink-700 mb-1">Heading (optional)</span>
          <input className="input-field" value={s.heading} onChange={(e) => onChange({ ...s, heading: e.target.value })} />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-ink-700 mb-1">Image aspect</span>
          <select className="input-field" value={s.aspect}
            onChange={(e) => onChange({ ...s, aspect: e.target.value as any })}>
            <option value="4:5">4 : 5</option>
            <option value="1:1">1 : 1</option>
            <option value="3:4">3 : 4</option>
            <option value="16:9">16 : 9</option>
          </select>
        </label>
      </div>

      <div className="space-y-2">
        {s.items.map((it, i) => (
          <div key={i} className="rounded-md border border-line p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wide text-ink-500">Image #{i + 1}</span>
              <button type="button" onClick={() => removeItem(i)}
                className="text-xs text-danger">Remove</button>
            </div>
            <ImageField label="Image" value={it.imageUrl} onChange={(url) => updateItem(i, { imageUrl: url })} optional={false} />
            <input className="input-field h-9 text-sm" placeholder="Alt text (optional)"
              value={it.alt} onChange={(e) => updateItem(i, { alt: e.target.value })} />
            <input className="input-field h-9 text-sm" placeholder="Link (optional)"
              value={it.href} onChange={(e) => updateItem(i, { href: e.target.value })} />
          </div>
        ))}
        <button type="button" onClick={addItem}
          className="text-xs font-semibold text-brand-700 hover:text-brand-800">+ Add image</button>
      </div>
    </div>
  );
}
