'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { PageHeader, Card } from '@/components/dashboard/DashboardShell';

interface PresetMeta {
  key: string;
  name: string;
  description: string;
  accent: string;
  thumbnailUrl: string;
}

interface VendorMini {
  id: string;
  themePresetKey: string | null;
  themeColor: string | null;
}

interface VendorPageRow {
  id: string;
  slug: string;
  title: string;
  pageKind: 'HOMEPAGE' | 'CUSTOM' | 'PDP' | 'CART' | 'CHECKOUT';
  isPublished: boolean;
  isHomepage: boolean;
  updatedAt: string;
}

type SystemKind = 'HOMEPAGE' | 'PDP' | 'CART' | 'CHECKOUT';

const SYSTEM_CARDS: { kind: SystemKind; title: string; description: string }[] = [
  { kind: 'HOMEPAGE', title: 'Homepage',     description: 'Hero, featured products, banners, blog cards — what shoppers see first.' },
  { kind: 'PDP',      title: 'Product page', description: 'Gallery layout, variant selectors, reviews, related-product strip.' },
  { kind: 'CART',     title: 'Cart',         description: 'Announcement bar, upsell carousels, trust badges, summary placement.' },
  { kind: 'CHECKOUT', title: 'Checkout',     description: 'Trust strip, gift-wrap upsell, custom fields, announcement bar. Payment flow stays secure.' },
];

export default function VendorStorefrontPage() {
  const router = useRouter();
  const [vendor, setVendor]   = useState<VendorMini | null>(null);
  const [presets, setPresets] = useState<PresetMeta[]>([]);
  const [pages, setPages]     = useState<VendorPageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string | null>(null);
  const [opening, setOpening]   = useState<SystemKind | null>(null);

  async function refresh() {
    const [v, p, pgs] = await Promise.all([
      api<VendorMini>('/api/vendors/me'),
      api<PresetMeta[]>('/api/vendors/me/theme/presets'),
      api<VendorPageRow[]>('/api/vendor-pages/me'),
    ]);
    setVendor(v);
    setPresets(p);
    setPages(pgs);
    setLoading(false);
  }

  useEffect(() => {
    refresh().catch((e) => {
      toast.error(e?.message || 'Failed to load storefront');
      setLoading(false);
    });
  }, []);

  async function applyPreset(key: string) {
    const ok = window.confirm(
      'Applying a preset will reset the look of your homepage, product page, cart, and checkout to the preset defaults. Your products, orders, and content stay safe. Continue?'
    );
    if (!ok) return;
    setApplying(key);
    try {
      await api('/api/vendors/me/theme/preset', {
        method: 'POST',
        body: JSON.stringify({ key, force: true }),
      });
      toast.success(`Applied "${key}" preset`);
      await refresh();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to apply preset');
    } finally {
      setApplying(null);
    }
  }

  async function openEditor(kind: SystemKind) {
    setOpening(kind);
    try {
      const page = await api<{ id: string }>(`/api/vendor-pages/me/system/${kind}/init`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      router.push(`/pages/${page.id}`);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to open editor');
      setOpening(null);
    }
  }

  if (loading) {
    return <div className="p-8 text-ink-500">Loading…</div>;
  }

  const pageByKind = new Map(pages.map((p) => [p.pageKind, p] as const));

  return (
    <div className="space-y-8 p-6">
      <PageHeader
        title="Storefront"
        subtitle="Pick a preset to set the overall look in one click, then fine-tune every page block-by-block."
      />

      {/* ── Theme presets ────────────────────────────────────────────── */}
      <Card>
        <div className="p-6">
          <div className="mb-4 flex items-baseline justify-between">
            <div>
              <h2 className="text-lg font-medium">Theme presets</h2>
              <p className="text-sm text-ink-500">
                Each preset resets colours, typography, and the default block layout of your homepage / PDP / cart / checkout.
              </p>
            </div>
            {vendor?.themePresetKey && (
              <span className="rounded-full bg-canvas px-2.5 py-1 text-xs text-ink-700">
                Current: {vendor.themePresetKey}
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {presets.map((p) => {
              const isCurrent = vendor?.themePresetKey === p.key;
              return (
                <div
                  key={p.key}
                  className={`relative flex flex-col rounded-lg border p-4 transition ${
                    isCurrent ? 'border-brand-600 ring-1 ring-brand-600' : 'border-line hover:border-ink-300'
                  }`}
                >
                  <div
                    className="mb-3 h-24 w-full rounded"
                    style={{ background: `linear-gradient(135deg, ${p.accent} 0%, #f5f5f5 100%)` }}
                    aria-hidden
                  />
                  <div className="font-medium">{p.name}</div>
                  <p className="mt-1 flex-1 text-xs text-ink-500">{p.description}</p>
                  <button
                    type="button"
                    className="mt-3 rounded-md border border-ink-200 px-3 py-1.5 text-sm hover:border-brand-600 hover:text-brand-700 disabled:opacity-50"
                    disabled={applying === p.key}
                    onClick={() => applyPreset(p.key)}
                  >
                    {applying === p.key ? 'Applying…' : isCurrent ? 'Re-apply' : 'Apply'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* ── System pages ─────────────────────────────────────────────── */}
      <Card>
        <div className="p-6">
          <h2 className="mb-1 text-lg font-medium">Pages you can customise</h2>
          <p className="mb-4 text-sm text-ink-500">
            Each surface uses the same block builder. Required blocks (e.g. payment) cannot be removed but you can add, remove, and reorder everything else.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {SYSTEM_CARDS.map((c) => {
              const existing = pageByKind.get(c.kind);
              return (
                <div key={c.kind} className="rounded-lg border border-line p-4">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{c.title}</div>
                    {existing?.isPublished ? (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">Published</span>
                    ) : existing ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">Draft</span>
                    ) : (
                      <span className="rounded-full bg-canvas px-2 py-0.5 text-xs text-ink-500">Not set up</span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-ink-500">{c.description}</p>
                  <button
                    type="button"
                    className="mt-3 rounded-md bg-ink-900 px-3 py-1.5 text-sm text-white hover:bg-ink-700 disabled:opacity-50"
                    disabled={opening === c.kind}
                    onClick={() => openEditor(c.kind)}
                  >
                    {opening === c.kind ? 'Opening…' : existing ? `Edit ${c.title.toLowerCase()}` : `Set up ${c.title.toLowerCase()}`}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

    </div>
  );
}
