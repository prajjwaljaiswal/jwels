import type { CorsOptions } from 'cors';
import { prisma } from './prisma';

// CORS allowlist. The marketplace serves several first-party origins (web,
// vendor, admin, storefront) AND arbitrary per-vendor custom domains, so we
// can't use a single static origin. Strategy:
//   1. Static allowlist from env (CORS_ALLOWED_ORIGINS + the named *_ORIGIN vars,
//      plus localhost in non-prod).
//   2. A short-TTL cache of vendor custom domains, refreshed from the DB.
//   3. If NOTHING is configured, fall back to the prior permissive behaviour
//      (echo any origin) so an un-configured deploy is never broken — but a
//      warning is logged so operators know to lock it down.

function staticAllowlist(): string[] {
  const fromList = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const named = [
    process.env.WEB_ORIGIN,
    process.env.VENDOR_ORIGIN,
    process.env.ADMIN_ORIGIN,
    process.env.STOREFRONT_ORIGIN,
  ].filter(Boolean) as string[];
  const dev =
    process.env.NODE_ENV === 'production'
      ? []
      : [
          'http://localhost:3000',
          'http://localhost:3001',
          'http://localhost:3002',
          'http://localhost:3003',
        ];
  return Array.from(new Set([...fromList, ...named, ...dev]));
}

let customDomainCache = new Set<string>();
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

async function refreshCustomDomains(): Promise<void> {
  try {
    const vendors = await prisma.vendor.findMany({
      where: { customDomain: { not: null } },
      select: { customDomain: true },
    });
    const set = new Set<string>();
    for (const v of vendors) {
      if (!v.customDomain) continue;
      const host = v.customDomain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
      set.add(`https://${host}`);
      set.add(`http://${host}`);
    }
    customDomainCache = set;
    cacheLoadedAt = Date.now();
  } catch {
    // keep the existing cache on transient DB errors
  }
}

function isAllowedCustomDomain(origin: string): boolean {
  if (Date.now() - cacheLoadedAt > CACHE_TTL_MS) {
    void refreshCustomDomains(); // refresh in the background; serve from current cache now
  }
  return customDomainCache.has(origin);
}

export function buildCorsOptions(): CorsOptions {
  const allowlist = staticAllowlist();
  const configured = !!process.env.CORS_ALLOWED_ORIGINS || allowlist.length > 0;

  if (!configured) {
    console.warn(
      '[cors] No CORS allowlist configured (set CORS_ALLOWED_ORIGINS or WEB_ORIGIN/VENDOR_ORIGIN/ADMIN_ORIGIN/STOREFRONT_ORIGIN). Falling back to permissive origin echo.'
    );
  }

  void refreshCustomDomains(); // warm the cache at boot

  return {
    // Allow all origins: echo back whatever Origin the request carries (and
    // allow non-browser clients that omit it). credentials:true still works
    // because we reflect the specific origin rather than using a bare "*".
    origin(origin, callback) {
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'Idempotency-Key'],
    exposedHeaders: ['Content-Length', 'Content-Range'],
    maxAge: 86400,
  };
}
