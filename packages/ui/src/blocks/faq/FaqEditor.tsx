'use client';
import type { FaqSettings, FaqItem } from './Faq';

export function FaqEditor({
  settings: s,
  onChange,
}: {
  settings: FaqSettings;
  onChange: (next: FaqSettings) => void;
  ctx: any;
}) {
  function update(i: number, patch: Partial<FaqItem>) {
    onChange({ ...s, items: s.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) });
  }
  function add() {
    if (s.items.length >= 20) return;
    onChange({ ...s, items: [...s.items, { question: '', answer: '' }] });
  }
  function remove(i: number) {
    onChange({ ...s, items: s.items.filter((_, idx) => idx !== i) });
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= s.items.length) return;
    const copy = s.items.slice();
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
    onChange({ ...s, items: copy });
  }

  return (
    <div className="space-y-3">
      <Field label="Heading">
        <input className="input-field" value={s.heading} maxLength={200} onChange={(e) => onChange({ ...s, heading: e.target.value })} />
      </Field>
      <div className="space-y-2">
        {s.items.map((it, i) => (
          <div key={i} className="border border-line rounded-md p-3 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-medium">Q{i + 1}</span>
              <span className="space-x-2">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="text-ink-500 disabled:opacity-30">↑</button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === s.items.length - 1} className="text-ink-500 disabled:opacity-30">↓</button>
                <button type="button" onClick={() => remove(i)} className="text-red-500">×</button>
              </span>
            </div>
            <input className="input-field" placeholder="Question" value={it.question} maxLength={200} onChange={(e) => update(i, { question: e.target.value })} />
            <textarea className="input-field" rows={3} placeholder="Answer" value={it.answer} maxLength={2000} onChange={(e) => update(i, { answer: e.target.value })} />
          </div>
        ))}
      </div>
      <button type="button" className="btn-secondary text-xs" onClick={add} disabled={s.items.length >= 20}>
        + Add question
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
