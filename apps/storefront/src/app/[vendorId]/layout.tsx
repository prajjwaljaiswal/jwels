import { headers } from 'next/headers';
import { cache } from 'react';
import type { Metadata, Viewport } from 'next';
import { mergeTheme, type VendorBrand } from '@/lib/theme-core';
import { classifyHost } from '../../lib/tenant-host';
import VendorStoreClient from './VendorStoreClient';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// Server-side brand fetch, deduped per request via React cache() so generateMetadata,
// generateViewport, and the layout body share ONE /brand call. Data-cached for 300s and
// tagged so a vendor edit/publish (API notifyStorefrontRevalidate) invalidates it.
// `vendorKey` is the routed param (slug on a tenant host, slug-or-UUID on path access);
// the API tags both the UUID and slug variants so revalidation matches either.
const getBrand = cache(async (vendorKey: string): Promise<VendorBrand | null> => {
  try {
    const res = await fetch(`${API_URL}/api/vendors/${encodeURIComponent(vendorKey)}/brand`, {
      next: { revalidate: 300, tags: [`vendor:${vendorKey}`] },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data?.vendor ?? null) as VendorBrand | null;
  } catch {
    return null;
  }
});

export async function generateMetadata({ params }: { params: { vendorId: string } }): Promise<Metadata> {
  const vendor = await getBrand(params.vendorId);
  if (!vendor) return {};
  const t = mergeTheme(vendor.themeColor ?? '#F1641E', vendor.theme);
  return {
    // Layout owns the tab title base + favicon; child pages override the title via `%s`.
    title: { default: vendor.shopName, template: `%s · ${vendor.shopName}` },
    description: vendor.tagline ?? vendor.description ?? undefined,
    icons: t.faviconUrl ? { icon: t.faviconUrl } : undefined,
    openGraph: { title: vendor.shopName, description: vendor.tagline ?? undefined, type: 'website' },
  };
}

export async function generateViewport({ params }: { params: { vendorId: string } }): Promise<Viewport> {
  const vendor = await getBrand(params.vendorId);
  if (!vendor) return {};
  const t = mergeTheme(vendor.themeColor ?? '#F1641E', vendor.theme);
  return { themeColor: t.colors.primary };
}

export default async function VendorStoreLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { vendorId: string };
}) {
  const vendor = await getBrand(params.vendorId);
  // Reading the host classifies tenant (custom/subdomain) vs app-domain path access so the
  // client seeds link base paths correctly with no hydration flip. This makes the layout
  // dynamic; child pages keep their own fetch-level caching.
  const isCustomHost = classifyHost(headers().get('host') ?? '').kind !== 'app';

  if (!vendor) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center">
        <div className="text-center">
          <p className="text-4xl font-display text-ink-900 mb-2">Shop not found</p>
          <p className="text-ink-700 mb-6">This storefront doesn&rsquo;t exist or is unavailable.</p>
          <a href={`${process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3000'}/products`} className="btn-primary">Browse marketplace</a>
        </div>
      </div>
    );
  }

  return (
    <VendorStoreClient vendor={vendor} isCustomHost={isCustomHost}>
      {children}
    </VendorStoreClient>
  );
}
