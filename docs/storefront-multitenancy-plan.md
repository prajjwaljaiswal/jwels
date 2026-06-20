<!-- Generated 2026-06-20 from deep-research + design workflow (run wcgvr9mvf). -->
<!-- Single multi-tenant Next.js storefront, host-resolved. NOT micro-frontends. -->

# Multi-Tenant Storefront — Unified Implementation Plan
**Target:** `apps/storefront` · **Runtime:** self-hosted PM2 (`ecosystem.config.js`), default `next start` server (NOT `output: 'standalone'`, NOT Vercel) · **Decision:** one multi-tenant Next.js 14 app, host-resolved, page-builder-driven per-vendor UI.

## Overview

The storefront is already 80% multi-tenant: `apps/storefront/src/middleware.ts` rewrites custom-domain requests to the existing `/[vendorId]` route tree, and `[vendorId]/layout.tsx` + `VendorProvider` already theme every child route from `vendor.theme`. We keep that spine intact and graft on the production gaps:

1. **Subdomain tenancy** (`*.store.vrindaonline.com`) alongside the existing custom-domain path — one new Prisma column, one generalized resolver, one new middleware branch. The rewrite target stays the literal `/{slug}{path}`, so **no file under `apps/storefront/src/app/[vendorId]/**` changes behavior**.
2. **Server-side theme resolution** — convert `[vendorId]/layout.tsx` from `'use client'` to an RSC so favicon, `theme-color`, OG image, and the `--store-*` CSS vars render in the first HTML byte (kills FOUC and wrong social-share branding), and the client provider hydrates from server data instead of re-fetching. **The RSC reads `headers()` and is therefore dynamic** — we accept that and lean on the API-response data-cache, not on static HTML caching (see Theme + Caching sections; this resolves a candidate contradiction).
3. **Custom-domain DNS verification + automated SSL** via a Caddy reverse proxy with a wildcard DNS-01 cert (subdomains) and on-demand TLS gated by an `ask` endpoint (custom domains) — the self-hosted equivalent of Vercel's Domains API. Apex domains are supported via A/ALIAS, not CNAME-only.
4. **Cross-process cache invalidation** via a Redis `cacheHandler` + tag-based `revalidateTag` fan-out, so the design survives any multi-process storefront deployment (multi-port fork behind Caddy, NOT PM2 cluster on a CLI bin).
5. **Cross-host session/cart decision** — made explicit and in-scope (each tenant host is a session island; subdomains can optionally share via a parent-domain cookie later). This was previously buried in Risks.

**Decisive resolutions of the candidates' disagreements:**

| Question | Cand. 1 (minimal) | Cand. 2 (robust) | **Decision** |
|---|---|---|---|
| Ship Redis cache now or later? | Defer; TTL is fine at `instances: 1` | Ship Redis now | **Phase it.** Ship single-instance with `themeVersion` + tag plumbing wired and a no-op-degradable revalidate path. Add Redis `cacheHandler` the moment a second storefront process exists — the trigger is **process count > 1**, not load. |
| Custom-domain verification now or later? | Defer behind a flag | Build full workflow now | **Build it now.** Caddy's `on_demand_tls.ask` *requires* an "is this domain allowed" gate; without verification you let attackers mint certs against your IP. Verification is load-bearing for the SSL story. |
| Spoofing defense | `status===APPROVED` gate only | HMAC-signed `x-tenant-*` headers + Caddy strip | **Adopt the HMAC**, implemented with **Web Crypto in middleware (Edge runtime) and `node:crypto` in the RSC**, producing byte-identical hex. Closes the direct-to-Next forgery gap now that we trust forwarded identity to skip a client fetch. |
| Resolver endpoint | Generalize existing `by-domain/:domain` | New thin endpoint | **New thin `GET /api/vendors/resolve`** for the middleware hot path (tiny, cacheable, classification-aware) **plus a new `GET /api/vendors/:vendorId/brand`** for the RSC theme render (light; avoids the heavy `/:vendorId` payload). Keep `by-domain/:domain` untouched for the existing `login/page.tsx` consumer. |
| Layout caching model | implicit | "ISR-cache the layout" | **Layout is dynamic** (it reads `headers()`); the *data fetch* it makes is what gets cached + tag-invalidated. We do not claim static-HTML caching of the layout — that contradicts reading host headers per request. |
| Horizontal scale mechanism | n/a | `exec_mode: 'cluster'` flip | **Multi-port fork behind Caddy upstreams**, never PM2 cluster on the `next` CLI bin (which clusters unreliably and can double-bind the port). |

---

## Cross-host session & cart (in-scope decision)

Moving each vendor onto its **own origin** (`jhumkaya.com`, `jhumkaya.store.vrindaonline.com`) partitions `localStorage` per origin. Today auth token (`@jewel/lib/api.ts`, key `NEXT_PUBLIC_TOKEN_KEY` default `token`) and the cart (`@jewel/lib/cart.ts`) live in `localStorage`; `account/page.tsx` and `orders/page.tsx` read it directly. Consequence: a customer authenticated on the marketplace or vendor A's host has **no token and no cart** on vendor B's host.

**Decision — session islands (Phase 1), with a subdomain-cookie upgrade path (Phase 2, deferred):**
- **Each tenant host is its own session/cart island.** This is acceptable because the cart is already single-vendor by rule, so a cart never legitimately spans vendor hosts. State explicitly in product/UX copy: signing in on a branded store is per-store.
- **Make the per-host flow self-contained:** the storefront's own `/login`, `/register`, `/forgot-password`, `/reset-password` must work entirely within the tenant host. Verify the post-login `?next=` redirect, password-reset links (emailed links must point at the tenant host the request originated from — pass the origin through to the email builder), and account/orders pages all resolve relative to the current host. No assumption that a marketplace session carries over.
- **Phase 2 (deferred, subdomains only):** migrate auth to an `httpOnly` cookie scoped `Domain=.store.vrindaonline.com` so `*.store.vrindaonline.com` tenants share one session. This **cannot** span fully-custom domains (different registrable domain) — custom-domain stores remain islands regardless. This also addresses the pre-existing XSS-exposure-of-localStorage-token concern, so fold the two together when scheduled. Out of scope for Phase 1 but explicitly the planned direction.

---

## Data model changes (Prisma)

All in `apps/api/prisma/schema.prisma`, `Vendor` model (lines 316–382). Applied with `npm run db:migrate` (project uses `prisma db push`, no migration files — per CLAUDE.md). **None of these fields exist today** (verified: schema has `customDomain` but no `subdomain`, no verification fields, no `themeVersion`).

Add next to `customDomain` (line 330):

```prisma
  subdomain              String?      @unique   // "jhumkaya" → jhumkaya.store.vrindaonline.com
  customDomainStatus     DomainStatus @default(NONE)
  customDomainToken      String?                // one-time DNS TXT verification token
  customDomainVerifiedAt DateTime?
  themeVersion           Int          @default(1) // bumped on theme/page publish; cache + invalidation signal
```

New enum (place near `VendorStatus`):

```prisma
enum DomainStatus { NONE PENDING VERIFIED FAILED }
```

