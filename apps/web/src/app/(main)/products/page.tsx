'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { ProductCard, type ProductCardData } from '@/components/storefront/ProductCard';
import { SearchExperience } from '@/components/search/SearchExperience';
import { useCurrency, CURRENCIES } from '@/lib/currency';

const ALGOLIA_READY =
  !!process.env.NEXT_PUBLIC_ALGOLIA_APP_ID && !!process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY;

interface Category { id: string; name: string; slug: string; parentId?: string | null; }

const METALS = ['Gold', 'Silver', 'Diamond', 'Gemstone', 'Platinum'];
const SORTS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'top_rated', label: 'Top reviewed' },
];

export default function ProductsPage() {
  if (ALGOLIA_READY) return <SearchExperience />;
  return <LegacyProductsPage />;
}

interface CategoryAttribute {
  id: string;
  name: string;
  inputType: 'SELECT' | 'TEXT' | 'NUMBER';
  options: { id: string; value: string }[];
}

function LegacyProductsPage() {
  const { code } = useCurrency();
  const currencySymbol = CURRENCIES[code].symbol;
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<ProductCardData[]>([]);
  const [category, setCategory] = useState('');
  const [metals, setMetals] = useState<string[]>([]);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minRating, setMinRating] = useState(0);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('relevance');
  const [loading, setLoading] = useState(true);
  const [catAttributes, setCatAttributes] = useState<CategoryAttribute[]>([]);
  // attrName -> Set of selected option values
  const [attrFilters, setAttrFilters] = useState<Record<string, string[]>>({});

  useEffect(() => {
    api<Category[]>('/api/categories', { auth: false }).then(setCategories).catch(() => setCategories([]));
  }, []);

  // When the chosen category changes, refresh its attributes and clear stale picks.
  useEffect(() => {
    if (!category) { setCatAttributes([]); setAttrFilters({}); return; }
    api<CategoryAttribute[]>(`/api/categories/${category}/attributes?includeAncestors=1`, { auth: false })
      .then((rows) => setCatAttributes(rows.filter((r) => r.inputType === 'SELECT' && r.options.length > 0)))
      .catch(() => setCatAttributes([]));
    setAttrFilters({});
  }, [category]);

  function toggleAttrValue(name: string, value: string) {
    setAttrFilters((prev) => {
      const cur = prev[name] ?? [];
      const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
      const out = { ...prev };
      if (next.length === 0) delete out[name];
      else out[name] = next;
      return out;
    });
  }

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category) params.set('category', category);
      if (q) params.set('q', q);
      for (const [name, values] of Object.entries(attrFilters)) {
        if (values.length > 0) params.append('attr', `${name}:${values.join(',')}`);
      }
      const data = await api<{ items: any[] }>(`/api/products?${params}`, { auth: false });
      setItems(data.items ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [category, attrFilters]);

  function toggleMetal(m: string) {
    setMetals((arr) => (arr.includes(m) ? arr.filter((x) => x !== m) : [...arr, m]));
  }

  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; clear: () => void }[] = [];
    if (category) {
      const c = categories.find((x) => x.id === category);
      if (c) chips.push({ key: 'cat', label: c.name, clear: () => setCategory('') });
    }
    metals.forEach((m) =>
      chips.push({ key: `m-${m}`, label: m, clear: () => toggleMetal(m) })
    );
    if (minPrice || maxPrice) {
      chips.push({
        key: 'price',
        label: `${currencySymbol}${minPrice || 0} – ${currencySymbol}${maxPrice || '∞'}`,
        clear: () => { setMinPrice(''); setMaxPrice(''); },
      });
    }
    if (minRating) chips.push({ key: 'rating', label: `${minRating}★ & up`, clear: () => setMinRating(0) });
    for (const [name, values] of Object.entries(attrFilters)) {
      for (const v of values) {
        chips.push({
          key: `attr-${name}-${v}`,
          label: `${name}: ${v}`,
          clear: () => toggleAttrValue(name, v),
        });
      }
    }
    return chips;
  }, [category, metals, minPrice, maxPrice, minRating, categories, attrFilters]);

  const filtered = useMemo(() => {
    return items.filter((p) => {
      const price = Number(p.price);
      if (minPrice && price < Number(minPrice)) return false;
      if (maxPrice && price > Number(maxPrice)) return false;
      if (minRating && (p.rating ?? 0) < minRating) return false;
      return true;
    });
  }, [items, minPrice, maxPrice, minRating]);

  return (
    <div className="max-w-container mx-auto px-6 py-8">
      <nav className="text-xs text-ink-500 mb-4">
        <Link href="/" className="hover:text-brand-700">Home</Link>
        <span className="mx-1.5">/</span>
        <span className="text-ink-900">All jewelry</span>
      </nav>

      <div className="grid lg:grid-cols-[240px_1fr] gap-8">
        {/* FILTER RAIL */}
        <aside className="space-y-6">
          <FilterSection title="Category" defaultOpen>
            <CategoryTreeFilter
              categories={categories}
              selected={category}
              onChange={setCategory}
            />
          </FilterSection>

          <FilterSection title="Material" defaultOpen>
            <div className="space-y-1.5">
              {METALS.map((m) => (
                <label key={m} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={metals.includes(m)} onChange={() => toggleMetal(m)} />
                  <span>{m}</span>
                </label>
              ))}
            </div>
          </FilterSection>

          <FilterSection title={`Price (${currencySymbol})`}>
            <div className="flex items-center gap-2">
              <input
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value.replace(/\D/g, ''))}
                placeholder="Min"
                className="input-field h-9 text-sm"
              />
              <span className="text-ink-500">–</span>
              <input
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value.replace(/\D/g, ''))}
                placeholder="Max"
                className="input-field h-9 text-sm"
              />
            </div>
          </FilterSection>

          <FilterSection title="Rating">
            <div className="space-y-1.5">
              {[4, 3, 2, 0].map((r) => (
                <label key={r} className="flex items-center gap-2 text-sm">
                  <input type="radio" name="rating" checked={minRating === r} onChange={() => setMinRating(r)} />
                  <span>{r === 0 ? 'Any' : `${r}★ & up`}</span>
                </label>
              ))}
            </div>
          </FilterSection>

          {catAttributes.map((attr) => (
            <FilterSection key={attr.id} title={attr.name}>
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {attr.options.map((opt) => {
                  const checked = (attrFilters[attr.name] ?? []).includes(opt.value);
                  return (
                    <label key={opt.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={checked}
                        onChange={() => toggleAttrValue(attr.name, opt.value)} />
                      <span>{opt.value}</span>
                    </label>
                  );
                })}
              </div>
            </FilterSection>
          ))}
        </aside>

        {/* RESULTS */}
        <section>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div>
              <h1 className="font-display text-2xl md:text-3xl text-ink-900">
                {category ? categories.find((c) => c.id === category)?.name ?? 'Products' : 'All jewelry'}
              </h1>
              <p className="text-sm text-ink-500 mt-0.5">
                {loading ? 'Loading…' : `${filtered.length} result${filtered.length === 1 ? '' : 's'}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && load()}
                placeholder="Search in results"
                className="input-field h-10 text-sm w-56"
              />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="input-field h-10 text-sm w-48"
              >
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>Sort: {s.label}</option>
                ))}
              </select>
            </div>
          </div>

          {activeChips.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-5">
              {activeChips.map((c) => (
                <button
                  key={c.key}
                  onClick={c.clear}
                  className="chip hover:border-ink-900"
                >
                  {c.label}
                  <span className="text-ink-500">×</span>
                </button>
              ))}
              <button
                onClick={() => { setCategory(''); setMetals([]); setMinPrice(''); setMaxPrice(''); setMinRating(0); }}
                className="text-xs text-brand-700 underline underline-offset-4 px-2"
              >
                Clear all
              </button>
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="rounded-md">
                  <div className="aspect-square bg-stone-100 animate-pulse rounded-md" />
                  <div className="h-3 mt-3 bg-stone-100 rounded animate-pulse" />
                  <div className="h-3 mt-2 w-2/3 bg-stone-100 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 bg-surface rounded-md border border-line">
              <p className="text-ink-700 mb-2">No products match your filters.</p>
              <button
                onClick={() => { setCategory(''); setMetals([]); setMinPrice(''); setMaxPrice(''); setMinRating(0); }}
                className="btn-ghost text-sm"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
              {filtered.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function CategoryTreeFilter({ categories, selected, onChange }: {
  categories: Category[]; selected: string; onChange: (v: string) => void;
}) {
  const roots = useMemo(() => categories.filter((c) => !c.parentId), [categories]);
  const childrenByParent = useMemo(() => {
    const m = new Map<string, Category[]>();
    for (const c of categories) if (c.parentId) {
      const arr = m.get(c.parentId) ?? [];
      arr.push(c); m.set(c.parentId, arr);
    }
    return m;
  }, [categories]);

  const selectedParent = useMemo(() => {
    const sel = categories.find((c) => c.id === selected);
    return sel?.parentId ?? sel?.id ?? null;
  }, [categories, selected]);

  const [openId, setOpenId] = useState<string | null>(null);
  useEffect(() => { if (selectedParent) setOpenId(selectedParent); }, [selectedParent]);

  return (
    <div className="space-y-1">
      <label className="flex items-center gap-2 text-sm">
        <input type="radio" name="cat" checked={selected === ''} onChange={() => onChange('')} />
        <span>All</span>
      </label>
      {roots.map((root) => {
        const kids = childrenByParent.get(root.id) ?? [];
        const isOpen = openId === root.id;
        const active = selected === root.id;
        return (
          <div key={root.id}>
            <div className="flex items-center gap-1.5 text-sm">
              <button onClick={() => setOpenId(isOpen ? null : root.id)}
                className="h-5 w-5 flex items-center justify-center text-ink-500 hover:text-ink-900"
                aria-label={isOpen ? 'Collapse' : 'Expand'}>
                {kids.length > 0 ? <span className={`transition-transform ${isOpen ? 'rotate-90' : ''}`}>▶</span> : <span className="opacity-0">▶</span>}
              </button>
              <label className="flex items-center gap-2 flex-1 cursor-pointer">
                <input type="radio" name="cat" checked={active} onChange={() => onChange(root.id)} />
                <span className={active ? 'font-semibold text-ink-900' : ''}>{root.name}</span>
              </label>
            </div>
            {isOpen && kids.length > 0 && (
              <div className="ml-7 mt-1 mb-2 space-y-1">
                {kids.map((kid) => (
                  <label key={kid.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="radio" name="cat" checked={selected === kid.id} onChange={() => onChange(kid.id)} />
                    <span className={selected === kid.id ? 'font-semibold text-ink-900' : 'text-ink-700'}>{kid.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function FilterSection({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean; }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-line pb-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between py-1 text-sm font-semibold text-ink-900"
      >
        {title}
        <span className="text-ink-500">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}
