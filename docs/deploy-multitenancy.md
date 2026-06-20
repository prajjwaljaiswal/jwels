# Multi-tenant storefront — deployment runbook

How to put the per-vendor storefront (`apps/storefront`) behind TLS so vendors are reachable
at **subdomains** (`{slug}.store.vrindaonline.com`) and **custom domains** (`jhumkaya.com`).
Architecture background: [storefront-multitenancy-plan.md](./storefront-multitenancy-plan.md).

This is the self-hosted (PM2) equivalent of what Vercel does automatically. No app code here —
just DNS, env, Caddy, and PM2.

---

## 1. How requests flow

```
Browser → Caddy :443 (TLS terminate) → 127.0.0.1:3003 (storefront, next start)
        → middleware.ts classifies Host (app / subdomain / custom)
        → GET /api/vendors/resolve → rewrite "/x" → "/<slug>/x" into the [vendorId] tree
        → [vendorId]/layout.tsx (RSC) fetches /brand, renders the theme server-side
```

- **App domain / first-party apps** (`store.`, `api.`, `www.`, `vendor.`, `admin.`) → named Caddy blocks, normal certs.
- **Vendor subdomains** (`*.store.vrindaonline.com`) → one **wildcard cert** (DNS-01).
- **Vendor custom domains** → **on-demand TLS**, gated by the API so only VERIFIED domains get a cert.

---

## 2. DNS

| Record | Type | Value | Purpose |
|---|---|---|---|
| `store` | A / AAAA | server IP | app domain |
| `*.store` | A / AAAA | server IP | all vendor subdomains |
| `api`, `www`, `vendor`, `admin` | A | server IP | first-party apps |

**Vendor custom domains** (the vendor sets these on their own DNS, surfaced by the dashboard flow):
- Subdomain custom domain (`shop.brand.com`): `CNAME → store.vrindaonline.com`
- Apex custom domain (`brand.com`): `A → <INGRESS_IP>` (CNAME is illegal at the apex)
- Both also need a `TXT _vrinda-verify.<domain> = <token>` record for ownership verification.

