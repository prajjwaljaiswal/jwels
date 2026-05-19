'use client';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { StepHeader, StepProps, Field, ComingSoonBadge } from '../StepShell';
import { WhenMade, JewelleryType } from '../types';

interface Category {
  id: string; name: string; slug: string; description?: string;
  parentId?: string | null;
  imageUrl?: string | null;
}

const JEWELLERY_TYPES: { value: Exclude<JewelleryType, ''>; label: string; hint: string }[] = [
  { value: 'FINE',        label: 'Fine',         hint: 'Real gold/silver/platinum, real stones, hallmarked' },
  { value: 'DEMI_FINE',   label: 'Demi-fine',    hint: 'Gold-plated sterling silver, lab-grown stones' },
  { value: 'FASHION',     label: 'Fashion',      hint: 'Brass/alloy/plated, CZ/glass/resin — artificial' },
  { value: 'HANDCRAFTED', label: 'Handcrafted',  hint: 'Beads, thread, terracotta, wood, oxidised' },
];

const WHEN_MADE: { value: WhenMade; label: string }[] = [
  { value: 'made_to_order',   label: 'Made to order' },
  { value: '2020s',           label: '2020 — 2026' },
  { value: '2010s',           label: '2010 — 2019' },
  { value: '2000s',           label: '2000 — 2009' },
  { value: 'before_2000',     label: 'Before 2000' },
  { value: 'vintage',         label: 'Vintage (20+ years old)' },
];

