'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { algoliasearch, type SearchClient } from 'algoliasearch';
import { useCurrency, formatPrice } from '@/lib/currency';

const APP_ID = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID || '';
const SEARCH_KEY = process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY || '';
const INDEX = process.env.NEXT_PUBLIC_ALGOLIA_INDEX || 'jewel_products';

interface Hit {
  objectID: string;
  name: string;
  image: string | null;
  price: number;
  vendorName: string;
}

const RECENT_KEY = 'recentSearches';
const MAX_RECENT = 6;

function getRecent(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function pushRecent(q: string) {
  const trimmed = q.trim();
  if (!trimmed) return;
  const next = [trimmed, ...getRecent().filter((x) => x !== trimmed)].slice(0, MAX_RECENT);
  try { window.localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch {}
}

interface Props {
  className?: string;
  /** When set, restrict suggestions + results to this vendor and route into the storefront. */
  vendorId?: string;
  /** Override placeholder text. */
  placeholder?: string;
}

export function SearchAutosuggest({ className, vendorId, placeholder }: Props) {
  const { code } = useCurrency();
  const router = useRouter();
  const enabled = !!APP_ID && !!SEARCH_KEY;
  const client: SearchClient | null = useMemo(
    () => (enabled ? algoliasearch(APP_ID, SEARCH_KEY) : null),
    [enabled],
  );

  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setRecent(getRecent());
  }, [open]);

  useEffect(() => {
    if (!enabled || !client) return;
    const value = q.trim();
    if (!value) { setHits([]); return; }
    const id = setTimeout(async () => {
      try {
        const { results } = await client.search<Hit>({
          requests: [{
            indexName: INDEX,
            query: value,
            hitsPerPage: 6,
            ...(vendorId ? { filters: `vendorId:"${vendorId}"` } : {}),
          }],
        });
        const first = results[0] as { hits: Hit[] };
        setHits(first.hits ?? []);
      } catch {
        setHits([]);
      }
    }, 120);
    return () => clearTimeout(id);
  }, [q, client, enabled, vendorId]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, []);

  function submit(query: string) {
    const value = query.trim();
    if (!value) return;
    pushRecent(value);
    setOpen(false);
    const base = vendorId ? `/store/${vendorId}/products` : '/products';
    router.push(`${base}?products%5Bquery%5D=${encodeURIComponent(value)}`);
  }

  function hitHref(objectID: string) {
    return vendorId ? `/store/${vendorId}/products/${objectID}` : `/products/${objectID}`;
  }

  return (
    <div ref={wrapRef} className={`relative ${className ?? ''}`}>
      <form
        onSubmit={(e) => { e.preventDefault(); submit(q); }}
        className="flex items-center h-12 rounded-pill border border-ink-900 focus-within:ring-2 focus-within:ring-brand-600 overflow-hidden bg-white"
      >
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder ?? 'Search jewelry, vendors, materials…'}
          className="flex-1 h-full px-5 text-sm bg-transparent focus:outline-none"
          aria-label="Search"
        />
        <button
          type="submit"
          aria-label="Search"
          className="m-1 h-10 w-10 rounded-full bg-brand-600 text-white flex items-center justify-center hover:bg-brand-700 transition"
        >
          <SearchIcon />
        </button>
      </form>

      {open && enabled && (q.length > 0 || recent.length > 0) && (
        <div className="absolute left-0 right-0 top-full mt-2 bg-surface border border-line rounded-md shadow-pop z-50 overflow-hidden">
          {q.length === 0 && recent.length > 0 && (
            <div className="p-2">
              <p className="px-3 py-1.5 text-[11px] uppercase tracking-wide text-ink-500">Recent searches</p>
              {recent.map((r) => (
                <button
                  key={r}
                  onClick={() => { setQ(r); submit(r); }}
                  className="w-full text-left px-3 py-2 text-sm text-ink-900 hover:bg-canvas rounded-md flex items-center gap-2"
                >
                  <span className="text-ink-400">↻</span> {r}
                </button>
              ))}
            </div>
          )}

          {q.length > 0 && (
            <>
              {hits.length > 0 ? (
                <ul className="py-1">
                  {hits.map((h) => (
                    <li key={h.objectID}>
                      <Link
                        href={hitHref(h.objectID)}
                        onClick={() => { pushRecent(q); setOpen(false); }}
                        className="flex items-center gap-3 px-3 py-2 hover:bg-canvas"
                      >
                        <div className="w-10 h-10 rounded-md bg-canvas overflow-hidden shrink-0">
                          {h.image && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={h.image} alt="" className="w-full h-full object-cover" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-ink-900 truncate">{h.name}</p>
                          <p className="text-xs text-ink-500">{h.vendorName}</p>
                        </div>
                        <span className="text-sm font-semibold text-ink-900">{formatPrice(h.price, code)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-4 py-3 text-sm text-ink-500">No matches yet — keep typing.</p>
              )}
              <button
                onClick={() => submit(q)}
                className="w-full text-left px-4 py-2.5 text-sm font-semibold text-brand-700 border-t border-line hover:bg-canvas"
              >
                See all results for &ldquo;{q}&rdquo; →
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}
