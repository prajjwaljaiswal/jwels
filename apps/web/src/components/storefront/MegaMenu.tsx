'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

interface RootNode {
  id: string; name: string; slug: string;
  imageUrl?: string | null;
}
interface MenuItem { id: string; label: string; href: string; iconUrl: string | null; sortOrder: number; }
interface MenuSection { id: string; title: string; sortOrder: number; items: MenuItem[]; }
interface MenuPayload extends RootNode {
  description?: string | null;
  promoImageUrl?: string | null;
  promoLinkUrl?: string | null;
  promoLabel?: string | null;
  menuSections: MenuSection[];
}
interface CollectionLite { id: string; name: string; slug: string; }

export function MegaMenu() {
  const [roots, setRoots] = useState<RootNode[]>([]);
  const [collections, setCollections] = useState<CollectionLite[]>([]);
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const [menuCache, setMenuCache] = useState<Record<string, MenuPayload>>({});
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [openCollections, setOpenCollections] = useState(false);

  useEffect(() => {
    api<any[]>('/api/categories', { auth: false })
      .then((all) => setRoots(all.filter((c) => !c.parentId).slice(0, 10)))
      .catch(() => setRoots([]));
    api<CollectionLite[]>('/api/collections', { auth: false })
      .then(setCollections).catch(() => setCollections([]));
  }, []);

  function openWith(slug: string) {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
    setOpenSlug(slug);
    setOpenCollections(false);
    if (!menuCache[slug]) {
      api<MenuPayload>(`/api/categories/menu/${slug}`, { auth: false })
        .then((data) => setMenuCache((prev) => ({ ...prev, [slug]: data })))
        .catch(() => {});
    }
  }
  function scheduleClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => { setOpenSlug(null); setOpenCollections(false); }, 140);
  }

  if (roots.length === 0) return null;
  const openMenu = openSlug ? menuCache[openSlug] : null;

  return (
    <div className="relative border-t border-line" onMouseLeave={scheduleClose}>
      <div className="max-w-container mx-auto px-6">
        <div className="flex items-center gap-7 h-12 overflow-x-auto no-scrollbar text-sm">
          {roots.map((root) => (
            <button key={root.id}
              onMouseEnter={() => openWith(root.slug)}
              onFocus={() => openWith(root.slug)}
              onClick={() => openSlug === root.slug ? setOpenSlug(null) : openWith(root.slug)}
              className={[
                'whitespace-nowrap uppercase tracking-wide text-xs font-semibold transition py-2',
                openSlug === root.slug
                  ? 'text-ink-900 border-b-2 border-brand-600'
                  : 'text-ink-700 hover:text-ink-900',
              ].join(' ')}
            >
              {root.name}
            </button>
          ))}
          {collections.length > 0 && (
            <button
              onMouseEnter={() => { if (closeTimer.current) clearTimeout(closeTimer.current); setOpenSlug(null); setOpenCollections(true); }}
              onClick={() => setOpenCollections((v) => !v)}
              className={[
                'whitespace-nowrap uppercase tracking-wide text-xs font-semibold transition py-2',
                openCollections
                  ? 'text-ink-900 border-b-2 border-brand-600'
                  : 'text-ink-700 hover:text-ink-900',
              ].join(' ')}
            >
              Collections
            </button>
          )}
        </div>
      </div>

      {openMenu && (
        <div onMouseEnter={() => openWith(openMenu.slug)}
          className="absolute left-0 right-0 top-full z-50 bg-surface border-b border-line shadow-xl">
          <div className="max-w-container mx-auto px-6 py-6">
            <div className="grid grid-cols-12 gap-6">
              {/* Sections — split across columns. Each section takes 2 cols on lg. */}
              <div className="col-span-12 lg:col-span-9 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-6">
                {openMenu.menuSections.length === 0 ? (
                  <div className="col-span-full">
                    <Link href={`/c/${openMenu.slug}`}
                      className="text-lg font-display text-ink-900 hover:text-brand-700">
                      Shop all {openMenu.name} →
                    </Link>
                  </div>
                ) : (
                  openMenu.menuSections.map((section) => (
                    <div key={section.id}>
                      <p className="text-[11px] uppercase tracking-wider font-bold text-ink-900 mb-3">{section.title}</p>
                      <ul className="space-y-1.5">
                        {section.items.map((item) => (
                          <li key={item.id}>
                            <Link href={item.href}
                              className="inline-flex items-center gap-2 text-sm text-ink-700 hover:text-brand-700">
                              {item.iconUrl && <img src={item.iconUrl} alt="" className="h-4 w-4 rounded-full" />}
                              <span>{item.label}</span>
                            </Link>
                          </li>
                        ))}
                        <li className="pt-1">
                          <Link href={`/c/${openMenu.slug}`}
                            className="text-xs font-semibold text-brand-700 hover:underline">
                            Explore all →
                          </Link>
                        </li>
                      </ul>
                    </div>
                  ))
                )}
              </div>

              {/* Right promo rail */}
              <div className="hidden lg:block col-span-3">
                {openMenu.promoImageUrl ? (
                  <Link href={openMenu.promoLinkUrl || `/c/${openMenu.slug}`}
                    className="block rounded-md overflow-hidden border border-line group">
                    <div className="aspect-[3/4] relative bg-canvas">
                      <img src={openMenu.promoImageUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition" />
                      {openMenu.promoLabel && (
                        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-ink-900/80 to-transparent">
                          <span className="text-white font-semibold text-sm">{openMenu.promoLabel}</span>
                        </div>
                      )}
                    </div>
                  </Link>
                ) : (
                  <Link href={`/c/${openMenu.slug}`}
                    className="block aspect-[3/4] rounded-md border border-dashed border-line flex items-center justify-center text-sm text-ink-500 hover:border-brand-400 hover:text-brand-700">
                    Shop all {openMenu.name} →
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {openCollections && collections.length > 0 && (
        <div onMouseEnter={() => { if (closeTimer.current) clearTimeout(closeTimer.current); }}
          className="absolute left-0 right-0 top-full z-50 bg-surface border-b border-line shadow-xl">
          <div className="max-w-container mx-auto px-6 py-6">
            <p className="text-[11px] uppercase tracking-wider font-bold text-ink-900 mb-3">Collections</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {collections.map((c) => (
                <Link key={c.id} href={`/collection/${c.slug}`}
                  className="rounded-md border border-line bg-canvas hover:bg-surface hover:border-ink-300 p-4 text-sm font-semibold text-ink-700 hover:text-brand-700">
                  {c.name}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