export function CategoryStep({ draft, setDraft }: StepProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [q, setQ] = useState('');
  const [openParentId, setOpenParentId] = useState<string | null>(null);

  useEffect(() => {
    api<Category[]>('/api/categories', { auth: false }).then(setCategories).catch(() => {});
  }, []);

  const roots = useMemo(() => categories.filter((c) => !c.parentId), [categories]);
  const childrenByParent = useMemo(() => {
    const m = new Map<string, Category[]>();
    for (const c of categories) if (c.parentId) {
      const arr = m.get(c.parentId) ?? [];
      arr.push(c); m.set(c.parentId, arr);
    }
    return m;
  }, [categories]);

  // Search hits both levels and returns a breadcrumb label for children.
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return roots.slice(0, 8);
    return categories
      .filter((c) => c.name.toLowerCase().includes(t))
      .slice(0, 16);
  }, [categories, roots, q]);

  const labelFor = (c: Category) => {
    if (!c.parentId) return c.name;
    const p = categories.find((x) => x.id === c.parentId);
    return p ? `${p.name} › ${c.name}` : c.name;
  };

  const selected = categories.find((c) => c.id === draft.categoryId);
  const selectedLabel = selected ? labelFor(selected) : '';

  return (
    <>
      <StepHeader
        title="Category"
        subtitle="Pick the closest match — buyers find your item by browsing categories."
      />
      <div className="p-6 space-y-6">
        <Field label="Find a category" required>
          <input
            className="input-field h-12 text-sm"
            placeholder="Examples: Engagement Rings, Choker, Anklet"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </Field>

        {selected && !q && (
          <div className="rounded-md border border-brand-200 bg-brand-50 p-4 flex items-center gap-3">
            <span className="h-8 w-8 rounded-full bg-brand-600 text-white flex items-center justify-center text-xs font-bold">✓</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink-900">{selectedLabel}</p>
              {selected.description && <p className="text-xs text-ink-700 truncate">{selected.description}</p>}
            </div>
            <button type="button" onClick={() => { setDraft({ categoryId: '' }); setOpenParentId(null); }}
              className="text-xs font-semibold text-brand-700 hover:text-brand-800">Change</button>
          </div>
        )}

        {q && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-700 mb-2">Matches</p>
            <div className="space-y-2">
              {filtered.length === 0 && <p className="text-sm text-ink-500 italic">No matches.</p>}
              {filtered.map((c) => {
                const active = c.id === draft.categoryId;
                return (
                  <button key={c.id} type="button"
                    onClick={() => { setDraft({ categoryId: c.id }); setQ(''); setOpenParentId(c.parentId || null); }}
                    className={[
                      'w-full text-left rounded-md border p-3 transition',
                      active
                        ? 'border-brand-600 bg-brand-50 ring-1 ring-brand-600'
                        : 'border-line bg-surface hover:border-ink-300',
                    ].join(' ')}
                  >
                    <p className="text-sm font-semibold text-ink-900">{labelFor(c)}</p>
                    {c.description && <p className="text-xs text-ink-500 mt-0.5">{c.description}</p>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {!q && !selected && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-700 mb-2">Pick a category, then a subcategory</p>
            <div className="space-y-2">
              {roots.map((root) => {
                const kids = childrenByParent.get(root.id) ?? [];
                const isOpen = openParentId === root.id;
                return (
                  <div key={root.id} className="rounded-md border border-line bg-surface overflow-hidden">
                    <button type="button"
                      onClick={() => setOpenParentId(isOpen ? null : root.id)}
                      className="w-full flex items-center gap-3 p-3 hover:bg-canvas/50 transition text-left">
                      {root.imageUrl ? (
                        <img src={root.imageUrl} alt="" className="h-10 w-10 rounded-md object-cover border border-line" />
                      ) : (
                        <div className="h-10 w-10 rounded-md bg-canvas border border-line" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-ink-900">{root.name}</p>
                        <p className="text-xs text-ink-500">{kids.length} subcategor{kids.length === 1 ? 'y' : 'ies'}</p>
                      </div>
                      <span className={`text-ink-500 transition-transform ${isOpen ? 'rotate-90' : ''}`}>▶</span>
                    </button>
                    {isOpen && (
                      <div className="border-t border-line p-3 flex flex-wrap gap-2 bg-canvas/30">
                        {kids.length === 0 ? (
                          <button type="button"
                            onClick={() => setDraft({ categoryId: root.id })}
                            className="text-xs rounded-pill px-3 py-1.5 border border-brand-600 bg-brand-50 text-brand-700 font-semibold">
                            Use "{root.name}" directly
                          </button>
                        ) : (
                          <>
                            <button type="button"
                              onClick={() => setDraft({ categoryId: root.id })}
                              className={[
                                'text-xs rounded-pill px-3 py-1.5 border transition',
                                draft.categoryId === root.id
                                  ? 'border-brand-600 bg-brand-50 text-brand-700 font-semibold'
                                  : 'border-line bg-surface text-ink-700 hover:border-ink-300',
                              ].join(' ')}>
                              All {root.name}
                            </button>
                            {kids.map((kid) => {
                              const active = draft.categoryId === kid.id;
                              return (
                                <button key={kid.id} type="button"
                                  onClick={() => setDraft({ categoryId: kid.id })}
                                  className={[
                                    'text-xs rounded-pill px-3 py-1.5 border transition',
                                    active
                                      ? 'border-brand-600 bg-brand-50 text-brand-700 font-semibold'
                                      : 'border-line bg-surface text-ink-700 hover:border-ink-300',
                                  ].join(' ')}>
                                  {kid.name}
                                </button>
                              );
                            })}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="border-t border-line pt-6">
          <p className="text-sm font-semibold text-ink-900 mb-2">What type of item is it? <span className="text-danger">*</span></p>
          <div className="grid sm:grid-cols-2 gap-3">
            <button type="button"
              className="rounded-md border-2 border-brand-600 ring-1 ring-brand-600 bg-brand-50 p-4 text-left">
              <div className="h-10 w-10 rounded-md bg-white border border-line flex items-center justify-center text-brand-600 mb-2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="M3 8l9 5 9-5"/></svg>
              </div>
              <p className="text-sm font-semibold text-ink-900">Physical item</p>
              <p className="text-xs text-ink-500 mt-0.5">A tangible item that you will ship to buyers.</p>
            </button>
            <button type="button" disabled
              className="rounded-md border border-line bg-surface p-4 text-left opacity-60 cursor-not-allowed">
              <div className="h-10 w-10 rounded-md bg-canvas border border-line flex items-center justify-center text-ink-500 mb-2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
              </div>
              <p className="text-sm font-semibold text-ink-900 inline-flex items-center">Digital files <ComingSoonBadge /></p>
              <p className="text-xs text-ink-500 mt-0.5">A digital file that buyers will download.</p>
            </button>
          </div>
        </div>

        <div className="border-t border-line pt-6">
          <p className="text-sm font-semibold text-ink-900 mb-1">Jewellery type <span className="text-danger">*</span></p>
          <p className="text-xs text-ink-500 mb-3">Tells buyers what they're getting and decides which compliance fields show next.</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {JEWELLERY_TYPES.map((t) => {
              const active = draft.jewelleryType === t.value;
              return (
                <button key={t.value} type="button"
                  onClick={() => setDraft({ jewelleryType: t.value })}
                  className={[
                    'rounded-md border-2 p-4 text-left transition',
                    active
                      ? 'border-brand-600 ring-1 ring-brand-600 bg-brand-50'
                      : 'border-line bg-surface hover:border-ink-300',
                  ].join(' ')}
                >
                  <p className="text-sm font-semibold text-ink-900">{t.label}</p>
                  <p className="text-xs text-ink-500 mt-0.5">{t.hint}</p>
                </button>
              );
            })}
          </div>
        </div>

        <Field label="When was it made?" required hint="Helps shoppers filter by era">
          <select className="input-field" value={draft.whenMade}
            onChange={(e) => setDraft({ whenMade: e.target.value as WhenMade })}>
            <option value="">When was it made?</option>
            {WHEN_MADE.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
          </select>
        </Field>
      </div>
    </>
  );
}
