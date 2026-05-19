'use client';
import type { IconGridSettings, IconGridItem } from './IconGrid';
import type { EditorContext } from '../types';
import { ImageField } from '@/components/blocks/system/formPrimitives';

export function IconGridEditor({ settings: s, onChange }: {
  settings: IconGridSettings;
  onChange: (next: IconGridSettings) => void;
  ctx: EditorContext;
}) {
  function updateItem(i: number, patch: Partial<IconGridItem>) {
    onChange({ ...s, items: s.items.map((it, idx) => idx === i ? { ...it, ...patch } : it) });
  }
  function addItem() {
    onChange({ ...s, items: [...s.items, { iconUrl: '', iconColor: '', title: '', caption: '', href: '' }] });
  }
  function removeItem(i: number) {
    onChange({ ...s, items: s.items.filter((_, idx) => idx !== i) });
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-xs font-medium text-ink-700 mb-1">Heading</span>
          <input className="input-field" value={s.heading} onChange={(e) => onChange({ ...s, heading: e.target.value })} />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-ink-700 mb-1">Columns</span>
          <select className="input-field" value={s.columns}
            onChange={(e) => onChange({ ...s, columns: Number(e.target.value) as any })}>
            {[3, 4, 5, 6, 12].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>
      <label className="block">
        <span className="block text-xs font-medium text-ink-700 mb-1">Subheading (optional)</span>
        <input className="input-field" value={s.subheading} onChange={(e) => onChange({ ...s, subheading: e.target.value })} />
      </label>

      <div className="space-y-2">
        {s.items.map((it, i) => (
          <div key={i} className="rounded-md border border-line p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wide text-ink-500">Icon #{i + 1}</span>
              <button type="button" onClick={() => removeItem(i)} className="text-xs text-danger">Remove</button>
            </div>
            <ImageField label="Icon (optional)" value={it.iconUrl} onChange={(url) => updateItem(i, { iconUrl: url })} />
            <input className="input-field h-9 text-sm w-full" placeholder="Bg colour #hex (optional)"
              value={it.iconColor} onChange={(e) => updateItem(i, { iconColor: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <input className="input-field h-9 text-sm" placeholder="Title"
                value={it.title} onChange={(e) => updateItem(i, { title: e.target.value })} />
              <input className="input-field h-9 text-sm" placeholder="Caption (optional)"
                value={it.caption} onChange={(e) => updateItem(i, { caption: e.target.value })} />
            </div>
            <input className="input-field h-9 text-sm" placeholder="Link (optional)"
              value={it.href} onChange={(e) => updateItem(i, { href: e.target.value })} />
          </div>
        ))}
        <button type="button" onClick={addItem}
          className="text-xs font-semibold text-brand-700 hover:text-brand-800">+ Add icon</button>
      </div>
    </div>
  );
}
