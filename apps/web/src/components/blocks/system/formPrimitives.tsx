'use client';

// Small, focused form primitives shared by every hand-built block editor.
// These are intentionally minimal — they wrap the existing `input-field`
// utility so the editor pane stays visually consistent with the rest of the
// vendor admin.

import { useEffect, useState, type ReactNode } from 'react';
import { api } from '@/lib/api';
import { MediaPicker } from '@/components/media/MediaPicker';

export function FieldLabel({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="text-[11px] uppercase tracking-wide font-semibold text-ink-700 mb-1">
      {children}
      {hint && <span className="ml-2 normal-case font-normal tracking-normal text-ink-500">— {hint}</span>}
    </div>
  );
}

export function TextField({
  label, value, onChange, placeholder, maxLength, hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  hint?: string;
}) {
  return (
    <label className="block text-sm">
      <FieldLabel hint={hint}>{label}</FieldLabel>
      <input
        type="text"
        className="input-field w-full"
        value={value ?? ''}
        placeholder={placeholder}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

export function NumberField({
  label, value, onChange, min, max, step = 1, suffix, hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  hint?: string;
}) {
  return (
    <label className="block text-sm">
      <FieldLabel hint={hint}>{label}</FieldLabel>
      <div className="flex items-center gap-2">
        <input
          type="number"
          className="input-field w-full"
          value={Number.isFinite(value) ? value : 0}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) onChange(n);
          }}
        />
        {suffix && <span className="text-xs text-ink-500 shrink-0">{suffix}</span>}
      </div>
    </label>
  );
}

export function BooleanField({
  label, value, onChange, hint,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <label className="flex items-start gap-2 text-sm cursor-pointer py-1">
      <input
        type="checkbox"
        className="mt-0.5"
        checked={!!value}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <span className="text-ink-900">{label}</span>
        {hint && <span className="block text-[11px] text-ink-500">{hint}</span>}
      </span>
    </label>
  );
}

