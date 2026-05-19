'use client';
import type { EditorialCardsSettings, EditorialItem } from './EditorialCards';
import type { EditorContext } from '../types';
import { ImageField } from '@/components/blocks/system/formPrimitives';

export function EditorialCardsEditor({ settings: s, onChange }: {
  settings: EditorialCardsSettings;
  onChange: (next: EditorialCardsSettings) => void;
  ctx: EditorContext;
}) {
  function updateItem(i: number, patch: Partial<EditorialItem>) {
    onChange({ ...s, items: s.items.map((it, idx) => idx === i ? { ...it, ...patch } : it) });
  }
  function addItem() {
    onChange({ ...s, items: [...s.items, { imageUrl: '', eyebrow: '', title: '', body: '', ctaLabel: 'Read & shop', ctaHref: '' }] });
  }
  function removeItem(i: number) {
    onChange({ ...s, items: s.items.filter((_, idx) => idx !== i) });
  }

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="block text-xs font-medium text-ink-700 mb-1">Heading</span>
        <input className="input-field" value={s.heading} onChange={(e) => onChange({ ...s, heading: e.target.value })} />
      </label>

      <div className="space-y-2">
        {s.items.map((it, i) => (
          <div key={i} className="rounded-md border border-line p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wide text-ink-500">Card #{i + 1}</span>
              <button type="button" onClick={() => removeItem(i)}
                className="text-xs text-danger">Remove</button>
            </div>
            <ImageField label="Image" value={it.imageUrl} onChange={(url) => updateItem(i, { imageUrl: url })} optional={false} />
            <input className="input-field h-9 text-sm" placeholder="Eyebrow (e.g. GUIDE)"
              value={it.eyebrow} onChange={(e) => updateItem(i, { eyebrow: e.target.value })} />
            <input className="input-field h-9 text-sm" placeholder="Title"
              value={it.title} onChange={(e) => updateItem(i, { title: e.target.value })} />
            <textarea className="input-field min-h-[60px] text-sm" placeholder="Body (optional)"
              value={it.body} onChange={(e) => updateItem(i, { body: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <input className="input-field h-9 text-sm" placeholder="CTA label"
                value={it.ctaLabel} onChange={(e) => updateItem(i, { ctaLabel: e.target.value })} />
              <input className="input-field h-9 text-sm" placeholder="CTA link"
                value={it.ctaHref} onChange={(e) => updateItem(i, { ctaHref: e.target.value })} />
            </div>
          </div>
        ))}
        <button type="button" onClick={addItem}
          className="text-xs font-semibold text-brand-700 hover:text-brand-800">+ Add card</button>
      </div>
    </div>
  );
}
