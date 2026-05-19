'use client';
import { useEffect, useMemo, useState } from 'react';
import { StepHeader, StepProps, Field } from '../StepShell';
import { useCurrency, CURRENCIES } from '@/lib/currency';
import { DraftCombo, DraftVariation } from '../types';

const MAX_TAGS = 13;
const MAX_VARIATIONS = 3;
const MAX_OPTIONS_PER_VARIATION = 10;
const COMBO_SOFT_CAP = 100;

const tempId = () => `t_${Math.random().toString(36).slice(2, 10)}`;

// Cartesian product of one option from each variation, in order. Returns arrays
// of optionTempIds; we re-key combos by joining the array.
function cartesian(vars: DraftVariation[]): string[][] {
  const usable = vars.filter((v) => v.options.some((o) => o.value.trim()));
  if (usable.length === 0) return [];
  return usable.reduce<string[][]>((acc, v) => {
    const opts = v.options.filter((o) => o.value.trim());
    if (acc.length === 0) return opts.map((o) => [o.tempId]);
    return acc.flatMap((row) => opts.map((o) => [...row, o.tempId]));
  }, []);
}

export function OptionsStep({ draft, setDraft }: StepProps) {
  const { code } = useCurrency();
  const currencySymbol = CURRENCIES[code].symbol;
  const [tagInput, setTagInput] = useState('');

  function addTag() {
    const t = tagInput.trim().toLowerCase();
    if (!t) return;
    if (draft.tags.includes(t)) { setTagInput(''); return; }
    if (draft.tags.length >= MAX_TAGS) return;
    setDraft({ tags: [...draft.tags, t] });
    setTagInput('');
  }
  function removeTag(t: string) { setDraft({ tags: draft.tags.filter((x) => x !== t) }); }

  // Re-sync combos to the cartesian product of current variations whenever
  // variations change. Preserves price/stock/sku for combos that still exist.
  const expectedCombos = useMemo(() => cartesian(draft.variations), [draft.variations]);

  useEffect(() => {
    const expectedKeys = expectedCombos.map((ids) => ids.join('|'));
    const existingByKey = new Map(draft.combos.map((c) => [c.optionTempIds.join('|'), c]));
    const next: DraftCombo[] = expectedCombos.map((ids) => {
      const existing = existingByKey.get(ids.join('|'));
      return existing ?? { optionTempIds: ids, price: '', stock: String(draft.stockQuantity || '0'), sku: '' };
    });
    // Only update if something changed (avoid render loop)
    const same = next.length === draft.combos.length
      && next.every((c, i) => c.optionTempIds.join('|') === draft.combos[i].optionTempIds.join('|')
        && c.price === draft.combos[i].price
        && c.stock === draft.combos[i].stock
        && c.sku   === draft.combos[i].sku);
    if (!same) setDraft({ combos: next });
    // expectedCombos depends on draft.variations; we intentionally exclude draft.combos
    // from deps to avoid re-running after we update them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expectedCombos.map((r) => r.join('|')).join(',')]);

  function addVariation() {
    if (draft.variations.length >= MAX_VARIATIONS) return;
    setDraft({
      variations: [...draft.variations, {
        tempId: tempId(),
        name: '',
        options: [{ tempId: tempId(), value: '' }, { tempId: tempId(), value: '' }],
      }],
    });
  }
  function removeVariation(vIdx: number) {
    setDraft({ variations: draft.variations.filter((_, i) => i !== vIdx) });
  }
  function updateVariation(vIdx: number, patch: Partial<DraftVariation>) {
    setDraft({ variations: draft.variations.map((v, i) => i === vIdx ? { ...v, ...patch } : v) });
  }
  function addOption(vIdx: number) {
    const v = draft.variations[vIdx];
    if (v.options.length >= MAX_OPTIONS_PER_VARIATION) return;
    updateVariation(vIdx, { options: [...v.options, { tempId: tempId(), value: '' }] });
  }
  function removeOption(vIdx: number, oIdx: number) {
    const v = draft.variations[vIdx];
    if (v.options.length <= 1) return;
    updateVariation(vIdx, { options: v.options.filter((_, i) => i !== oIdx) });
  }
  function updateOption(vIdx: number, oIdx: number, value: string) {
    const v = draft.variations[vIdx];
    updateVariation(vIdx, { options: v.options.map((o, i) => i === oIdx ? { ...o, value } : o) });
  }
  function updateCombo(idx: number, patch: Partial<DraftCombo>) {
    setDraft({ combos: draft.combos.map((c, i) => i === idx ? { ...c, ...patch } : c) });
  }

  // Lookups for rendering combo rows
  const optionLabel = (tid: string) => {
    for (const v of draft.variations) {
      const o = v.options.find((x) => x.tempId === tid);
      if (o) return { variation: v.name || 'Variation', value: o.value || '—' };
    }
    return { variation: 'Variation', value: '—' };
  };

  return (
    <>
      <StepHeader
        title="Item options"
        subtitle="Share any standard options or special personalization choices available for this item."
      />
      <div className="p-6 space-y-6">

        {/* ── Variations ────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-ink-900">Variations</p>
              <p className="text-xs text-ink-500 mt-0.5">Offer different sizes, metals, or styles with their own price and stock.</p>
            </div>
            {draft.variations.length < MAX_VARIATIONS && (
              <button type="button" onClick={addVariation}
                className="text-sm font-semibold px-3.5 h-9 rounded-pill bg-ink-900 text-white hover:bg-ink-800">
                + Add variation
              </button>
            )}
          </div>

          {draft.variations.length === 0 && (
            <div className="rounded-md border-2 border-dashed border-line p-6 text-center">
              <p className="text-sm text-ink-700">No variations yet</p>
              <p className="text-xs text-ink-500 mt-1">Add a variation like "Size" or "Metal" to give buyers options.</p>
            </div>
          )}

          <div className="space-y-4">
            {draft.variations.map((v, vIdx) => (
              <div key={v.tempId} className="border border-line rounded-lg bg-canvas">
                <div className="flex items-center gap-2 p-3 border-b border-line">
                  <span className="h-6 w-6 rounded-full bg-brand-50 text-brand-700 text-xs font-bold flex items-center justify-center shrink-0">
                    {vIdx + 1}
                  </span>
                  <input className="input-field flex-1" placeholder="Variation name (e.g. Size, Metal)"
                    value={v.name} onChange={(e) => updateVariation(vIdx, { name: e.target.value })} maxLength={40} />
                  <button type="button" onClick={() => removeVariation(vIdx)}
                    className="h-8 w-8 rounded-md hover:bg-red-50 hover:text-danger flex items-center justify-center text-ink-500 shrink-0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                  </button>
                </div>
                <div className="p-3 space-y-2">
                  <p className="text-[11px] uppercase tracking-wide font-semibold text-ink-500">Options</p>
                  {v.options.map((o, oIdx) => (
                    <div key={o.tempId} className="flex gap-2">
                      <input className="input-field flex-1" placeholder={`Option ${oIdx + 1}`}
                        value={o.value} maxLength={60}
                        onChange={(e) => updateOption(vIdx, oIdx, e.target.value)} />
                      <button type="button" onClick={() => removeOption(vIdx, oIdx)}
                        disabled={v.options.length <= 1}
                        className="h-9 w-9 rounded-md hover:bg-red-50 hover:text-danger flex items-center justify-center text-ink-500 disabled:opacity-30 disabled:cursor-not-allowed">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                      </button>
                    </div>
                  ))}
                  {v.options.length < MAX_OPTIONS_PER_VARIATION && (
                    <button type="button" onClick={() => addOption(vIdx)}
                      className="text-xs font-semibold text-brand-700 hover:text-brand-800 inline-flex items-center gap-1">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
                      Add option
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Combo grid */}
          {draft.combos.length > 0 && (
            <div className="mt-5">
              <p className="text-sm font-semibold text-ink-900 mb-2">Per-variation pricing & stock</p>
              <p className="text-xs text-ink-500 mb-3">Override price for this combo, or leave blank to use the default. Stock is per combo.</p>
              {draft.combos.length > COMBO_SOFT_CAP && (
                <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  <strong>{draft.combos.length} combinations.</strong> That's a lot to manage — consider splitting into separate listings (e.g. one per metal) for a cleaner buyer experience.
                </div>
              )}
              <div className="border border-line rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-canvas">
                    <tr className="text-[11px] uppercase tracking-wide text-ink-500">
                      <th className="text-left px-3 py-2 font-semibold">Combination</th>
                      <th className="text-left px-3 py-2 font-semibold w-32">Price ({currencySymbol})</th>
                      <th className="text-left px-3 py-2 font-semibold w-24">Stock</th>
                      <th className="text-left px-3 py-2 font-semibold w-32">SKU</th>
                    </tr>
                  </thead>
                  <tbody>
                    {draft.combos.map((c, idx) => (
                      <tr key={c.optionTempIds.join('|')} className="border-t border-line">
                        <td className="px-3 py-2 align-top">
                          <div className="flex flex-wrap gap-1.5">
                            {c.optionTempIds.map((tid) => {
                              const lbl = optionLabel(tid);
                              return (
                                <span key={tid} className="text-[11px] bg-canvas border border-line rounded-pill px-2 py-0.5 text-ink-700">
                                  <span className="text-ink-500">{lbl.variation}:</span> {lbl.value}
                                </span>
                              );
                            })}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" min="0" step="0.01" className="input-field !h-8 !text-sm"
                            placeholder="default"
                            value={c.price} onChange={(e) => updateCombo(idx, { price: e.target.value })} />
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" min="0" className="input-field !h-8 !text-sm"
                            value={c.stock} onChange={(e) => updateCombo(idx, { stock: e.target.value })} />
                        </td>
                        <td className="px-3 py-2">
                          <input className="input-field !h-8 !text-sm" placeholder="—"
                            value={c.sku} onChange={(e) => updateCombo(idx, { sku: e.target.value })} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {/* ── Personalization ────────────────────────────────── */}
        <div className="rounded-md border border-line">
          <div className="p-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink-900">Personalization</p>
              <p className="text-xs text-ink-500 mt-1">Make it easier for buyers to add the info you need to personalize their item.</p>
            </div>
            <button type="button"
              onClick={() => setDraft({ personalization: { ...draft.personalization, enabled: !draft.personalization.enabled } })}
              className="shrink-0 mt-0.5">
              <span className={`block h-6 w-11 rounded-full transition-colors relative ${draft.personalization.enabled ? 'bg-brand-600' : 'bg-ink-300'}`}>
                <span className={`absolute top-0.5 h-5 w-5 bg-white rounded-full shadow transition-transform ${draft.personalization.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </span>
            </button>
          </div>
          {draft.personalization.enabled && (
            <div className="p-4 border-t border-line space-y-3 bg-canvas/30">
              <Field label="Instructions for buyers" hint={`${draft.personalization.instructions.length}/256`}>
                <textarea className="input-field min-h-[70px] resize-y" maxLength={256}
                  placeholder="What info do you need? e.g. Name to engrave, ring size in inches"
                  value={draft.personalization.instructions}
                  onChange={(e) => setDraft({ personalization: { ...draft.personalization, instructions: e.target.value } })} />
              </Field>
              <Field label="Character limit">
                <input type="number" className="input-field max-w-[8rem]" min={1} max={1024}
                  value={draft.personalization.charLimit}
                  onChange={(e) => setDraft({ personalization: { ...draft.personalization, charLimit: Number(e.target.value) || 256 } })} />
              </Field>
              <p className="text-[11px] text-ink-500">Buyers will see this prompt on the storefront and can submit their custom request with the order.</p>
            </div>
          )}
        </div>

        {/* ── Tags ───────────────────────────────────────────── */}
        <div>
          <p className="text-sm font-semibold text-ink-900">Tags</p>
          <p className="text-xs text-ink-500 mt-0.5 mb-3">Add up to {MAX_TAGS} tags to help people search for your listings.</p>

          <div className="flex gap-2">
            <input
              className="input-field flex-1"
              placeholder="Shape, color, style, function, etc."
              value={tagInput}
              maxLength={20}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
              disabled={draft.tags.length >= MAX_TAGS}
            />
            <button type="button" onClick={addTag}
              disabled={!tagInput.trim() || draft.tags.length >= MAX_TAGS}
              className="px-4 h-10 rounded-pill bg-ink-900 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed">
              Add
            </button>
          </div>
          <p className="text-[11px] text-ink-500 mt-2">{MAX_TAGS - draft.tags.length} left</p>

          {draft.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {draft.tags.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 rounded-pill bg-canvas border border-line px-3 py-1 text-sm text-ink-700">
                  {t}
                  <button type="button" onClick={() => removeTag(t)} className="ml-0.5 text-ink-500 hover:text-danger">×</button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