Notes:
- `customDomain` keeps its existing `@unique`. `subdomain` is `@unique` and validated against the **existing** `RESERVED_VENDOR_SLUGS` set in `apps/api/src/lib/vendor-slug.ts` **plus** the infra-reserved labels `www`, `api`, `admin`, `vendor`, `store`. These two lists are unioned into one exported constant (`RESERVED_SUBDOMAINS`) in `vendor-slug.ts` and re-used everywhere (see "Reserved-label parity" below) so the API and middleware cannot drift.
- `themeVersion` is a single integer that doubles as the cross-process cache key and the invalidation trigger — the cheapest event-driven primitive, no per-field diffing.
- **No** `themeVersion` on `VendorPage` — page publishes bump the parent `Vendor.themeVersion`, so one integer covers both theme and page-content invalidation.
- **Backfill (one-time script):** for each vendor with `status = APPROVED` **and a non-null `slug`**, set `subdomain = slug` (guard the null case — `Vendor.slug` is `String? @unique` and an APPROVED vendor may legitimately have `slug = null`). For APPROVED vendors with `slug = null`, **skip** (no subdomain until they pick a slug) rather than failing. Optionally derive one via `uniqueVendorSlug(shopName)` — but skipping is the safe default. Existing shops with a slug instantly gain `{slug}.store.vrindaonline.com` at zero onboarding cost.
- **Subdomain ↔ slug drift policy:** `subdomain` is an **independent public identifier**, not a mirror of `slug`. Changing `slug` later does NOT cascade to `subdomain`. This avoids breaking a live subdomain URL on a slug edit. (If a vendor wants them realigned, that is an explicit subdomain change via the dashboard.)

---

## API changes

All in `apps/api`. The Express API is the single source of truth; the storefront never queries the DB directly. All new public routes go on **`vendorRouter`** (the router that already carries `by-domain`, mounted at `/api/vendors` in `src/index.ts:84`), **not** `assetsRouter` (also mounted at `/api/vendors`, line 86).

> **LOAD-BEARING route ordering (blocker fix).** Express matches in registration order. `vendorRouter` defines the catch-all `router.get('/:vendorId')` at **line 788** (plus `/:vendorId/categories` and `/:vendorId/sections` at ~910/955). The new **bare-segment** routes `GET /resolve` and `GET /domain-allowed` **MUST be registered before line 788**, or `/api/vendors/resolve` is captured by `/:vendorId` (with `vendorId='resolve'`, not a UUID per `VENDOR_UUID_RE`, so a slug lookup → 404) and the new handler never runs. `GET /:vendorId/brand` and `GET /:vendorId/sitemap-entries` have a longer static suffix so they are not eaten by the bare `/:vendorId`, but they **must still precede** the other `/:vendorId/...` param routes to be safe. Add an explicit comment block at the insertion point. "One-file change surface" is fine; **order within the file is load-bearing.**

### 1. New resolver endpoint — `GET /api/vendors/resolve` (public, register before `/:vendorId`)
The middleware hot path. Lookup-only, tiny payload, explicitly cacheable, classification-aware.

```ts
// GET /api/vendors/resolve?by=subdomain|domain&key=<value>
router.get('/resolve', async (req, res) => {
  const by  = String(req.query.by ?? '');
  const key = String(req.query.key ?? '').toLowerCase();
  if (!key) return res.status(400).json({ error: 'missing_key' });

  const where = by === 'subdomain' ? { subdomain: key } : { customDomain: key };
  const vendor = await prisma.vendor.findUnique({
    where: where as any,
    select: { id: true, slug: true, status: true, themeVersion: true, customDomainStatus: true },
  });
  if (!vendor || vendor.status !== VendorStatus.APPROVED)
    return res.status(404).json({ error: 'not_found' });

  // Custom domains MUST be verified; subdomains are platform-owned (wildcard cert) so always trusted.
  if (by === 'domain' && vendor.customDomainStatus !== 'VERIFIED')
    return res.status(404).json({ error: 'unverified' });

  res.set('Cache-Control', 'public, max-age=30, s-maxage=300');
  res.json({ vendorId: vendor.id, slug: vendor.slug ?? vendor.id, themeVersion: vendor.themeVersion });
});
```

Closes the **"any `customDomain` in the DB is trusted"** gap: unverified domains never resolve. `s-maxage` lets Caddy cache the result, which is the real durable cache (the middleware `Map` is best-effort only — see Caching).

### 2. New lightweight brand endpoint — `GET /api/vendors/:vendorId/brand` (public, register before other `/:vendorId/...` routes)
The RSC theme render path. The existing `GET /api/vendors/:vendorId` (line 788) runs `findUnique` + product `findMany` + section `findMany` + review aggregate and returns `{vendor, products, sections, aggregate}` — far too heavy to run on every storefront render purely for theme/brand. Add a thin sibling returning only what `mergeTheme` + `generateMetadata` need:

```ts
// GET /api/vendors/:vendorId/brand  (UUID or slug via resolveVendorId)
router.get('/:vendorId/brand', async (req, res) => {
  const id = await resolveVendorId(req.params.vendorId);
  if (!id) return res.status(404).json({ error: 'not_found' });
  const vendor = await prisma.vendor.findUnique({
    where: { id },
    select: {
      id: true, slug: true, shopName: true, shopLogoUrl: true, bannerUrls: true,
      tagline: true, description: true, themeColor: true, theme: true,
      subdomain: true, customDomain: true, customDomainStatus: true, themeVersion: true, status: true,
    },
  });
  if (!vendor || vendor.status !== VendorStatus.APPROVED) return res.status(404).json({ error: 'not_found' });
  res.set('Cache-Control', 'public, max-age=30, s-maxage=300');
  res.json({ vendor });
});
```

The heavy `GET /api/vendors/:vendorId` stays as-is for the home page's product grid (`StorefrontHome`); only the RSC layout/metadata moves to `/brand`.

### 3. Keep `GET /api/vendors/by-domain/:domain` as-is
Still serves `apps/storefront/src/app/login/page.tsx:69`. No change — avoids breaking the auth-page flow.
> Implementer note (not a plan change): `login/page.tsx:76` calls `mergeTheme(v)` passing the vendor **object** where `mergeTheme(primary: string, partial?)` expects a hex string. Pre-existing latent bug; correct opportunistically to `mergeTheme(v.themeColor ?? '#F1641E', v.theme)` when touching auth theming.

### 4. Custom-domain / subdomain vendor routes — authenticated
Use the **real** guard pattern from this file (there is no `requireVendor` middleware): `requireAuth, requireRole(Role.VENDOR)`, then resolve the vendor inside the handler via `prisma.vendor.findUnique({ where: { userId: req.user!.id } })` — mirroring `PATCH /me/settings` (lines 289–294).

- `POST /api/vendors/me/custom-domain` `{ domain }` → set `customDomain`, `customDomainStatus = PENDING`, generate `customDomainToken` (random hex). Return the records the vendor must add:
  - **Subdomain custom domains** (e.g. `shop.jhumkaya.com`): `_vrinda-verify.{domain} TXT {token}` + `{domain} CNAME store.vrindaonline.com`.
  - **Apex custom domains** (e.g. `jhumkaya.com`): `_vrinda-verify.{domain} TXT {token}` + `{domain} A {INGRESS_IP}` (CNAME at apex is illegal per RFC; vendors use A/ALIAS/ANAME). Return the ingress IP(s) from env `INGRESS_IPS`.
