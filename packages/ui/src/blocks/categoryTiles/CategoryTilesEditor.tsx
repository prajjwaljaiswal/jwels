'use client';
import type { CategoryTilesSettings, CategoryTilesItem } from './CategoryTiles';
import type { EditorContext } from '../types';
import { ImageField } from '@/components/blocks/system/formPrimitives';

export function CategoryTilesEditor({ settings: s, onChange }: {
  settings: CategoryTilesSettings;
  onChange: (next: CategoryTilesSettings) => void;
  ctx: EditorContext;
}) {
  function updateItem(i: number, patch: Partial<CategoryTilesItem>) {
    onChange({ ...s, items: s.items.map((it, idx) => idx === i ? { ...it, ...patch } : it) });
  }
  function addItem() {
    onChange({ ...s, items: [...s.items, { imageUrl: '', title: '', href: '', overlay: true }] });
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
      <label className="block">
        <span className="block text-xs font-medium text-ink-700 mb-1">Columns</span>
        <select className="input-field" value={s.columns}
          onChange={(e) => onChange({ ...s, columns: Number(e.target.value) as any })}>
          {[2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>

      <div className="space-y-2">
        {s.items.map((it, i) => (
          <div key={i} className="rounded-md border border-line p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wide text-ink-500">Tile #{i + 1}</span>
              <button type="button" onClick={() => removeItem(i)}
                className="text-xs text-danger">Remove</button>
            </div>
            <ImageField label="Image" value={it.imageUrl} onChange={(url) => updateItem(i, { imageUrl: url })} optional={false} />
            <label className="text-xs flex items-center gap-1">
              <input type="checkbox" checked={it.overlay}
                onChange={(e) => updateItem(i, { overlay: e.target.checked })} />
              Overlay title on image
            </label>
            <input className="input-field h-9 text-sm" placeholder="Title (e.g. Coloured Solitaires)"
              value={it.title} onChange={(e) => updateItem(i, { title: e.target.value })} />
            <input className="input-field h-9 text-sm" placeholder="Link (/c/rings, /collection/bridal, …)"
              value={it.href} onChange={(e) => updateItem(i, { href: e.target.value })} />
          </div>
        ))}
        <button type="button" onClick={addItem}
          className="text-xs font-semibold text-brand-700 hover:text-brand-800">+ Add tile</button>
      </div>
    </div>
  );
}
