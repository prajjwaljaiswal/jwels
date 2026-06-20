// Shared host classification for the multi-tenant storefront.
// Imported by middleware.ts (Edge runtime) and the robots.ts / sitemap.ts metadata
// routes — keep this file dependency-free and side-effect-free.
//
// NOTE on imports: this is storefront-local. `@/lib/*` resolves to the shared
// packages/lib, so import this via a RELATIVE path (./lib/tenant-host, ../lib/tenant-host).

export const APP_DOMAIN = (process.env.NEXT_PUBLIC_APP_DOMAIN || 'localhost').toLowerCase();

// Infra-owned subdomain labels that must never resolve to a tenant storefront.
// Mirror of the API's RESERVED_SUBDOMAINS infra labels (apps/api/src/lib/vendor-slug.ts) —
// keep the two lists aligned.
export const RESERVED_SUBS = new Set(['www', 'api', 'admin', 'vendor', 'store']);

export type HostKind =
  | { kind: 'app' }
  | { kind: 'subdomain'; key: string }
  | { kind: 'custom'; key: string };

/** Strip the port and lowercase a raw Host header value. */
export function normalizeHost(rawHost: string): string {
  return (rawHost || '').split(':')[0].toLowerCase();
}

/**
 * Classify a host into a routing bucket:
 *  - app:       the root app domain, localhost, or *.localhost → path-based /[vendorId]
 *  - subdomain: a single non-reserved label under APP_DOMAIN ({label}.<APP_DOMAIN>)
 *  - custom:    any other host (a vendor's own domain)
 */
export function classifyHost(rawHost: string): HostKind {
  const domain = normalizeHost(rawHost);
  if (!domain || domain === APP_DOMAIN || domain === 'localhost' || domain.endsWith('.localhost')) {
    return { kind: 'app' };
  }
  if (domain.endsWith('.' + APP_DOMAIN)) {
    const sub = domain.slice(0, -(APP_DOMAIN.length + 1));
    // Multi-label (a.b.store...) and reserved labels fall back to the app domain.
    if (!sub || sub.includes('.') || RESERVED_SUBS.has(sub)) return { kind: 'app' };
    return { kind: 'subdomain', key: sub };
  }
  return { kind: 'custom', key: domain };
}