- `POST /api/vendors/me/custom-domain/verify` → ownership via `dns.promises.resolveTxt('_vrinda-verify.' + domain)` matching the token, **AND routing proof via either** a matching `dns.promises.resolveCname(domain)` → `store.vrindaonline.com` **or** a matching `dns.promises.resolve4(domain)`/`resolve6` resolving to an `INGRESS_IPS` entry (handles apex). On success: `customDomainStatus = VERIFIED`, `customDomainVerifiedAt = now()`, **bump `themeVersion`**, fire `notifyStorefrontRevalidate`. On failure: `customDomainStatus = FAILED`.
- `POST /api/vendors/me/subdomain` `{ subdomain }` → validate against `RESERVED_SUBDOMAINS`, check uniqueness (reuse `uniqueVendorSlug`-style collision logic), set directly. No DNS verification — the wildcard cert covers it and the label is platform-owned.

### 5. Caddy `ask` endpoint — `GET /api/vendors/domain-allowed` (public, register before `/:vendorId`)
```ts
// GET /api/vendors/domain-allowed?domain=<host>  → 200 only if a VERIFIED custom domain
router.get('/domain-allowed', rateLimitAsk, async (req, res) => {
  const domain = String(req.query.domain ?? '').toLowerCase();
  const v = await prisma.vendor.findUnique({
    where: { customDomain: domain },
    select: { status: true, customDomainStatus: true },
  });
  if (v?.status === 'APPROVED' && v.customDomainStatus === 'VERIFIED') return res.sendStatus(200);
  return res.sendStatus(404); // Caddy treats any non-2xx as "do not issue"
});
```
- This endpoint is **not** covered by the middleware `Map` or storefront caches — Caddy hits it on every TLS handshake for an unknown SNI **before** refusing. An attacker spraying random SNIs at `:443` causes one API hit per handshake. Mitigate with `rateLimitAsk` (a small in-process IP/burst limiter) and a short-TTL in-memory cache of negative answers keyed by domain. Keep the handler trivial and fast.
- Returning 200 requires `customDomainStatus === 'VERIFIED'`, and verification already confirmed the CNAME/A points at our ingress — so we never mint certs for dangling domains.

### 6. `themeVersion` bump points + revalidation fan-out
Increment `Vendor.themeVersion` and call `notifyStorefrontRevalidate(vendorId)` in:
- the theme `PATCH` handler in `vendors.ts` (the `themeSchema` route),
- slug / logo / domain mutations in `PATCH /api/vendors/me/settings`,
- the custom-domain `verify` success path (§4),
- `POST /api/vendor-pages/me/:id/publish` in `apps/api/src/routes/vendorPages.ts`.

Helper — new `apps/api/src/lib/revalidate.ts`:
```ts
// STOREFRONT_INTERNAL_URLS is a comma-separated list of every storefront upstream
// (one entry per process: http://127.0.0.1:3003,http://127.0.0.1:3013,...).
// In the single-process phase it has one entry; with Redis it could be one (Redis fans out),
// but enumerating all upstreams is the correctness floor when NOT using Redis.
export async function notifyStorefrontRevalidate(vendorId: string) {
  const list = (process.env.STOREFRONT_INTERNAL_URLS ?? '').split(',').map(s => s.trim()).filter(Boolean);
  if (!list.length) return; // no-op in dev / single-instance without revalidate wired
  const tags = [`vendor:${vendorId}`, `vendor:${vendorId}:pages`];
  await Promise.allSettled(list.map((base) =>
    fetch(`${base}/api/revalidate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-revalidate-secret': process.env.REVALIDATE_SECRET! },
      body: JSON.stringify({ tags }),
    })
  )); // fire-and-forget; failures are non-fatal (TTL self-heals)
}
```
**Correction vs. the candidates:** the fan-out must hit **every** storefront process. With Redis `cacheHandler`, one POST suffices because the handler propagates the tag to all workers — but enumerating upstreams is harmless and is the only correct behavior when Redis is absent. Tie the "needs Redis" warning to **process count > 1**, not to PM2 cluster mode specifically.

### 7. Sitemap data endpoint — `GET /api/vendors/:vendorId/sitemap-entries` (public)
Returns `{ pages: string[], products: string[] }` from `VendorPage where isPublished` and `Product where status = ACTIVE`, scoped to the vendor. Feeds `sitemap.ts` (§SEO). Cacheable with `s-maxage`. Has a static suffix so it is not shadowed by the bare `/:vendorId`, but register it with the others above the param routes for clarity.

---

## Storefront middleware

Rewrite `apps/storefront/src/middleware.ts`. **Runs in the Edge runtime** — so **no `node:crypto`**; HMAC uses Web Crypto (`globalThis.crypto.subtle`) and is therefore async. Same matcher. New: four-bucket host classification, signed identity forwarding, best-effort in-process cache, 404-vs-503 fallback distinction.

> **Edge-runtime crypto (blocker fix).** Next.js middleware is Edge, not Node. `import crypto from 'crypto'` / `crypto.createHmac` throws at build/runtime ("A Node.js module is loaded … not supported in the Edge Runtime"). The signing primitive is load-bearing, so it must use Web Crypto. The RSC (real Node runtime) verifies with `node:crypto` and **must produce a byte-identical hex digest** — guarantee this by using the same secret, the same UTF-8 encoding of `${id}.${ver}`, HMAC-SHA-256, and lowercase hex on both sides. Add a tiny shared test asserting the two implementations agree.

> **APP_DOMAIN must be the storefront's own subdomain, never the apex.** Production `NEXT_PUBLIC_APP_DOMAIN = store.vrindaonline.com`. Subdomain tenants are `{slug}.store.vrindaonline.com`. If `APP_DOMAIN` were ever set to the apex `vrindaonline.com`, then `admin.vrindaonline.com` / `vendor.vrindaonline.com` would match the subdomain branch — `RESERVED_SUBDOMAINS` covers those labels, but the safer invariant is structural: keep `APP_DOMAIN` ≥ 3 labels so only `*.store.*` are tenant candidates. Add a boot-time `console.warn` if `APP_DOMAIN` has < 3 labels.

```ts
import { NextRequest, NextResponse } from 'next/server';
// NO 'crypto' import — Edge runtime. Use Web Crypto.

const APP_DOMAIN = (process.env.NEXT_PUBLIC_APP_DOMAIN || 'localhost').toLowerCase();
const API_URL    = process.env.NEXT_PUBLIC_API_URL    || 'http://localhost:4000';
const MW_SECRET  = process.env.MIDDLEWARE_SECRET || '';
const ROOT_ROUTES = ['/login', '/register', '/forgot-password', '/reset-password'];
// Mirror of API RESERVED_SUBDOMAINS infra labels (see "Reserved-label parity").
const RESERVED_SUBS = new Set(['www', 'api', 'admin', 'vendor', 'store']);

// Best-effort process-local cache. NOT a correctness dependency: Edge runtime does not
// guarantee module-state persistence across invocations, and it is per-process anyway.
// Correctness comes from the API Cache-Control (s-maxage=300) fronted by Caddy.
type Hit = { vendorId: string; slug: string; themeVersion: number; exp: number };
const cache = new Map<string, Hit>();

