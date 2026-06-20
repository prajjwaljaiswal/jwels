import { prisma } from './prisma';

/**
 * Notify every storefront process to invalidate cached data for a vendor.
 *
 * Self-hosted (PM2) equivalent of Vercel's on-demand revalidation: the API POSTs to
 * each storefront upstream listed in `STOREFRONT_INTERNAL_URLS`, and that storefront
 * route handler calls `revalidateTag` for `vendor:{id}` and `vendor:{id}:pages`.
 *
 * No-ops when unconfigured (dev / single instance without revalidation wired) — the
 * TTL-based data cache self-heals. When the storefront runs multiple processes, list
 * every upstream here (or run a shared Redis cacheHandler so one POST fans out).
 * See docs/storefront-multitenancy-plan.md.
 */
export async function notifyStorefrontRevalidate(vendorId: string): Promise<void> {
  const list = (process.env.STOREFRONT_INTERNAL_URLS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const secret = process.env.REVALIDATE_SECRET;
  if (!list.length || !secret) return;

  const tags = [`vendor:${vendorId}`, `vendor:${vendorId}:pages`];
  await Promise.allSettled(
    list.map((base) =>
      fetch(`${base.replace(/\/+$/, '')}/api/revalidate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-revalidate-secret': secret },
        body: JSON.stringify({ tags }),
      })
    )
  ); // fire-and-forget; failures are non-fatal (TTL self-heals)
}