export function SelectField<T extends string>({
  label, value, onChange, options, hint,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  hint?: string;
}) {
  return (
    <label className="block text-sm">
      <FieldLabel hint={hint}>{label}</FieldLabel>
      <select
        className="input-field w-full"
        value={value ?? options[0]?.value}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

export function TextareaField({
  label, value, onChange, rows = 3, placeholder, maxLength, hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
  maxLength?: number;
  hint?: string;
}) {
  return (
    <label className="block text-sm">
      <FieldLabel hint={hint}>{label}</FieldLabel>
      <textarea
        className="input-field w-full py-2"
        rows={rows}
        value={value ?? ''}
        placeholder={placeholder}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

// ── Image field ─────────────────────────────────────────────────────────────
// Drop-in replacement for a TextField when the value is an image URL. Renders
// a thumbnail preview when a value is present, plus "Choose" (opens the media
// library) and "Clear" buttons.
export function ImageField({
  label, value, onChange, hint, optional = true,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  hint?: string;
  optional?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="text-sm">
      <FieldLabel hint={hint}>{label}{optional ? '' : ' *'}</FieldLabel>
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="shrink-0 w-16 h-16 rounded-md border border-line bg-canvas overflow-hidden flex items-center justify-center hover:border-brand-500 transition"
          title="Open media library"
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-[10px] text-ink-500">No image</span>
          )}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="text-xs rounded-md border border-ink-200 px-2.5 py-1.5 hover:border-brand-600 hover:text-brand-700"
            >
              {value ? 'Change' : 'Choose image'}
            </button>
            {value && (
              <button
                type="button"
                onClick={() => onChange('')}
                className="text-xs text-ink-500 hover:text-red-600 px-1.5"
              >
                Clear
              </button>
            )}
          </div>
          {value && (
            <div className="mt-1.5 text-[10px] text-ink-500 truncate" title={value}>
              {value}
            </div>
          )}
        </div>
      </div>
      <MediaPicker open={open} onClose={() => setOpen(false)} onPick={(url) => onChange(url)} accept="image" />
    </div>
  );
}

// ── Items-array editor ──────────────────────────────────────────────────────
// Generic editor for `items: T[]` shaped settings. Pass a render function for
// the per-item form and a factory for adding a new blank item.
export function ItemArrayField<T>({
  label,
  items,
  onChange,
  newItem,
  renderItem,
  max,
  addLabel = 'Add item',
  emptyHint,
}: {
  label: string;
  items: T[];
  onChange: (next: T[]) => void;
  newItem: () => T;
  renderItem: (item: T, update: (patch: Partial<T>) => void) => ReactNode;
  max?: number;
  addLabel?: string;
  emptyHint?: string;
}) {
  function update(i: number, patch: Partial<T>) {
    onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }
  function remove(i: number) {
    onChange(items.filter((_, idx) => idx !== i));
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const copy = items.slice();
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
    onChange(copy);
  }
  function add() {
    if (max != null && items.length >= max) return;
    onChange([...items, newItem()]);
  }
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <FieldLabel>{label}</FieldLabel>
        <span className="text-[10px] text-ink-500">
          {items.length}{max != null ? ` / ${max}` : ''}
        </span>
      </div>
      {items.length === 0 && emptyHint && (
        <p className="text-[11px] text-ink-500 italic mb-2">{emptyHint}</p>
      )}
      <ul className="space-y-2">
        {items.map((it, i) => (
          <li key={i} className="border border-line rounded-md p-2.5 bg-canvas/40">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-wide text-ink-500">#{i + 1}</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="text-ink-500 hover:text-ink-900 disabled:opacity-30 px-1"
                  title="Move up"
                  aria-label="Move up"
                >↑</button>
                <button
                  type="button"
                  onClick={() => move(i, +1)}
                  disabled={i === items.length - 1}
                  className="text-ink-500 hover:text-ink-900 disabled:opacity-30 px-1"
                  title="Move down"
                  aria-label="Move down"
                >↓</button>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="text-red-500 hover:text-red-700 px-1"
                  title="Remove"
                  aria-label="Remove item"
                >×</button>
              </div>
            </div>
            <div className="space-y-2">
              {renderItem(it, (patch) => update(i, patch))}
            </div>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={add}
        disabled={max != null && items.length >= max}
        className="mt-2 w-full rounded-md border border-dashed border-ink-300 text-xs text-ink-700 py-1.5 hover:border-brand-500 hover:text-brand-700 disabled:opacity-40"
      >
        + {addLabel}
      </button>
    </div>
  );
}

// ── Vendor sections select ──────────────────────────────────────────────────
// Fetches `/api/vendors/me/sections` and renders an authenticated section
// picker. Used by Related Products / Cart Upsell when source = "section".
interface VendorSectionLite { id: string; name: string }

export function VendorSectionsSelect({
  label, value, onChange, hint,
}: {
  label: string;
  value: string;
  onChange: (id: string) => void;
  hint?: string;
}) {
  const [sections, setSections] = useState<VendorSectionLite[] | null>(null);
  useEffect(() => {
    let alive = true;
    api<VendorSectionLite[]>('/api/vendors/me/sections', { silent: true })
      .then((d) => { if (alive) setSections(d ?? []); })
      .catch(() => { if (alive) setSections([]); });
    return () => { alive = false; };
  }, []);

  if (sections === null) {
    return (
      <label className="block text-sm">
        <FieldLabel hint={hint}>{label}</FieldLabel>
        <div className="input-field w-full text-ink-500">Loading sections…</div>
      </label>
    );
  }
  if (sections.length === 0) {
    return (
      <label className="block text-sm">
        <FieldLabel hint={hint}>{label}</FieldLabel>
        <div className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-900">
          You don't have any shop sections yet. Create one on <a className="underline" href="/vendor/sections" target="_blank" rel="noreferrer">Sections</a> to enable this picker.
        </div>
      </label>
    );
  }
  return (
    <label className="block text-sm">
      <FieldLabel hint={hint}>{label}</FieldLabel>
      <select
        className="input-field w-full"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">— None —</option>
        {sections.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>
    </label>
  );
}