async function resolve(by: 'subdomain' | 'domain', key: string): Promise<{ hit: Hit | null; transient: boolean }> {
  const ck = `${by}:${key}`;
  const c = cache.get(ck);
  if (c && c.exp > Date.now()) return { hit: c, transient: false };
  try {
    const r = await fetch(`${API_URL}/api/vendors/resolve?by=${by}&key=${encodeURIComponent(key)}`);
    if (r.status === 404) return { hit: null, transient: false };       // genuinely not a tenant / unverified
    if (!r.ok) return { hit: null, transient: true };                   // 5xx etc → treat as transient
    const v = await r.json();
    const hit = { ...v, exp: Date.now() + 30_000 } as Hit;
    cache.set(ck, hit);
    return { hit, transient: false };
  } catch {
    return { hit: null, transient: true };                              // API unreachable → transient
  }
}

async function sign(vendorId: string, themeVersion: number): Promise<string> {
  if (!MW_SECRET) return ''; // dev fallback; RSC verify treats empty sig as "untrusted" and resolves params itself
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey('raw', enc.encode(MW_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sigBuf = await crypto.subtle.sign('HMAC', k, enc.encode(`${vendorId}.${themeVersion}`));
  return [...new Uint8Array(sigBuf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function middleware(req: NextRequest) {
  const domain   = (req.headers.get('host') ?? '').split(':')[0].toLowerCase();
  const pathname = req.nextUrl.pathname;

  // Bucket 1 — internal / never-rewrite. LOAD-BEARING: matcher does NOT exclude /api,
  // so the storefront's own /api/revalidate route handler is reached only because of this guard.
  if (pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname === '/push-sw.js')
    return NextResponse.next();

  // Bucket 2 — root app domain / localhost / *.localhost → existing path-based /[vendorId] routing untouched
  const isApp = domain === APP_DOMAIN || domain === 'localhost' || domain.endsWith('.localhost');
  if (isApp) return NextResponse.next();

  // Classify tenant host
  let by: 'subdomain' | 'domain';
  let key: string;
  if (domain.endsWith('.' + APP_DOMAIN)) {
    const sub = domain.slice(0, -(APP_DOMAIN.length + 1));
    if (!sub || sub.includes('.') || RESERVED_SUBS.has(sub)) return NextResponse.next(); // www.store.* etc
    by = 'subdomain'; key = sub;                                   // Bucket 3
  } else {
    by = 'domain'; key = domain;                                   // Bucket 4 — custom domain (incl. preview/IP hosts)
  }

  const { hit, transient } = await resolve(by, key);
  if (!hit) {
    // Distinguish "not a tenant" (permanent 404) from "API down" (transient 503) so a brief outage
    // does NOT cache a 200 "shop unavailable" page that crawlers index.
    const target = transient ? '/_tenant-error' : '/_tenant-unavailable';
    return NextResponse.rewrite(new URL(target, req.url), { status: transient ? 503 : 404 });
  }

  const slug = hit.slug || hit.vendorId;

  // Forward signed identity so the RSC layout skips the client re-fetch (and can trust it).
  const headers = new Headers(req.headers);
  headers.set('x-tenant-id', hit.vendorId);
  headers.set('x-tenant-slug', slug);
  headers.set('x-tenant-theme-version', String(hit.themeVersion));
  headers.set('x-tenant-sig', await sign(hit.vendorId, hit.themeVersion));

  // ROOT_ROUTES (/login etc.) have no /[vendorId] route → do NOT prefix; just attach identity.
  if (ROOT_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`)))
    return NextResponse.next({ request: { headers } });

  // Already slug-prefixed (client nav) → don't double-prefix, but still attach identity.
  if (pathname === `/${slug}` || pathname.startsWith(`/${slug}/`))
    return NextResponse.next({ request: { headers } });

  const url = req.nextUrl.clone();
  url.pathname = `/${slug}${pathname === '/' ? '' : pathname}`;
  return NextResponse.rewrite(url, { request: { headers } });
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|push-sw.js).*)'] };
```

**Coexistence guarantee:** the rewrite target is the literal existing `[vendorId]` segment (`/{slug}{path}`). On the app domain users hit `/{slug}/...` directly with no rewrite; on subdomain/custom hosts the rewrite collapses to the same internal path. The two access modes converge on one route tree.

**`params.vendorId` identity asymmetry (acknowledged):** under a host rewrite, `params.vendorId` is the **slug**; under path access it is whatever the user typed (UUID or slug). Both resolve via `resolveVendorId`/`fetchPublishedPage` (UUID-or-slug). Any cache key derived from this param **must normalize to the UUID** — which is why all our tags use `vendor:{vendorId}` (UUID from `/resolve`/`/brand`), never the raw param.

**`useStoreBasePath` (correction).** The plan previously said "no change needed." That is wrong: `useStoreBasePath` (`packages/lib/src/vendor-context.tsx:86`) hard-initializes `useState('/' + storeKey)` and only flips after a `useEffect` checks `window.location.hostname`. Today the layout is `'use client'`, so there is no real server/client mismatch. After RSC conversion the **server** emits real HTML, so the seed becomes genuinely necessary. **Required change:** add an optional `isCustomHost?: boolean` param to both `VendorProvider` and `useStoreBasePath`; when provided, initialize `useState(isCustomHost ? '' : '/' + storeKey)` so the first client render already matches the server. The hostname `useEffect` stays as a fallback for path access where the prop is absent.

**Security:** `x-tenant-*` headers are trustworthy only because Caddy strips inbound copies (§SSL) **and** the RSC verifies the HMAC. On mismatch or empty signature the RSC ignores them and resolves `params.vendorId` itself.

**New routes:**
- `apps/storefront/src/app/_tenant-unavailable/page.tsx` — neutral "this shop is unavailable" page, returned with **HTTP 404** (genuinely unknown/unverified/not-approved tenant; crawlers must not index it).
- `apps/storefront/src/app/_tenant-error/page.tsx` — "temporarily unavailable, please retry" page, returned with **HTTP 503** (resolver API unreachable). Distinguishing the two prevents a transient API blip from serving a permanent-looking 200 page. Both segments start with `_`, so the `[pageSlug]` dynamic route never matches them; on the app domain they are still directly reachable by URL but render the same neutral content, which is acceptable.

---

## Theme resolution (server-side)

Convert `apps/storefront/src/app/[vendorId]/layout.tsx` from `'use client'` to an RSC. The existing `VendorProvider` / `ThemedShell` / `ThemedTokensCss` client machinery is **reused verbatim** — only the *render location* of the critical bits moves from client `useEffect` to server.

> **Rendering-mode contradiction, resolved (blocker fix).** Reading `headers()` (to consume `x-tenant-*`) opts the route segment into **dynamic rendering**. You cannot both read host headers per request *and* statically cache the layout HTML. **Decision: the layout is dynamic; we do NOT claim static-HTML ISR for it.** What we cache is the **API response** from `GET /api/vendors/:vendorId/brand` via the fetch data-cache (`next: { revalidate, tags }`), which **does** still memoize across requests within TTL and is `revalidateTag`-invalidatable even on a dynamic route. So: the layout re-renders per request (cheap — it is a thin theme merge), but the upstream `/brand` fetch is cached and tag-invalidated. The child server pages (`[vendorId]/page.tsx`, `[pageSlug]/page.tsx`) are **not** forced dynamic by a dynamic parent in Next 14; they keep their own fetch ISR. This must be **confirmed by a build/runtime check** (`next build` output rendering symbols + a runtime log of whether the `/brand` fetch is served from cache), not asserted — add it to the rollout checklist.

> **Dedupe per request.** `generateMetadata` and the layout body both need the vendor brand. Wrap the brand fetch in React `cache()` so a single request makes **one** `/brand` call shared by both. This eliminates the double-fetch the candidates flagged.

### 1. Extract pure theme helpers — new `packages/lib/src/theme-core.ts`
Move `mergeTheme`, `defaultTheme`, `FONT_STACKS`, `REVEAL_DURATION`, and the `VendorTheme`/`VendorBrand` types out of the `'use client'` `vendor-context.tsx` into a **dependency-free, non-`'use client'`** `theme-core.ts` (types + pure functions only — no React, no client imports, or the RSC build breaks). Re-export them from `vendor-context.tsx` so existing client imports keep working unchanged.

### 2. New RSC `layout.tsx`
```tsx
// apps/storefront/src/app/[vendorId]/layout.tsx   (NO 'use client' — dynamic via headers())
import { headers } from 'next/headers';
import { cache } from 'react';
import crypto from 'node:crypto'; // Node runtime here (RSC), unlike middleware
import { mergeTheme, FONT_STACKS } from '@/lib/theme-core';
import { preferredHostUrl } from '@/lib/tenant-host';        // shared SEO helper
import VendorStoreClient from './VendorStoreClient';         // the former layout body, still 'use client'

const getBrand = cache(async (vendorKey: string) => {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/vendors/${vendorKey}/brand`, {
    next: { revalidate: 300, tags: [`vendor:${vendorKey}`] }, // data-cache memoization + tag invalidation
  });
  if (!res.ok) return null;
  const { vendor } = await res.json();
  return vendor;
});

const resolveVendor = cache(async (paramVendorId: string) => {
  const h = headers();
  const id  = h.get('x-tenant-id');
  const ver = h.get('x-tenant-theme-version');
  const sig = h.get('x-tenant-sig');
  let vendorKey = paramVendorId;          // path-based app-domain access
  let isCustomHost = false;
  const secret = process.env.MIDDLEWARE_SECRET;
  if (secret && id && ver && sig) {
    const expect = crypto.createHmac('sha256', secret).update(`${id}.${ver}`).digest('hex');
    if (sig === expect) { vendorKey = id; isCustomHost = true; } // trusted forwarded identity
  }
  // If MIDDLEWARE_SECRET is unset (dev) or sig mismatches, we fall back to params — never throw.
  const vendor = await getBrand(vendorKey);
  return { vendor, isCustomHost };
});

export async function generateMetadata({ params }) {
  const { vendor } = await resolveVendor(params.vendorId);
  if (!vendor) return {};
  const t = mergeTheme(vendor.themeColor ?? '#F1641E', vendor.theme);
  // LAYOUT OWNS ONLY: favicon (icons), themeColor, and the canonical/og:url BASE.
  // Page-level generateMetadata (home/pageSlug/product) remains authoritative for title/description/og:image.
  return {
    themeColor: t.colors.primary,
    icons: t.faviconUrl ? { icon: t.faviconUrl } : undefined,
    alternates: { canonical: preferredHostUrl(vendor, '') },
    openGraph: { url: preferredHostUrl(vendor, '') },
  };
}

export default async function Layout({ children, params }) {
  const { vendor, isCustomHost } = await resolveVendor(params.vendorId);
  if (!vendor) { /* render neutral shell; the route's own notFound path handles 404 */ }
  const t = mergeTheme(vendor.themeColor ?? '#F1641E', vendor.theme);
  const cssVars = {
    '--store-color': t.colors.primary, '--store-accent': t.colors.accent,
    '--store-bg': t.colors.background, '--store-text': t.colors.text,
    '--store-header-bg': t.colors.headerBg, '--store-header-text': t.colors.headerText,
    '--store-footer-bg': t.colors.footerBg, '--store-footer-text': t.colors.footerText,
    '--store-heading-font': FONT_STACKS[t.typography.headingFont],
    '--store-body-font': FONT_STACKS[t.typography.bodyFont],
  } as React.CSSProperties;
  return (
    // CSS vars inlined in SERVER HTML → no FOUC; favicon already in <head> via generateMetadata
    <div className="vendor-themed" style={cssVars}>
      <VendorStoreClient vendor={vendor} isCustomHost={isCustomHost}>
        {children}
      </VendorStoreClient>
    </div>
  );
}
```

### 3. Metadata ownership (reconciliation — fixes the SEO-conflict major)
Next 14 merges layout + page metadata, child overriding overlapping fields. To avoid drift:
- **Layout owns:** `icons` (favicon), `themeColor`, and the **base** `alternates.canonical` + `openGraph.url`.
- **Page-level `generateMetadata` stays authoritative** for `title`, `description`, `openGraph.images`/`twitter` on `[vendorId]/page.tsx` (verified: lines 42–71 already set these from homepage SEO + vendor fallback), `[pageSlug]/page.tsx`, and `products/[id]/page.tsx`. Do **not** duplicate title/og in the layout.
- Each page that needs a path-specific canonical sets `alternates.canonical = preferredHostUrl(vendor, path)` using the **single shared helper** `@/lib/tenant-host.ts` (`preferredHostUrl` + `APP_DOMAIN` + `RESERVED_SUBS`), imported by both the layout and every page — so canonical/host logic cannot drift between levels or between middleware and SEO.

### 4. `VendorStoreClient.tsx` (the former layout body, stays `'use client'`)
Holds `VendorProvider` + `ThemedShell` (Header/CategoryNav/Footer) + `ThemedTokensCss` + `NotificationsProvider` — **moved, not rewritten**. Three changes only:
- Receives `vendor` as a prop instead of `useEffect`-fetching `/api/vendors/{vendorId}` (kills the double round-trip).
- Drops the favicon `useEffect` (server now sets it via `generateMetadata`).
- Passes `isCustomHost` into `VendorProvider`, which seeds `useStoreBasePath` correctly on first render (no hydration flip — see middleware section).

`ThemedTokensCss()` and the `.vendor-themed` scoped Tailwind-token remapping are unchanged — they now re-affirm the server-inlined vars, so there is no flash.

### Data flow after change
```
Host → middleware classify → /api/vendors/resolve (Caddy s-maxage + best-effort Map) → rewrite /{slug}{path} + signed x-tenant-*
     → [vendorId]/layout.tsx (RSC, DYNAMIC): verify HMAC → getBrand() [cache(): one /brand fetch/request, data-cache memoized 300s, tag vendor:{id}]
        → mergeTheme() server-side → inline --store-* + favicon + canonical/og:url base in <head>
        → VendorStoreClient(vendor, isCustomHost) (CLIENT) → VendorProvider → ThemedShell → ThemedTokensCss
```
One server brand fetch per request (deduped, data-cached), no client refetch, no FOUC, correct head metadata for crawlers.

---

## Page-builder integration

**Zero block-pipeline changes.** Nothing in the blocks pipeline is host-aware — it keys on `vendor.id`/slug, which the rewrite preserves.

- `StorefrontHome.tsx`, `[pageSlug]/PageRenderer.tsx`, `products/[id]/ProductDetailClient.tsx`, `cart/page.tsx`, `checkout/page.tsx` all fetch `/api/storefront-pages/{vendor.id}/...` via `useVendor().vendor.id`. Since `VendorProvider` now receives the same `VendorBrand` (server-sourced from `/brand`), `vendor.id` is identical and every client call is unchanged.
- `BlockRenderer`, `BLOCK_REGISTRY`, `RenderContext { scope:'vendor', vendorId }`, `useStoreReveal()`, system-page probing (`/system/PDP|CART|CHECKOUT`), `validateBlocksForKind`, `SYSTEM_PAGE_SLUGS`, `RESERVED_PAGE_SLUGS` — all untouched.
- `fetchPublishedPage` resolves vendor by UUID-or-slug and enforces `status === APPROVED` — the same gate `/api/vendors/resolve` uses, so a subdomain/custom-domain visitor and a path visitor see identical published blocks.
- **Acknowledged asymmetry:** the child `page.tsx` RSC metadata fetches use the literal `params.vendorId` (the **slug** under host rewrites) while client components use `vendor.id` (UUID). Both resolve via `resolveVendorId`. This is fine; just never key a cache on the raw param (we don't — tags use the UUID).

**One additive change for cache correctness:** tag the storefront-pages server fetches that currently use only `revalidate: 60` (in `[vendorId]/page.tsx`, `[pageSlug]/page.tsx`) with `next: { tags: ['vendor:${id}:pages'], revalidate: 300 }` so a page publish invalidates the cached fetch cluster-wide via `revalidateTag` without touching block code.

Optional future enhancement (out of scope): pass server-fetched homepage blocks from the RSC layout into `StorefrontHome` to remove the client block-fetch flash.

---

## Self-hosted domain/SSL + caching

The repo has **no reverse proxy**, `instances: 1` per app, default `next start` (NOT standalone), and `docker-compose.yml` runs Postgres only. This is the part Vercel does for free; we specify it explicitly.

> **Correction:** the storefront does **not** use `output: 'standalone'` (confirmed absent in `apps/storefront/next.config.js`). PM2 runs `node_modules/.bin/next start`, the regular server. Any reasoning that assumed a self-contained standalone bundle is wrong. The custom `cacheHandler` works fine with `next start`; no need to introduce standalone.

### Reverse proxy + TLS — Caddy (new `Caddyfile` at repo root)
Caddy over nginx specifically for **on-demand TLS** — you cannot enumerate arbitrary vendor custom-domain certs at config time.

```caddyfile
{
  on_demand_tls {
    ask http://127.0.0.1:4000/api/vendors/domain-allowed
  }
}

# App domain + all subdomain tenants — ONE wildcard cert via DNS-01.
# Named-host blocks are matched by SNI BEFORE the :443 on_demand catch-all, so app/subdomain
# hosts never fall into on-demand issuance.
store.vrindaonline.com, *.store.vrindaonline.com {
  tls { dns <provider> {env.DNS_API_TOKEN} }
  reverse_proxy 127.0.0.1:3003 {     # add more upstreams here when scaling out (see Caching)
    header_up -x-tenant-id           # strip client-forged tenant headers (defense-in-depth)
    header_up -x-tenant-slug
    header_up -x-tenant-theme-version
    header_up -x-tenant-sig
  }
}

api.vrindaonline.com    { reverse_proxy 127.0.0.1:4000 }
vrindaonline.com, www.vrindaonline.com { reverse_proxy 127.0.0.1:3000 }
vendor.vrindaonline.com { reverse_proxy 127.0.0.1:3001 }
admin.vrindaonline.com  { reverse_proxy 127.0.0.1:3002 }

# Custom vendor domains — cert minted on first TLS handshake, gated by the ask endpoint.
# This catch-all is reached ONLY for SNIs that match none of the named blocks above.
:443 {
  tls { on_demand }
  reverse_proxy 127.0.0.1:3003 {
    header_up -x-tenant-id
    header_up -x-tenant-slug
    header_up -x-tenant-theme-version
    header_up -x-tenant-sig
  }
}
```

- **Wildcard** `*.store.vrindaonline.com` needs a **DNS-01** challenge (HTTP-01 cannot do wildcards) → Caddy DNS-provider plugin + `DNS_API_TOKEN`. One cert covers every subdomain tenant, zero per-vendor provisioning. DNS: a wildcard `*.store` A/AAAA record at the host IP.
- **Block-ordering / SNI proof (addresses the major):** Caddy matches the most-specific named site block by SNI first. `store.*` and `*.store.*` (named, wildcard cert) match all app/subdomain hosts; the four app subdomains match their named blocks; only truly-unknown SNIs reach the `:443 { on_demand }` catch-all. Verify in the rollout checklist that hitting `jhumkaya.store.vrindaonline.com` uses the wildcard cert (not on-demand) and that `admin.`/`vendor.`/`api.` are served by their own blocks.
- **Custom domains** use `on_demand_tls` gated by `GET /api/vendors/domain-allowed` (§API #5). Caddy refuses to issue on any non-2xx. The endpoint is rate-limited and negative-cached to blunt SNI-spray abuse; certs are only issued for `VERIFIED` domains whose CNAME/A already points at us (no dangling-domain minting).
- Caddy strips inbound `x-tenant-*`, making the middleware HMAC trustworthy. **Bind every storefront process to `127.0.0.1` only, never `0.0.0.0`**, so the only path to Next is through Caddy.
- PM2 layout in `ecosystem.config.js` is unchanged except env vars. Add `caddy` (and, on scale-out, `redis`) to `docker-compose.yml` for ops convenience.

### Caching & cross-process invalidation

Two caches:

**Single-process (ship first):** the middleware host→vendor `Map` (best-effort, 30s TTL, **not** a correctness dependency) + the API `Cache-Control: s-maxage=300` fronted by Caddy (the real durable cache) + the Next fetch data-cache (`revalidate: 300`, tags) for `/brand` and storefront-pages. A vendor edit is visible within 30–300s, immediately on tag invalidation. **No Redis required to launch.**

**Event-driven invalidation (build now, cheap):** new storefront Route Handler `apps/storefront/src/app/api/revalidate/route.ts`, secret-guarded:
```ts
import { revalidateTag } from 'next/cache';
export async function POST(req: Request) {
  if (!process.env.REVALIDATE_SECRET ||
      req.headers.get('x-revalidate-secret') !== process.env.REVALIDATE_SECRET)
    return new Response('forbidden', { status: 403 });
  const { tags } = await req.json();
  for (const t of tags ?? []) revalidateTag(t);
  return Response.json({ ok: true });
}
```
Reachable because middleware Bucket 1 lets `/api/*` through. The API calls it via `notifyStorefrontRevalidate` (§API #6) on every theme/page/domain mutation. First `revalidateTag` usage in the codebase.

**Scale-out — multi-process, the CORRECT recipe (fixes the cluster-flip blocker):**
> **Do NOT use PM2 `exec_mode: 'cluster'` on `next start`.** PM2 cluster mode forks a JS entry via Node's cluster module to share one socket; `node_modules/.bin/next start` is a CLI shim, not a clusterable JS entry, and `next start` already manages its own concurrency — clustering it can double-bind the port or fail. Instead:
1. Run **N PM2 fork-mode storefront instances**, each on a distinct port (`3003`, `3013`, `3023`, …) — duplicate the storefront block in `ecosystem.config.js` with a per-instance `PORT`. (`next start -p $PORT`.)
2. Point Caddy's storefront `reverse_proxy` at **all** upstreams (`127.0.0.1:3003 127.0.0.1:3013 …`); Caddy load-balances.
3. Add `apps/storefront/cache-handler.js` (Redis-backed `get/set/revalidateTag`) and wire it in `next.config.js`:
   ```js
   module.exports = {
     transpilePackages: ['@jewel/ui', '@jewel/lib'],
     images: { remotePatterns: [{ protocol: 'https', hostname: 'res.cloudinary.com' }] },
     cacheHandler: require.resolve('./cache-handler.js'),
     cacheMaxMemorySize: 0, // force the shared handler so all processes share one cache
   };
   ```
4. Set `STOREFRONT_INTERNAL_URLS` on the API to the full comma-separated upstream list **and** set `REDIS_URL` on every storefront process.

> **Generalized warning to document inline in `ecosystem.config.js`:** **ANY** multi-process storefront deployment (multi-port fork — the only supported scale path) **requires** the Redis `cacheHandler`, because each process otherwise owns a separate `.next/cache` and `revalidateTag` only fires in the process that received the POST. With Redis the handler propagates the tag to all processes; without it, set `STOREFRONT_INTERNAL_URLS` to every upstream so `notifyStorefrontRevalidate` hits them all (TTL self-heals any miss). The trigger for needing this is **process count > 1**, not load.

### Build-time env caveat
`NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_APP_DOMAIN` are baked at `next build`. Changing them (or `APP_DOMAIN`, which freezes the middleware's subdomain-vs-customdomain decision and the SEO `preferredHostUrl`) requires `npm run build:all`, not just `pm2:restart`. A **vendor self-service domain change does NOT need a rebuild** (it's DB + Caddy on-demand TLS). Document in the deploy runbook.

### New env vars
- API (`apps/api/.env`): `STOREFRONT_INTERNAL_URLS` (comma-separated upstream list), `REVALIDATE_SECRET`, `MIDDLEWARE_SECRET`, `INGRESS_IPS` (comma-separated A-record targets for apex verification).
- Storefront (`apps/storefront/.env`): `MIDDLEWARE_SECRET` (same value as API), `REVALIDATE_SECRET`, and on scale-out `REDIS_URL`. `NEXT_PUBLIC_APP_DOMAIN` already `store.vrindaonline.com`.
- Caddy: `DNS_API_TOKEN`.

---

## SEO

### Canonical / preferred-host precedence
The same store is reachable at up to three hosts. Canonical precedence **verified custom domain > subdomain > app-domain path**; point all variants at it. Single shared helper `apps/storefront/src/lib/tenant-host.ts` (also exporting `APP_DOMAIN`/`RESERVED_SUBS` for the middleware to import — single source of truth, no drift):
```ts
export function preferredHostUrl(vendor, path: string) {
  if (vendor.customDomainStatus === 'VERIFIED' && vendor.customDomain)
    return `https://${vendor.customDomain}${path}`;
  if (vendor.subdomain)
    return `https://${vendor.subdomain}.${process.env.NEXT_PUBLIC_APP_DOMAIN}${path}`;
  return `https://${process.env.NEXT_PUBLIC_APP_DOMAIN}/${vendor.slug ?? vendor.id}${path}`;
}
```
Set `alternates.canonical` and `openGraph.url` to this in the RSC layout (base) and in each page's `generateMetadata` (path-specific). Once a vendor has a verified custom domain, **301-redirect the app-domain `/{slug}` path to the preferred host** in middleware Bucket 2 (only for that vendor) to consolidate link equity — gate this on a brand lookup to avoid redirecting un-migrated stores.

### Per-tenant `robots.txt` and `sitemap.xml`
Both new, host-aware (Host header selects the tenant), in `apps/storefront/src/app/`:
- **`robots.ts`** — reads `headers().get('host')`, resolves via `/api/vendors/resolve`, returns `allow: '/'` + `sitemap: 'https://{host}/sitemap.xml'`. On the bare app domain, disallow indexing of `/{slug}` duplicate paths (they canonicalize to the tenant host).
- **`sitemap.ts`** — resolves tenant from host, calls `GET /api/vendors/:id/sitemap-entries` (§API #7), emits absolute URLs on the tenant's **preferred host**. `revalidate: 3600`, tag `vendor:{id}:pages` so publishes refresh it. One dynamic route serves every tenant its own sitemap.

### favicon / theme-color
Handled server-side in the layout `generateMetadata`, so social cards and browser chrome are correct on first byte.

---

## Local development

The new paths are unreachable on `*.localhost` (middleware treats `.localhost` as app domain, Bucket 2), Caddy/on-demand TLS can't run in dev, and an unset `MIDDLEWARE_SECRET` must not crash anything. Workflow:

1. **Test subdomains:** use a real wildcard dev domain that resolves to `127.0.0.1` — e.g. set `NEXT_PUBLIC_APP_DOMAIN=lvh.me` (or `localtest.me`), then visit `jhumkaya.lvh.me:3003`. Because the suffix is not `.localhost`, Bucket 3 fires. (`/etc/hosts` entries also work for a fixed set.) Document that `*.localhost` is intentionally app-domain and won't exercise the subdomain branch.
2. **HMAC no-op fallback:** `sign()` returns `''` when `MIDDLEWARE_SECRET` is unset; the RSC `resolveVendor` only trusts forwarded identity when `secret && sig === expect`, otherwise falls back to `params.vendorId`. **Neither side ever calls HMAC with an undefined secret**, so nothing throws in dev. (This guard is also why a dev hitting a page with no middleware run still renders.)
3. **Simulate a VERIFIED custom domain:** no Caddy/DNS needed — manually set `customDomain` + `customDomainStatus = 'VERIFIED'` in the DB (Prisma Studio), add a `/etc/hosts` entry, and hit it over plain HTTP against `:3003` (TLS is Caddy's job in prod only).
4. **Revalidate in dev:** leave `STOREFRONT_INTERNAL_URLS` unset → `notifyStorefrontRevalidate` no-ops (TTL handles freshness). If you do test it, set `REVALIDATE_SECRET` on both sides or the route 403s every call.

### Preview / staging
Each environment needs **its own build** with the correct `NEXT_PUBLIC_APP_DOMAIN` (it's build-baked). On a staging host like `staging-store.vrindaonline.com` built with `APP_DOMAIN=staging-store.vrindaonline.com`, subdomain classification works; built with the prod `APP_DOMAIN` it would fall into the custom-domain bucket and 404. Bare-IP/preview hostnames always fall into Bucket 4 → `/api/vendors/resolve?by=domain` → 404 → `_tenant-unavailable`. Optionally allowlist an internal health/preview host in middleware that bypasses tenant resolution.

### Reserved-label parity
`RESERVED_SUBDOMAINS` is exported once from `apps/api/src/lib/vendor-slug.ts` (= `RESERVED_VENDOR_SLUGS` ∪ `{www, api, admin, vendor, store}`) and is the API-side validator for `POST /me/subdomain`. The middleware's `RESERVED_SUBS` set must stay in sync; keep the infra labels identical in both and add a comment cross-referencing the source so they cannot drift.

---

## Migration / rollout steps (ordered)

1. **Prisma** — add `subdomain`, `customDomainStatus`, `customDomainToken`, `customDomainVerifiedAt`, `themeVersion` + `DomainStatus` enum to `Vendor`; `npm run db:migrate`. Run backfill (`subdomain = slug` for APPROVED vendors **with non-null slug**; skip null-slug).
2. **API** — add (in correct order, all on `vendorRouter`, the static/`/brand`/`sitemap-entries` routes **before** `router.get('/:vendorId')` at line 788): `/resolve`, `/domain-allowed`, `/:id/brand`, `/:id/sitemap-entries`, the custom-domain/subdomain vendor routes (real `requireAuth, requireRole(Role.VENDOR)` + `findUnique({ where: { userId } })` pattern), `themeVersion` bumps, `apps/api/src/lib/revalidate.ts`, and `RESERVED_SUBDOMAINS` in `vendor-slug.ts`. Deploy API first — purely additive, backward-compatible.
3. **Shared lib** — extract `packages/lib/src/theme-core.ts` (pure, dependency-free), re-export from `vendor-context.tsx`; add the `isCustomHost?` param to `VendorProvider` + `useStoreBasePath`. No behavior change for path access.
4. **Storefront app** — add `src/lib/tenant-host.ts` (shared `APP_DOMAIN`/`RESERVED_SUBS`/`preferredHostUrl`); rewrite `middleware.ts` (Edge-safe Web Crypto HMAC, 4-bucket, best-effort cache, 404-vs-503 fallback); convert `[vendorId]/layout.tsx` to RSC (dynamic, `cache()`-deduped `/brand` fetch, layout-owns-favicon/themeColor/canonical-base) + add `VendorStoreClient.tsx`; add `_tenant-unavailable/page.tsx` (404), `_tenant-error/page.tsx` (503), `api/revalidate/route.ts`, `robots.ts`, `sitemap.ts`; tag the page fetches; set `MIDDLEWARE_SECRET`/`REVALIDATE_SECRET`. `npm run build:all`, `pm2:restart vrindaonline-storefront`. **Verify in `next build` output that `[vendorId]` is dynamic and that the `/brand` fetch is served from the data-cache on the second request** (resolves the dynamic-vs-cache question empirically).
5. **Infra** — add `Caddyfile` (wildcard DNS-01 + on-demand TLS + header strip), DNS wildcard `*.store` record + `DNS_API_TOKEN` + `INGRESS_IPS`, bind storefront to `127.0.0.1`, point Caddy at PM2 ports. Verify: subdomain renders themed + correct OG using the **wildcard** cert; app subdomains use their own blocks; a custom domain mints a cert only after VERIFIED.
6. **Vendor dashboard** (`apps/vendor`, follow-up) — UI for the subdomain field + custom-domain add/verify flow surfacing the TXT + CNAME/A records (apex vs subdomain) and a verify button.
7. **Scale-out (deferred, when a 2nd storefront process is needed)** — add `cache-handler.js` + `next.config.js` `cacheHandler` + `cacheMaxMemorySize: 0`, `REDIS_URL`, Redis in `docker-compose.yml`, duplicate the storefront `ecosystem.config.js` block on ports `3013`/`3023`/… (**fork mode, NOT cluster**), point Caddy at all upstreams, set `STOREFRONT_INTERNAL_URLS` to all of them. Do these together.
8. **Session upgrade (deferred, subdomains only)** — migrate auth to an `httpOnly` cookie scoped `Domain=.store.vrindaonline.com`, folding in the localStorage-XSS hardening. Custom domains remain session islands.

---

## Risks

- **Header-spoofing if Caddy strip is misconfigured.** Omitting `header_up -x-tenant-*` lets a direct request to `127.0.0.1:3003` forge identity. Mitigated by the HMAC (`MIDDLEWARE_SECRET` is server-only, never reaches the browser) **and** by binding the storefront to `127.0.0.1`. The strip is defense-in-depth — verify in the deploy checklist.
- **Edge/Node HMAC divergence.** The Web-Crypto (middleware) and `node:crypto` (RSC) implementations must produce byte-identical hex. A mismatch silently disables the trusted-identity fast path (RSC falls back to `params`) — not a security hole, but a perf regression. Covered by the shared agreement test.
- **`headers()` makes the layout dynamic.** Every storefront request runs a (thin) RSC render + a `/brand` fetch. The fetch data-cache + Caddy `s-maxage` bound API load; the middleware `Map` is a best-effort extra. A thundering herd on cold cache (mass new tenants / restart) could spike the API — acceptable at current scale; Redis + multi-process smooths it post-scale. **Confirm the data-cache actually serves `/brand` from cache on a dynamic route during rollout** (step 4) rather than assuming it.
- **Cold middleware Map + cold data-cache on restart.** Both can be cold simultaneously under load. The `/resolve` and `/brand` endpoints are tiny and `s-maxage`-cached at Caddy, which absorbs the herd; no correctness dependency on the Map.
- **`NEXT_PUBLIC_*` build-bake.** Domain/`APP_DOMAIN` changes need a full rebuild. A vendor self-service domain change does **not**.
- **DNS-01 plugin coupling.** The wildcard cert needs a Caddy build including your DNS provider's plugin. Misconfigured token → subdomains lose TLS while custom domains (on-demand) still work — split failure mode; monitor cert renewal separately.
- **Multi-process without Redis.** Bumping storefront process count without the Redis `cacheHandler` (or without `STOREFRONT_INTERNAL_URLS` listing every upstream) silently breaks cross-process invalidation. Gate behind a runbook step + the inline `ecosystem.config.js` warning. (Note: this is the multi-port fork path; PM2 cluster on `next start` is explicitly not supported.)
- **on-demand TLS abuse window.** Even gated, a flood of TLS handshakes for unknown SNIs hits `domain-allowed` per handshake. Mitigated by the in-process rate limit + negative cache on that endpoint; keep it fast.
- **Apex custom domains.** CNAME-at-apex is illegal; verification accepts an A/AAAA record at `INGRESS_IPS` instead. If a vendor's host moves, `INGRESS_IPS` and any cached verifications must be revisited.
- **Cross-host session islands (now in-scope, not a risk to hide).** Phase 1 customers re-authenticate per tenant host and carts don't span hosts. Acceptable under the single-vendor-cart rule; the Phase-2 parent-domain cookie covers subdomains only.
- **Subdomain ↔ slug drift.** `subdomain` is independent of `slug` by policy; a slug edit does not move the subdomain (avoids breaking live URLs).

**Files touched:** `apps/api/prisma/schema.prisma`; `apps/api/src/routes/vendors.ts` (ordered inserts); `apps/api/src/routes/vendorPages.ts`; `apps/api/src/lib/revalidate.ts` (new); `apps/api/src/lib/vendor-slug.ts` (export `RESERVED_SUBDOMAINS`); `packages/lib/src/theme-core.ts` (new) + `packages/lib/src/vendor-context.tsx` (`isCustomHost` param); `apps/storefront/src/lib/tenant-host.ts` (new); `apps/storefront/src/middleware.ts`; `apps/storefront/src/app/[vendorId]/layout.tsx` + `VendorStoreClient.tsx` (new); `apps/storefront/src/app/_tenant-unavailable/page.tsx`, `_tenant-error/page.tsx`, `api/revalidate/route.ts`, `robots.ts`, `sitemap.ts` (all new); `apps/storefront/next.config.js` + `cache-handler.js` (scale-out); `Caddyfile` (new); `ecosystem.config.js`; `docker-compose.yml`; `.env` files.

**Unchanged:** entire `[vendorId]/**` route *behavior*, all page-builder blocks (`BlockRenderer`, `BLOCK_REGISTRY`, every renderer), `ThemedShell`/`ThemedTokensCss`, `resolveVendorId`, `/api/vendors/by-domain/:domain` (login flow), `/api/vendors/:vendorId` (home product grid), cart/orders/account vendor-filtering.