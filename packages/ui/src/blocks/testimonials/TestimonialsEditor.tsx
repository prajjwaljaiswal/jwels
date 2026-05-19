'use client';
import type { TestimonialsSettings, TestimonialItem } from './Testimonials';
import { ImageField } from '@/components/blocks/system/formPrimitives';

export function TestimonialsEditor({
  settings: s,
  onChange,
}: {
  settings: TestimonialsSettings;
  onChange: (next: TestimonialsSettings) => void;
  ctx: any;
}) {
  function update(idx: number, patch: Partial<TestimonialItem>) {
    onChange({ ...s, items: s.items.map((t, i) => (i === idx ? { ...t, ...patch } : t)) });
  }
  function add() {
    if (s.items.length >= 12) return;
    onChange({ ...s, items: [...s.items, { quote: '', author: '', rating: 5 }] });
  }
  function remove(idx: number) {
    onChange({ ...s, items: s.items.filter((_, i) => i !== idx) });
  }
  function move(idx: number, dir: -1 | 1) {
    const j = idx + dir;
    if (j < 0 || j >= s.items.length) return;
    const copy = s.items.slice();
    [copy[idx], copy[j]] = [copy[j]!, copy[idx]!];
    onChange({ ...s, items: copy });
  }

  return (
    <div className="space-y-3">
      <Field label="Heading">
        <input className="input-field" value={s.heading} maxLength={200} onChange={(e) => onChange({ ...s, heading: e.target.value })} />
      </Field>
      <div className="space-y-3">
        {s.items.map((t, i) => (
          <div key={i} className="border border-line rounded-md p-3 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-medium">Testimonial {i + 1}</span>
              <span className="space-x-2">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="text-ink-500 disabled:opacity-30">↑</button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === s.items.length - 1} className="text-ink-500 disabled:opacity-30">↓</button>
                <button type="button" onClick={() => remove(i)} className="text-red-500">×</button>
              </span>
            </div>
            <textarea className="input-field" rows={2} placeholder="Quote" value={t.quote} maxLength={500} onChange={(e) => update(i, { quote: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <input className="input-field" placeholder="Author" value={t.author} maxLength={80} onChange={(e) => update(i, { author: e.target.value })} />
              <select
                className="input-field"
                value={t.rating ?? ''}
                onChange={(e) => update(i, { rating: e.target.value ? Number(e.target.value) : undefined })}
              >
                <option value="">No rating</option>
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>{n} star{n !== 1 ? 's' : ''}</option>
                ))}
              </select>
            </div>
            <ImageField label="Avatar (optional)" value={t.avatarUrl ?? ''} onChange={(url) => update(i, { avatarUrl: url })} />
          </div>
        ))}
      </div>
      <button type="button" className="btn-secondary text-xs" onClick={add} disabled={s.items.length >= 12}>
        + Add testimonial
      </button>
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
