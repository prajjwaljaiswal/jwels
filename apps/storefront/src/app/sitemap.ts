import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { classifyHost } from '../lib/tenant-host';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// Per-tenant sitemap. The Host header selects the tenant; on a tenant host the
// storefront serves the vendor at the root (middleware rewrites / → /[slug]), so URLs
// are emitted relative to that host without a slug prefix.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const h = headers();
  const host = (h.get('host') ?? '').split(':')[0];
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const kind = classifyHost(host);
  if (kind.kind === 'app') return []; // the aggregate app domain is not a single tenant

  const by = kind.kind === 'subdomain' ? 'subdomain' : 'domain';
  const resolved = await fetch(`${API_URL}/api/vendors/resolve?by=${by}&key=${encodeURIComponent(kind.key)}`);
  if (!resolved.ok) return [];
  const { vendorId } = (await resolved.json()) as { vendorId: string };

  const entriesRes = await fetch(`${API_URL}/api/vendors/${vendorId}/sitemap-entries`, {
    next: { revalidate: 3600, tags: [`vendor:${vendorId}:pages`] },
  });
  const { pages = [], products = [] } = entriesRes.ok
    ? ((await entriesRes.json()) as { pages: string[]; products: string[] })
    : { pages: [], products: [] };

  const base = `${proto}://${host}`;
  const now = new Date();
  return [
    { url: `${base}/`, lastModified: now },
    ...pages.map((slug) => ({ url: `${base}/${slug}`, lastModified: now })),
    ...products.map((p) => ({ url: `${base}/products/${p}`, lastModified: now })),
  ];
}