The wildcard `*.store` cert needs a **DNS-01** challenge (HTTP-01 can't do wildcards), which is
why Caddy needs your DNS provider's API token (below).

---

## 3. Environment variables

Copy the `.env.example` files and fill these in. See `apps/api/.env.example` and
`apps/storefront/.env.example` for the full set.

**API (`apps/api/.env`)**

| Var | Example | Notes |
|---|---|---|
| `APP_DOMAIN` | `vrindaonline.com` | Root domain. CNAME target offered to vendors = `store.<APP_DOMAIN>`. |
| `REVALIDATE_SECRET` | `openssl rand -hex 32` | Must equal the storefront's. Unset = on-demand revalidation off (TTL only). |
| `STOREFRONT_INTERNAL_URLS` | `http://127.0.0.1:3003` | Every storefront process URL, comma-separated. |
| `INGRESS_IPS` | `203.0.113.10` | Public IP(s) for apex custom-domain A records, comma-separated. |

**Storefront (`apps/storefront/.env`)**

| Var | Example | Notes |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `https://api.vrindaonline.com` | Read server- and client-side. |
| `NEXT_PUBLIC_APP_DOMAIN` | `store.vrindaonline.com` | Subdomain root. **Baked at build** — see §6. |
| `REVALIDATE_SECRET` | (same as API) | Server-only; guards `/api/revalidate`. |

**Caddy**

| Var | Notes |
|---|---|
| `CF_API_TOKEN` | DNS-provider API token for the wildcard DNS-01 challenge (swap for your provider). |

> Note the two different "app domain" values: the API's `APP_DOMAIN` is the **root**
> (`vrindaonline.com`); the storefront's `NEXT_PUBLIC_APP_DOMAIN` is the **subdomain root**
> (`store.vrindaonline.com` = `store.<APP_DOMAIN>`). They must stay consistent.

---

## 4. Caddy

1. Build/install Caddy **with your DNS provider plugin**:
   ```bash
   xcaddy build --with github.com/caddy-dns/cloudflare   # swap provider as needed
   ```
2. Use the repo-root [`Caddyfile`](../Caddyfile). Adjust the `tls { dns ... }` line + token.
3. Run Caddy (it terminates TLS and proxies to the PM2 apps on 127.0.0.1).

How custom-domain certs are gated: on an unknown SNI, Caddy calls
`GET /api/vendors/domain-allowed?domain=<host>`; the API returns `200` only for an
APPROVED + VERIFIED custom domain, else a non-2xx (no cert). That endpoint is fast and
should be rate-limited at the edge if you expect SNI-spray abuse.

---

## 5. PM2

Keep using `ecosystem.config.js` + `npm run build:all && npm run pm2:restart`.

**Recommended hardening (apply once Caddy is in front):** bind each Next app to loopback so
the only path in is through Caddy. Change the storefront `args` in `ecosystem.config.js`:

```diff
- args: 'start -p 3003',
+ args: 'start -p 3003 -H 127.0.0.1',
```

(Do the same for web/vendor/admin/api as desired.) Do this **after** Caddy is deployed — binding
to `127.0.0.1` makes the app unreachable directly, which is the point, but breaks direct access
until the proxy is up. This is defense-in-depth only: the app no longer trusts forwarded headers
(the RSC resolves the vendor by its routed param), so there is no spoofing surface.

---

## 6. Build-bake caveat

`NEXT_PUBLIC_*` values (incl. `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_APP_DOMAIN`) are inlined at
`next build`. Changing any of them requires a **rebuild** (`npm run build:storefront` →
`pm2 restart vrindaonline-storefront`), not just a restart.

A **vendor adding/verifying a custom domain does NOT need a rebuild** — it is DB state +
Caddy on-demand TLS only.

Each environment (staging/prod) needs its own build with the correct `NEXT_PUBLIC_APP_DOMAIN`,
or host classification misfires (a staging host built with the prod domain falls into the
custom-domain bucket and 404s).

---

## 7. Vendor custom-domain flow (API, already implemented)

1. `POST /api/vendors/me/custom-domain { domain }` → stores it `PENDING`, returns the DNS records
   to add (TXT verify token + CNAME/A).
2. Vendor adds the records at their registrar.
3. `POST /api/vendors/me/custom-domain/verify` → checks the TXT token (ownership) **and** that the
   CNAME points at `store.<APP_DOMAIN>` or the A record points at an `INGRESS_IPS` entry (routing).
   On success → `VERIFIED`, after which Caddy will mint a cert on first request.

Subdomains have no DNS step: `POST /api/vendors/me/subdomain { subdomain }` sets it directly
(covered by the wildcard cert). The dashboard UI for these flows is the next phase.

---

## 8. Scaling out (deferred — only when you run >1 storefront process)

A single `next start` process needs nothing extra. To run multiple:

1. Add more PM2 **fork-mode** storefront instances on distinct ports (`3013`, `3023`, …) — duplicate
   the storefront block in `ecosystem.config.js` with a different `PORT`. **Do NOT use PM2
   `exec_mode: 'cluster'` on `next start`** (the CLI shim doesn't cluster cleanly).
2. Point Caddy's storefront `reverse_proxy` at all upstreams: `reverse_proxy 127.0.0.1:3003 127.0.0.1:3013 …`.
3. Add a Redis `cacheHandler` (`apps/storefront/cache-handler.js` + `next.config.js` `cacheHandler` +
   `cacheMaxMemorySize: 0`), set `REDIS_URL` on every storefront process, and list **all** upstreams
   in the API's `STOREFRONT_INTERNAL_URLS`. Without a shared cache handler, `revalidateTag` only
   fires in the one process that received the POST.

---

## 9. Smoke test after deploy

- `https://store.vrindaonline.com/<slug>` → vendor store renders, themed.
- `https://<slug>.store.vrindaonline.com/` → same store, clean URLs, served by the **wildcard** cert.
- An unknown subdomain → 404 "Shop unavailable" (not indexed).
- A VERIFIED custom domain → cert minted on first hit, store renders.
- `https://<host>/sitemap.xml` and `/robots.txt` → per-tenant, host-relative URLs.
- Edit a vendor's theme / publish a page → change visible within ~5 min (TTL) or immediately
  (on-demand revalidation, if `REVALIDATE_SECRET` + `STOREFRONT_INTERNAL_URLS` are set).
