# Marketing Feature — Implementation Plan (vrindaonline multi-vendor jewellery marketplace)

> Scope: enable vendors and platform admin to market products on **Instagram, Facebook, and Google** via product-feed syndication (Meta Catalog + Google Merchant Center), conversion tracking (Meta Pixel + CAPI, Google Tag + server upload), and (later) campaign/organic-post management. Grounded in the existing Express + Prisma API (`apps/api`), the Next.js apps (`apps/web`, `apps/storefront`, `apps/vendor`), and the field-encryption / background-job / order-confirmation patterns already in the codebase.

---

## 1. Executive summary & recommended approach

**What to build:** A thin **Marketing hub** inside the existing Express API (`apps/api/src/routes/marketing.ts` + `apps/api/src/lib/marketing/*`) plus a **Marketing nav section** in the vendor dashboard. The core is a single **canonical product-feed service** (Google product spec) that *both* Meta and Google consume, wired to existing `Product` data, served at a stable URL, refreshed by a background job that follows the existing `apps/api/src/jobs/*.ts` `setInterval` pattern. On top of the feed sit conversion tracking and (later) campaign management.

**Phase 1 is deliberately narrowed** (see §1a) so an MVP ships *before* the multi-week Meta/Google review backlog clears, rather than bundling feed + Meta batch + Merchant + pixels + CAPI + Google upload + OAuth + full vendor UI behind those reviews.

**Key build-vs-buy decisions:**

| Pillar | Decision | Why |
|---|---|---|
| **Product feed → Meta & Google** | **Build** (own feed generator) | We already own the entire `Product`/`Vendor`/`ProductVariationCombo` data in Postgres. A feed aggregator (Channable/DataFeedWatch/Feedonomics) bills per-account and removes marketplace-level control. One canonical feed is cheap and is the documented marketplace pattern (one catalog + per-vendor `custom_label_0` / `external_seller_id`). |
| **Conversion tracking (Pixel + CAPI / Tag + upload)** | **Build** | We own the storefront funnel (`apps/web`, `apps/storefront`) **and both payment confirmation paths** — the prepaid choke point `confirmOrderPaid()` *and* the separate COD handler (see §8). This is the only place a marketplace can solve attribution; it must be built, can't be rented. |
| **Organic IG/FB posting + scheduling** | **Defer to Phase 2; then consider Ayrshare** | IG requires per-account App Review + Business/Creator account + Page Publishing Auth. Highest time-sink for least Phase-1 revenue. Ayrshare (one profile per `Vendor`) collapses many OAuth integrations into one. |
| **Paid ads (campaign creation)** | **Defer to Phase 2/3; operator-run via MCP first** | The connected **Meta Ads MCP** and **Google Ads MCP** servers let an *operator* run platform campaigns immediately with zero new code. Programmatic per-vendor campaign builders need Business Verification + Advanced Access (`ads_management`) + Google dev-token Standard — weeks of review. |

### 1a. Phase 1 MVP — narrowed scope

Phase 1 ships against **one platform-owned Meta catalog** and **one Google Merchant advanced account (MCA)**, segmented per vendor by `custom_label_0 = vendorId` / `external_seller_id = vendorId`. Phase 1 includes only:

1. **Canonical feed** (`feed.xml`, public + hardened) — including `googleProductCategory` mapping and `ProductVariationCombo` variant rows, both of which are **load-bearing for jewellery approval** and are *in* Phase 1 (not deferred).
2. **Google Merchant API v1 sync** (server-to-server `products.insert` via service account) — primary syndication path.
3. **Client pixels/tags** (Meta Pixel + GA4) across both storefronts, including consent gating.
4. **Server-side `Purchase`** from **both** the prepaid (`confirmOrderPaid()`) and COD paths, with correct **per-vendor value allocation**.
5. **Vendor UI:** Connect Meta/Google, Catalog status, Tracking, and the listing-editor feed-fields step.
6. **Consent schema + UI** and **token-refresh** logic — funded in Phase 1, not assumed.

**Deferred out of Phase 1:** Meta Catalog `items_batch` real-time upsert (Phase 1 uses Meta's *scheduled feed fetch* of `feed.xml` only — no batch code), Google Ads server-side conversion upload, all campaign/ad and organic-posting features, per-vendor pixels/catalogs. This keeps Phase 1 shippable while Meta Business Verification / App Review run in parallel.

---

## 2. Feature scope — three pillars

### Pillar A — Catalog / feed sync to Meta & Google

| | Platform-level | Per-vendor |
|---|---|---|
| Catalog ownership | **One platform-owned Meta catalog**; **one Google MCA** | Each vendor's products tagged `custom_label_0 = vendorId` (Meta Product Set) / `external_seller_id = vendorId` (Google multi-seller sub-account) |
| Feed generation | One canonical feed service reads `Product` filtered to publishable products only (see §2a) joined to `Vendor` | A vendor-scoped slice (`?vendor=<id>`) of the same feed endpoint |
| Sync mechanism (Phase 1) | Meta: **scheduled fetch** of `feed.xml`. Google: server-to-server `products.insert` (Merchant API v1) on the nightly reconcile + on product mutation | — |
| Sync mechanism (Phase 2) | Meta `items_batch` real-time upsert/delete on product mutation | Incremental diffs via `ProductFeedState.lastSyncedAt` |

- Canonical feed = **Google Merchant product spec** (the de-facto base spec). Meta consumes the same record via a thin transform.
- Required fields both platforms need: `id`, `title`, `description`, `link`, `image_link`, `availability`, `price`, `condition`, `brand`, `google_product_category`, `item_group_id` (variants), and `custom_label_0` / `external_seller_id` (vendor segmentation).

#### 2a. Feed eligibility / hardening (closes the "ACTIVE+isActive only" gap)

The public `feed.xml` MUST emit only genuinely publishable offers. Include a product **only if all** hold:

- `Product.status === 'ACTIVE'` **and** `Product.isActive === true`;
- status is **not** any of `DRAFT`, `PENDING_REVIEW`, `INACTIVE`, `REJECTED` (explicit exclusion guard, defence-in-depth against new status values);
- `Product.feedExcluded === false` (vendor opt-out);
- the owning `Vendor` is approved/active (reuse the same approval gate the public storefront uses);
- the record passes **field-level validation** (§2b) — products missing required attributes are emitted to `ProductFeedState` as `ERROR`, not silently into the feed.

The endpoint is **rate-limited** (reuse the existing rate-limiter pattern from `checkoutLimiter` in `orders.ts`; e.g. a dedicated `feedLimiter`), served with `Cache-Control` + `ETag`, and regenerated/invalidated on product mutation. A platform secret token (`?key=` or header) is *optional* for the vendor-scoped slice but the full feed stays public (Meta/Google fetch anonymously).

#### 2b. Field-level validation & price/availability drift

Meta and Google disable Shops/ads on significant **catalog-vs-live-PDP drift**. To prevent it:

- **Availability** is always derived from live stock at feed-build time: combo-level `ProductVariationCombo.stock` for variant rows, else `Product.stockQuantity` → `in_stock` / `out_of_stock`. Never cache a stale availability.
- **Price** is computed from the live source of truth, honouring **combo price inheritance**: `ProductVariationCombo.price` is `Decimal?` where **null means inherit `Product.price`** — the feed builder MUST resolve `combo.price ?? product.price`, mirroring the `codPriceFor` logic in `orders.ts`. Variant rows carry their resolved price, not the parent's.
- A lightweight **drift check** in the nightly reconcile compares the last-synced price/availability (persisted on `ProductFeedState`) against the freshly computed values and re-pushes on mismatch, so the catalog never diverges from what a buyer sees on the PDP/combo selector.

### Pillar B — Conversion tracking

| Event | Where (client) | Where (server) | Level |
|---|---|---|---|
| `ViewContent` / `view_item` | PDP load (`apps/web` + `apps/storefront` product pages) | — | Platform pixel |
| `AddToCart` / `add_to_cart` | `packages/lib/src/cart.ts` add action | — | Platform |
| `InitiateCheckout` / `begin_checkout` | checkout page mount | — | Platform |
| **`Purchase`** | order-confirmation page | **prepaid → `confirmOrderPaid()`; COD → COD handler (both call `fireConversionEvents`)** | **Platform; one row per vendor per order** |
| **Refund / Cancel** | — | REFUNDED/CANCELLED transitions → Meta CAPI refund + Google conversion adjustment (§8c) | Platform |

- Meta: Pixel (browser) **+** Conversions API (server) writing to one dataset; dedup via shared `event_id` (= `order.id`). The browser `Purchase` and the server `Purchase` MUST carry the **same** `event_id`.
- Google (Phase 2): Google Tag/GA4 `purchase` for free-listing/analytics **+** server-side `UploadClickConversions` for paid Shopping/PMax. No web↔server auto-dedup on Google — pick **one** path per conversion (server-side for the verified payment).

### Pillar C — Campaign & organic-post management

| | Platform-level (MVP-friendly) | Per-vendor (Phase 3) |
|---|---|---|
| Paid ads | Operator runs Advantage+ Catalog / PMax via the **connected MCP servers**, scoped by per-vendor Product Set | Vendor self-serve "boost this product" → programmatic Meta Marketing API / Google Ads API under platform System User / MCC |
| Organic IG/FB posts | — | Per-vendor scheduled posts (Ayrshare profile per `Vendor`); scheduler job follows `jobs/*.ts` pattern; AI captions via `apps/api/src/lib/ai.ts` |

---

## 3. Architecture

```
                          ┌──────────────────────────────────────────────────────────┐
                          │                  apps/api  (Express)                       │
                          │                                                            │
  Product / Vendor /      │   src/lib/marketing/                                       │
  ProductVariationCombo   │   ├─ feed.ts          canonical record builder + validate  │
  (Prisma / Postgres) ───────┤  ├─ googleMerchant.ts Merchant API v1 products.insert    │
                          │   ├─ metaCatalog.ts   scheduled-feed reg (Ph1) / batch (Ph2)│
                          │   ├─ capi.ts          Meta Conversions API (hash + send)    │
                          │   ├─ conversions.ts   fireConversionEvents + per-vendor split│
                          │   ├─ tokens.ts        OAuth token refresh (Google/Meta)     │
                          │   ├─ oauth/meta.ts    FB Login for Business code↔token       │
                          │   └─ oauth/google.ts  Google OAuth / service-account         │
                          │                                                            │
   src/routes/marketing.ts (mounted /api/marketing)                                    │
   ├─ GET  /feed.xml                 ← Meta scheduled fetch + Google data source (PUBLIC, rate-limited)
   ├─ GET  /feed.xml?vendor=<id>     ← per-vendor slice                                 │
   ├─ GET  /connections              connected platforms (public info only)            │
   ├─ POST /connect/:platform        start OAuth (returns auth URL)                     │
   ├─ GET  /callback/:platform       OAuth callback → encryptJson(tokens) → DB          │
   ├─ POST /products/:id/ai-caption  Anthropic-generated ad copy (Phase 2)             │
   ├─ POST /links                    UTM builder (MarketingLink) (Phase 2)             │
   └─ GET  /status                   catalog/feed/tracking health per vendor            │
                          │                                                            │
   src/jobs/catalogSync.ts  (setInterval, mirrors abandonedCart.ts)                     │
   ├─ Phase 1: nightly reconcile → googleMerchant.upsert + drift re-push                │
   └─ Phase 2: incremental items_batch for Meta on changed products                     │
                          │                                                            │
   src/lib/orderConfirm.ts  confirmOrderPaid()  ─ prepaid, post-commit ─▶ fireConversionEvents
   src/routes/orders.ts     /cod handler        ─ COD, post-create   ─▶ fireConversionEvents
                          └──────────────────────────────────────────────────────────┘
                                   │ feed.xml URL                │ products.insert / CAPI
                                   ▼                             ▼
                        ┌─────────────────┐          ┌──────────────────────────┐
                        │ Meta Catalog +  │          │ Google Merchant Center    │
                        │ Pixel/Dataset   │          │ (MCA) + (Ph2) Google Ads  │
                        │ Product Sets/vdr│          │ multi-seller sub-accounts │
                        └─────────────────┘          └──────────────────────────┘
                                   ▲ browser Pixel/Tag events (consent-gated)
        ┌──────────────────────────────────────────────────────────────────────┐
        │ @jewel/lib analytics (shared track())  ←  apps/web + apps/storefront    │
        └──────────────────────────────────────────────────────────────────────┘
```

**New backend module placement:**
- `apps/api/src/routes/marketing.ts` — mounted in `apps/api/src/index.ts` next to the existing routers (e.g. `app.use('/api/marketing', marketingRouter)` near lines 76–98). The public `GET /feed.xml` must be reachable **without** `requireAuth` (Meta/Google fetch anonymously) — register it public, like the `storefront-pages` `publicRouter` mounted at line 90.
- `apps/api/src/lib/marketing/*` — provider clients, canonical feed builder, hashing, token refresh, conversion fan-out.
- `apps/api/src/jobs/catalogSync.ts` — wired in the `index.ts` listen block next to `startAbandonedCartJob()` / `startAutoDeliverJob()` / `startSettlementJob()` (lines 110–112), respecting `DISABLE_BACKGROUND_JOBS`.

**OAuth token storage & refresh** — reuse the *exact* encryption already used for payment/carrier credentials:
- `encryptJson({ accessToken, refreshToken, expiresAt, ... })` → store in a `String` column (the `VendorPaymentMethod.credentials` / `VendorCarrierAccount.credentials` pattern), decrypt on demand with `decryptJson<T>()`; never return decrypted tokens to clients.
- Boot already calls `assertEncryptionKeyConfigured()` in `index.ts:9`; the same `ENCRYPTION_KEY`/`SHIPPING_ENCRYPTION_KEY` master key covers marketing tokens — no new key. Document in `apps/api/.env.example`.
- **Token refresh (`tokens.ts`) — closes the refresh gap.** `expiresAt` is now *acted on*: before any provider call, `getValidToken(connectionId)` checks `expiresAt`; if expired/near-expiry it exchanges the stored `refresh_token` (Google) or re-issues the long-lived/System-User token (Meta) via the refresh endpoint, re-`encryptJson`s, and updates `MarketingConnection`. On refresh failure it sets `status = EXPIRED` and surfaces a "Reconnect" prompt in the vendor UI. Google's `refresh_token` is captured on first consent (`access_type=offline&prompt=consent`); Meta long-lived user tokens are refreshed via the token-exchange endpoint, but the **platform catalog sync uses a non-expiring System User token** so feed syndication never stalls on a vendor's token lapse.

**Shared feed endpoint** — `GET /api/marketing/feed.xml` emits one canonical Google-spec record per product plus one child row per `ProductVariationCombo` (`item_group_id = Product.id`). Meta registers this URL as a **scheduled Data Feed** (daily); Google reads the same URL and/or receives `products.insert`. A thin transform layer drops/renames the ~10% of fields that differ between specs.

**Background feed-sync job** — `catalogSync.ts` mirrors `abandonedCart.ts`: `export function startCatalogSyncJob()`, early-return on `DISABLE_BACKGROUND_JOBS`, `setTimeout(run, 30_000)` first run, `setInterval(run, SCAN_INTERVAL_MS)`, DB-error resilience.

**Pixel/Tag injection** — `apps/web` conditionally renders analytics on `NEXT_PUBLIC_GA4_ID` / `NEXT_PUBLIC_META_PIXEL_ID`. **Gaps to close:** (1) `apps/storefront` has *no* analytics — add it; (2) move `track()` into `@jewel/lib` so both apps share it; (3) gate script injection on consent (§9).

**Metadata reality (corrected).** The **storefront** PDP (`apps/storefront/src/app/[vendorId]/products/[id]/page.tsx`) is a **server component that already exports a full `generateMetadata()` with `openGraph` and `twitter`** (lines 6–38) and renders a `ProductDetailClient`. The **web** PDP (`apps/web/src/app/(main)/products/[id]/page.tsx`) is a **`'use client'` component with no `generateMetadata` and cannot have one without restructuring** into a server wrapper + client child. So OG work for Phase 1 is: leave storefront as-is (already correct); for web, *if* OG is wanted, split the client page into a server `page.tsx` (with `generateMetadata`) wrapping the existing client component — this is optional and not required for feed/tracking to work, so it is **Phase 2**.

---

## 4. Data model changes

> Schema syncs via **`npm run db:migrate` → `prisma db push`** (no migration files). After editing `apps/api/prisma/schema.prisma`, run `npm run db:migrate`. All additions below are additive/nullable so the `db push` diff is safe — review it before applying in prod. (Repo is root-owned — `sudo` before editing/building; PM2 process is `jewel-api`.)

### 4a. Feed attributes on `Product` (additive, nullable)

```prisma
  // --- Marketing / shopping-feed attributes ---
  gtin                  String?              // UPC/EAN/JAN, 8–14 digits
  mpn                   String?              // Manufacturer Part Number, <=70 chars
  googleProductCategory String?              // Google taxonomy id or full path (one only)
  condition             FeedCondition  @default(NEW)
  availabilityStatus    AvailabilityStatus?  // null = derive from stockQuantity (preferred)
  feedExcluded          Boolean        @default(false) // vendor opt-out per product
```

(`brand`, `description`, `images[]`, `imageAlts[]`, `price`, `stockQuantity`, `slug`, SEO fields already exist.)

`ProductVariationCombo` already has `optionIds[]`, `price` (`Decimal?` — **null inherits `Product.price`**), `stock`, `sku`. Add only:

```prisma
  gtin   String?  // optional per-variant identifier
```

> **Variant id derivation (no schema change):** Meta/Google item id = `${product.id}_${combo.id}`; `item_group_id = product.id`. If `combo.sku` is null, fall back to the derived id. Variant price = `combo.price ?? product.price`; variant availability from `combo.stock`.

### 4b. New enums

```prisma
enum FeedCondition       { NEW REFURBISHED USED }
enum AvailabilityStatus  { IN_STOCK OUT_OF_STOCK PREORDER BACKORDER }
enum MarketingPlatform   { META GOOGLE }
enum MarketingMode       { TEST LIVE }
enum FeedItemStatus      { PENDING SYNCED ERROR EXCLUDED }
enum ConsentStatus       { GRANTED DENIED UNKNOWN }
enum SocialProvider      { INSTAGRAM FACEBOOK }       // Phase 2
enum ScheduledPostStatus { DRAFT SCHEDULED PUBLISHED FAILED } // Phase 2
```

### 4c. Consent (closes the consent gap — load-bearing for India DPDP / GDPR)

```prisma
// On model User (logged-in buyers):
  marketingConsent  ConsentStatus @default(UNKNOWN)
  consentUpdatedAt  DateTime?

// On model Order (snapshot at checkout — survives later consent changes & for guest orders):
  marketingConsent  ConsentStatus @default(UNKNOWN)
  // Click identifiers persisted at checkout for server-side attribution:
  gclid             String?
  gbraid            String?
  wbraid            String?
  metaFbc           String?
  metaFbp           String?
```

A **consent banner** (shared component in `@jewel/ui`, rendered in both storefront layouts) writes consent to a first-party cookie and, for logged-in users, to `User.marketingConsent` via a small API route. At checkout, `orders.ts` (`/checkout` and `/cod`) stamps `Order.marketingConsent` + the click ids onto the order. **Conversion fan-out and pixel injection are both gated on consent** (§8/§9).

### 4d. New models

```prisma
model MarketingConnection {
  id             String            @id @default(uuid())
  vendorId       String
  vendor         Vendor            @relation(fields: [vendorId], references: [id], onDelete: Cascade)
  platform       MarketingPlatform
  mode           MarketingMode     @default(LIVE)
  credentials    String            // encryptJson({accessToken, refreshToken, expiresAt, datasetId/pixelId, ...})
  publicConfig   Json?             // client-safe: { catalogId, productSetId, merchantId, externalSellerId, accountName }
  lastVerifiedAt DateTime?
  status         String            @default("CONNECTED") // CONNECTED | EXPIRED | REVOKED | ERROR
  errorMessage   String?
  createdAt      DateTime          @default(now())
  updatedAt      DateTime          @updatedAt
  @@unique([vendorId, platform])
  @@index([vendorId])
}

model ProductFeedState {
  id             String            @id @default(uuid())
  productId      String
  product        Product           @relation(fields: [productId], references: [id], onDelete: Cascade)
  platform       MarketingPlatform
  status         FeedItemStatus    @default(PENDING)
  lastSyncedAt   DateTime?
  externalItemId String?           // Meta retailer_id / Google product resource name
  // Drift detection (§2b): last values pushed, compared on reconcile
  lastPrice      Decimal?          @db.Decimal(10, 2)
  lastAvailable  String?
  errorMessage   String?
  @@unique([productId, platform])
  @@index([status])
}

// One row per (order, platform, vendor) — supports multi-vendor orders + idempotency.
model ConversionEvent {
  id          String            @id @default(uuid())
  orderId     String
  vendorId    String            // always stamped; multi-vendor order => one row per vendor
  platform    MarketingPlatform
  eventName   String            // "Purchase" | "Refund"
  eventId     String            // dedup key, namespaced per vendor: `${orderId}:${vendorId}`
  value       Decimal           @db.Decimal(10, 2) // this vendor's allocated value (§8b)
  currency    String            @default("INR")
  sentAt      DateTime          @default(now())
  status      String            @default("SENT")   // SENT | FAILED
  responseRef String?           // fbtrace_id / gclid / adjustment handle
  @@unique([orderId, platform, vendorId, eventName])
  @@index([orderId])
}

model MarketingLink {            // Phase 2 — UTM builder
  id          String   @id @default(uuid())
  vendorId    String
  vendor      Vendor   @relation(fields: [vendorId], references: [id], onDelete: Cascade)
  destination String
  utmSource   String
  utmMedium   String
  utmCampaign String   // auto-prefixed with vendorId for roll-up
  utmContent  String?
  shortCode   String?  @unique
  clicks      Int      @default(0)
  createdAt   DateTime @default(now())
  @@index([vendorId])
}

model ScheduledPost {            // Phase 2 — organic posting
  id           String              @id @default(uuid())
  vendorId     String
  vendor       Vendor              @relation(fields: [vendorId], references: [id], onDelete: Cascade)
  providers    SocialProvider[]
  caption      String
  mediaUrls    String[]            // Cloudinary URLs (reuse VendorAsset)
  scheduleAt   DateTime
  status       ScheduledPostStatus @default(DRAFT)
  externalRef  String?
  errorMessage String?
  createdAt    DateTime            @default(now())
  @@index([vendorId])
  @@index([status, scheduleAt])
}
```

Add reverse relations on `Vendor`: `marketingConnections`, `marketingLinks` (Ph2), `scheduledPosts` (Ph2).

---

## 5. API & OAuth flows

### Endpoints (`apps/api/src/routes/marketing.ts`)

Authed routes use `requireAuth + requireRole(Role.VENDOR)` (`apps/api/src/middleware/auth.ts`), resolving `vendorId` from `req.user` like `coupons.ts`/`vendors.ts`.

| Method & path | Auth | Phase | Purpose |
|---|---|---|---|
| `GET /api/marketing/feed.xml[?vendor=<id>]` | **public, rate-limited** | 1 | Canonical Google-spec XML; eligibility-filtered (§2a); ETag + cache. |
| `POST /api/marketing/connect/:platform` | vendor/admin | 1 | Returns provider OAuth authorize URL (state = signed `{vendorId, platform, nonce}`; Google uses `access_type=offline&prompt=consent`). |
| `GET /api/marketing/callback/:platform` | public (state-validated) | 1 | Exchange `code` → tokens (+ refresh token), `encryptJson`, upsert `MarketingConnection`. |
| `GET /api/marketing/connections` | vendor/admin | 1 | List connected platforms (publicConfig only). |
| `DELETE /api/marketing/connections/:id` | vendor/admin | 1 | Revoke (best-effort provider token-revoke). |
| `GET /api/marketing/status` | vendor/admin | 1 | Feed counts by `FeedItemStatus`, last sync, pixel health, token status. |
| `POST /api/admin/marketing/sync/:vendorId` | admin | 1 | Force full re-sync of a vendor's catalog. |
| `POST /api/marketing/products/:id/ai-caption` | vendor | 2 | Anthropic caption (gate on `aiAvailable()`; per-vendor rate limit). |
| `POST` / `GET /api/marketing/links` | vendor | 2 | UTM builder CRUD. |
| `POST /api/marketing/scheduled-posts` | vendor | 2 | Schedule IG/FB post. |

### Meta — Facebook Login for Business
- **Scopes (Phase 1):** `catalog_management`, `business_management`. **Phase 2/3:** `ads_management`, `pages_*`, `instagram_basic`, `instagram_content_publish`. All Advanced-Access-gated → App Review + Business Verification before going beyond the dev Business.
- **Flow:** `POST /connect/meta` → FB Login → callback exchanges short-lived → long-lived token. For automated catalog sync use a **platform System User token** (non-expiring) on the **one platform-owned catalog**; the vendor connection drives partner asset sharing / Page-IG selection.
- **Multi-tenant structure:** one Business Portfolio owns App + one master catalog + pixel/dataset; each vendor is a **Product Set** on `custom_label_0 = vendorId`. Vendor-owned ad accounts/Pages (Phase 3) via **Business Manager Partner Access**, not stored user tokens.
- **Domain verification & custom-domain reconciliation (§9):** verify the platform storefront domain in Business Settings. Because vendor storefronts may run on **custom domains**, every catalog `link` MUST resolve to the *verified* canonical domain (or each custom domain must itself be verified) — otherwise Shops/tagging breaks. Phase 1 emits canonical platform-domain `link`s to keep one verified domain and intact Shops links.

### Google — OAuth 2.0 + Merchant API v1
- **Scope:** `https://www.googleapis.com/auth/content`. Ads (Phase 2): `https://www.googleapis.com/auth/adwords`.
- **Flow:** **service account** for platform server-to-server feed upload (recommended for Phase 1); 3-legged OAuth (with offline refresh token) where vendor-authorized access is needed. App passes Google verification (~3–5 business days).
- **Build on Merchant API v1, NOT Content API v2.1** (Content API shuts down **Aug 18 2026**; v1beta gone Feb 28 2026). Prices use `amountMicros` + `currencyCode`; **no `customBatch`** — async parallel `products.insert`.
- **Multi-tenant:** platform owns the **MCA** (+ Google Ads **MCC**, Phase 2). Vendors grouped into **multi-seller sub-accounts** with mandatory `external_seller_id = vendorId`. Graduate high-volume vendors to single-seller sub-accounts later.

---

## 6. Vendor dashboard UX

Insert a **Marketing** item into the `NAV` array in `apps/vendor/src/app/(dashboard)/layout.tsx` between **Payouts** (line 27) and **Payment methods** (line 28):

```ts
{ label: 'Marketing', href: '/marketing', icon: Icons.Star, match: (p) => p.startsWith('/marketing') },
```

Create `apps/vendor/src/app/(dashboard)/marketing/` following the existing page pattern (`useMe`, `api()` from `@jewel/lib`, `PageHeader` + `Card`, `DashboardShell`). Sub-pages:

1. **Connect accounts** — "Connect Meta" / "Connect Google" → `POST /connect/:platform` → OAuth redirect; show status + **Reconnect** when `EXPIRED` (driven by token-refresh failures). Masked, never expose secrets (mirror `payments.ts` masking).
2. **Catalog status** — per-product, per-platform `FeedItemStatus` (SYNCED/PENDING/ERROR/EXCLUDED) + error messages + "Fix" deep-link to the listing editor; surfaces missing-field warnings (`gtin` / `googleProductCategory` / `condition`).
3. **Listing-editor "Marketing & feed" step** — in `packages/ui/src/listing-editor/`: `gtin`, `mpn`, `googleProductCategory` (taxonomy picker, §11 mapping), `condition`, `feedExcluded`. Wire into the product `POST`/`PUT` multipart handlers in `apps/api/src/routes/products.ts`.
4. **Tracking** — read-only health: pixel/tag firing, last `Purchase`/`Refund` sent (from `ConversionEvent`), this vendor's **allocated** attributed revenue.
5. **Campaigns** (Phase 2) / **AI caption & UTM tools** (Phase 2).

---

## 7. Admin / platform considerations

- **Platform ad account:** platform owns one Meta ad account + (Phase 2) the Google Ads MCC. All paid spend is platform-run for MVP; per-vendor self-serve is Phase 3 (Advanced Access).
- **Connected MCP servers are an operator control plane, not the runtime.** The environment exposes full read+write **Meta Ads MCP** (`create_campaign`, `create_adset`, `create_ad`, `create_product_set`, `create_catalog`, `upload_conversion_events`, …) and **Google Ads MCP** (`create_google_ads_pmax_campaign`, `create_google_ads_shopping_listing_group_tree`, `execute_google_ads_mutate`, GAQL, …). They resolve a *single* stored Business/MCC mapping, so they are suited to **operator** tasks — standing up the platform catalog + per-vendor Product Sets, launching/pausing platform campaigns, pulling reporting — **without writing campaign code**. They are **not** a per-vendor multi-tenant API. (Consistency note: the MCP `upload_conversion_events` capability is an *operator/manual backfill* tool only; the durable per-order conversion runtime is `conversions.ts` in `apps/api`, never the MCP.)
- **Commission / billing:** platform-run spend is a platform cost. Options: (a) absorb, (b) bill vendors a marketing fee on top of the existing **gross − 10% commission** payout (`admin.ts` payout calc / `jobs/settlement.ts`, which settles on **DELIVERED**), or (c) vendor-funded ad accounts via Partner Access (Phase 3). A future `MarketingSpend` ledger + `MarketingConnection.mode` (TEST/LIVE) feed the payout math.


---

## 7A. Admin-managed per-vendor marketing (operator console)

> Extends §7. The owner requires that platform **ADMIN (and scoped staff)** can perform *any* vendor marketing action **on behalf of a chosen vendor** — connect accounts, manage feed/catalog status, run/boost campaigns (incl. via the connected Meta/Google Ads MCP servers), and view tracking — **in addition to** vendor self-serve. This section reuses, without forking, the models of §4 (`MarketingConnection`, `ProductFeedState`, `ConversionEvent`), the routes of §5, and the billing/MCP notes of §7. The crux is a **single service layer** consumed by two route surfaces.

### 7A.1 Managed-marketing model — one service layer, two callers

Every marketing capability is implemented **once** as a pure service function in `apps/api/src/lib/marketing/*` that takes an **explicit `vendorId`** plus a **`caller` context** — never reading identity from globals. The two route surfaces differ only in *how `vendorId` is obtained and authorized*, then call the identical service:

```ts
// apps/api/src/lib/marketing/service.ts  (the shared layer)
export interface MarketingCaller {
  actorId: string;                 // req.user!.id, or SYSTEM_ACTOR_ID for jobs (§7A.4)
  actorRole: 'VENDOR' | 'ADMIN' | 'SYSTEM';
  onBehalf: boolean;               // true when ADMIN acts for a vendor
}
export async function connectStart(vendorId: string, platform, caller: MarketingCaller): Promise<string> { … }
export async function forceSync(vendorId: string, caller: MarketingCaller) { … }      // wraps POST /admin/marketing/sync/:vendorId (§5)
export async function setFeedFields(vendorId: string, productId: string, fields, caller) { … }
export async function launchCampaign(vendorId: string, spec, caller) { … }            // Phase 2, MCP-backed (§7A.6)
export async function getStatus(vendorId: string, caller) { … }
```

The service is the *only* place that writes `MarketingConnection` / `ProductFeedState` / `MarketingSpend` and the only place that emits an `audit()` row, so vendor self-serve and admin-on-behalf are guaranteed to behave identically and stay auditable. This is the same separation the codebase already uses for vendor sub-resources: the route resolves and authorizes the `vendorId`, the handler verifies existence, then mutates.

### 7A.2 Authorization design (the crux) — vendor never names a vendorId; admin always does

Two distinct route surfaces, two distinct guards, **one service**:

**Vendor self-serve — `/api/marketing/*` (§5).** Guarded `requireAuth + requireRole(Role.VENDOR)`. `vendorId` is **resolved server-side from `req.user`** exactly like `coupons.ts`/`vendors.ts` — the vendor **never** sends a `vendorId` in path or body. This is the IDOR defence: there is no parameter a vendor could tamper with to reach another vendor.

```ts
const vendor = await prisma.vendor.findUnique({ where: { userId: req.user!.id } });
if (!vendor) return res.status(403).json({ error: 'No vendor profile' });
await forceSync(vendor.id, { actorId: req.user!.id, actorRole: 'VENDOR', onBehalf: false });
```

**Admin operator — `/api/admin/marketing/vendors/:vendorId/*` (new sub-tree).** Mounted under the existing admin surface. Note the real gate is the **per-route permission guard**: `requirePermission(...)`/`requireAnyPermission(...)` in `middleware/auth.ts` *already* hard-reject any caller whose `req.user.role !== Role.ADMIN` internally (lines 69 and 86) before checking the permission, so a VENDOR token cannot reach these handlers. We still put `requireAuth` at the router level for the 401-vs-403 distinction, but we do **not** rely on a router-level role gate as the protection — the least-privilege permission guard is the gate:

```ts
router.use(requireAuth);                                        // 401 if unauthenticated; role+perm enforced per-route below
router.post('/vendors/:vendorId/connect/:platform', requirePermission(Permission.MARKETING_MANAGE), …);
router.post('/vendors/:vendorId/sync',     requirePermission(Permission.MARKETING_MANAGE), …);
router.get ('/vendors/:vendorId/status',   requireAnyPermission(Permission.MARKETING_VIEW, Permission.MARKETING_MANAGE), …);
router.post('/vendors/:vendorId/campaigns',requirePermission(Permission.MARKETING_ADS_MANAGE), …);  // ad spend gated separately
```

`vendorId` comes from the **path** (mirroring the existing vendor-targeted admin endpoints `PATCH /admin/vendors/:id/status` and `/admin/vendors/:id/kyc`, which also take the id in the path, never the body). The handler **fetches the vendor first and 404s if absent**, then calls the same service with `onBehalf: true`:

```ts
const vendor = await prisma.vendor.findUnique({ where: { id: req.params.vendorId } });
if (!vendor) return res.status(404).json({ error: 'Vendor not found' });
await forceSync(vendor.id, { actorId: req.user!.id, actorRole: 'ADMIN', onBehalf: true });
```

**Why two surfaces and not a shared `?vendor=` param:** keeping vendor routes parameter-free makes IDOR structurally impossible (no id to forge), while the admin routes carry the `vendorId` openly behind the per-route permission gate — which itself enforces ADMIN role. The existing per-vendor `feed.xml?vendor=<id>` slice (§5) stays public/read-only and is unaffected.

The §5 note that `POST /connect/:platform` is "vendor/admin" is **refined here**: admin connect is *not* the same endpoint with a looser guard — it is the dedicated `POST /api/admin/marketing/vendors/:vendorId/connect/:platform` (§7A.5), so vendor and admin connect flows have separate guards but the same `connectStart()` service body. A `MARKETING_MANAGE`-only operator can connect an account but **cannot** launch spend against it: `launchCampaign()` is independently gated `MARKETING_ADS_MANAGE` (§7A.3), so connect-then-spend is not reachable by a single under-privileged actor through any code path.

### 7A.3 RBAC — extend the existing permission system; ad spend is its own permission

The codebase already has a granular, extensible permission system: a Prisma `Permission` enum (e.g. `VENDOR_APPROVE`, `PAYOUT_VIEW`, `RBAC_MANAGE`, `AUDIT_VIEW`, plus a **defined-but-unused `IMPERSONATE`**) in `apps/api/prisma/schema.prisma`; `AdminRole` records each holding a `Permission[]`; `SUPER_ADMIN` (`isSystem=true`) short-circuiting in `loadPermissions()` to all permissions; guards `requireRole`, `requirePermission(...)`, `requireAnyPermission(...)` in `middleware/auth.ts` with a **60s permission cache**; and the client mirror `usePermissions().has(...)` in `packages/lib/src/permissions.ts`. We **extend**, not replace.

Add to the `Permission` enum (and mirror into `packages/lib/src/permissions.ts` — these are *not* auto-synced, so the manual copy is required):

```prisma
  MARKETING_VIEW          // read any vendor's feed health, connection status, tracking, spend
  MARKETING_MANAGE        // connect/disconnect, force-sync, edit feed fields on behalf of a vendor
  MARKETING_ADS_MANAGE    // launch/pause campaigns & commit ad SPEND (separated so not every admin can spend budget)
```

**Least-privilege split:** `MARKETING_ADS_MANAGE` is deliberately distinct from `MARKETING_MANAGE` so feed/catalog operators cannot move ad budget. Seed two non-system `AdminRole` rows via the existing RBAC API — `POST /api/admin/rbac/roles` to create, `PATCH /api/admin/rbac/roles/:id` with body `{ permissions }` to edit (both gated `RBAC_MANAGE`; there is no `/roles/:id/permissions` sub-path):

- **"Marketing Operator"** → `[MARKETING_VIEW, MARKETING_MANAGE]` (feed/connection/catalog work, no spend).
- **"Marketing Buyer"** → `[MARKETING_VIEW, MARKETING_MANAGE, MARKETING_ADS_MANAGE]` (full operator incl. spend).

`SUPER_ADMIN` gets all three for free via the `loadPermissions()` short-circuit. **Because that short-circuit defeats the operator/buyer split for SUPER_ADMINs** (every SUPER_ADMIN implicitly holds `MARKETING_ADS_MANAGE`), the permission system alone cannot constrain a SUPER_ADMIN's spend — so `launchCampaign()` enforces a **server-side budget ceiling independent of role** (§7A.6). UI gating in the admin app uses `usePermissions().has('MARKETING_ADS_MANAGE')` to hide "Launch / Boost" from operators who can't spend. We do **not** use the dormant `IMPERSONATE` permission — admin-on-behalf is an explicit, audited service call carrying both `actorId` and `vendorId`, not a session swap.

**Revoked-admin handling (60s cache).** `connectedByAdminId` is **historical provenance only — never an ongoing grant**. Because `loadPermissions()` caches for 60s, a just-revoked admin can act for up to a minute; we accept that bound for normal mutations (it matches every other admin action in the system), but the public OAuth callback is the one place where a stale grant could persist tokens, so §7A.5 **re-verifies the `byAdmin` actor's live `MARKETING_MANAGE` at callback time** rather than trusting the signed `byAdmin`.

### 7A.4 Audit — every on-behalf action, every token decryption, system actor defined

All mutations route through the existing audit helper, whose exact signature is:

```ts
// apps/api/src/lib/audit.ts
audit(actorId: string, action: string, target?: string | null, metadata?: Record<string, unknown>)
```

The shared service emits audit for **every admin-on-behalf action** (`caller.onBehalf === true`), recording **actor = admin user id**, **target = vendorId** (so "all actions affecting vendor X" is queryable by `target`, fixing the §7-era payout gap where `target` was a payout id), `action` in a `marketing.*` namespace, and metadata including `isAdminAction: true`:

| Action | `action` string | `target` | `metadata` |
|---|---|---|---|
| Admin connects platform | `marketing.connection.connect` | `vendorId` | `{ platform, mode, connectedByAdmin: actorId }` |
| Admin disconnects | `marketing.connection.disconnect` | `vendorId` | `{ platform, connectionId }` |
| Admin force-sync | `marketing.feed.forceSync` | `vendorId` | `{ platform, productCount }` |
| Admin edits feed fields | `marketing.feed.fieldsChanged` | `vendorId` | `{ productId, before, after }` |
| Admin launches/pauses campaign | `marketing.campaign.launch` / `.pause` | `vendorId` | `{ platform, externalCampaignId, dailyBudget, mode, productSetId }` |
| Token decryption (any caller) | `marketing.token.decrypt` | `vendorId` | `{ connectionId, platform, actorRole }` |

**Token-decryption granularity + system actor.** `tokens.getValidToken()` is made caller-aware and logs `marketing.token.decrypt` with `actorRole` distinguishing `ADMIN` from `SYSTEM`. Background jobs (nightly `catalogSync.ts` reconcile, §3) have no human caller, so we define a **reserved system actor** — `SYSTEM_ACTOR_ID` (a fixed sentinel constant in `lib/audit.ts`, not a real `User` row, with `actorRole: 'SYSTEM'`) — passed as the `caller.actorId` for job-triggered decryptions. This keeps the log complete and makes scheduled decryptions cleanly distinguishable from admin-triggered ones; no audit row carries a null/garbage `actorId`.

**Self-serve audit asymmetry (documented).** Vendor self-serve marketing mutations (`onBehalf === false`) are **intentionally not audited** in Phase 1, consistent with the codebase auditing admin actions only. Because the service is the sole writer for both callers, extending coverage to vendor self-serve connect/disconnect (and Phase-3 vendor self-serve spend) is a one-line `if`-relaxation later; until then this asymmetry is a known, accepted forensic gap, not an oversight.

These rows surface in the **already-existing admin audit viewer at `apps/admin/src/app/(dashboard)/rbac/audit/page.tsx`** (`GET /api/admin/rbac/audit`, gated `AUDIT_VIEW`; nav item "Audit log" at `layout.tsx`), so **no new audit UI is needed** — the `marketing.*` namespace simply appears there. (The §7-era "no audit viewer" note is stale; the viewer already exists.)

### 7A.5 OAuth on behalf of a vendor — two supported modes, hardened callback

**(a) Admin-initiated connect.** Admin opens the per-vendor console (§7A.7) and clicks "Connect Meta / Google for this vendor" → `POST /api/admin/marketing/vendors/:vendorId/connect/:platform` (gated `MARKETING_MANAGE`). The state token from §5 is widened to `{ vendorId, platform, nonce, byAdmin: actorId }` and **HMAC-signed over the entire payload including `byAdmin`** with the server secret (so `byAdmin` is not forgeable), with a **single-use nonce persisted server-side** and a **short TTL (≤10 min)**. The admin completes the provider OAuth screen; the callback `GET /api/marketing/callback/:platform` (public, state-validated) then:

1. verifies the HMAC and rejects on mismatch;
2. consumes the nonce (single-use — replays are rejected) and checks TTL;
3. **if `byAdmin` is present, re-loads that actor's live permissions and rejects unless they STILL hold `MARKETING_MANAGE`** — closing the revoked-admin window the 60s cache would otherwise leave open at the one public entry point;
4. `encryptJson`s the tokens onto **that vendor's** `MarketingConnection` (resolved from the signed `vendorId`, never the admin's identity) and stamps `connectedByAdminId` as provenance.

Tokens land on the vendor's row exactly as if the vendor had done it; the only difference is the audit trail and `connectedByAdminId`.

**(b) Platform System User / partner-access model (preferred for managed vendors).** The platform's **own non-expiring Meta System User token** (the §3/§5 mechanism driving the one platform-owned catalog) and the **Google service account on the MCA** drive sync **without the vendor ever doing OAuth**. The `MarketingConnection` is created with `managedByPlatform = true` and empty per-vendor `credentials`; `tokens.getValidToken(vendorId)` detects `managedByPlatform` and returns the platform token instead, so feed syndication "just works" against that vendor's Product Set / `external_seller_id`. Mode (b) connections hold no vendor credentials, so a vendor "disconnect" is meaningless — **only an admin can detach a `managedByPlatform` connection, and detaching must stop sync** for that vendor. Mode (a) connections hold the vendor's own tokens and may be disconnected by either the vendor (self-serve) or an admin.

**Concurrency / upsert semantics.** `MarketingConnection` is `@@unique([vendorId, platform])`, so two admins connecting the same vendor+platform race. The callback writes via **`prisma.upsert` keyed on `(vendorId, platform)` with last-write-wins**, and the winning write sets `connectedByAdminId` and `credentials` to the actor that completed last; the audit row (one per completion) preserves both attempts for forensics. `setFeedFields` records `{ before, after }` in audit metadata so concurrent field edits are forensically reconstructable (last-write-wins; no optimistic version column in Phase 1 — flagged as a known limitation, not silent).

**Vendor consent to managed marketing.** A `Vendor.managedMarketingConsent Boolean @default(false)` flag gates managed marketing: an admin may connect/sync in mode (b) only after consent is recorded, and **Phase-2 settlement deduction (§7A.8) is hard-gated on `managedMarketingConsent === true`** — the vendor is the data controller for their product/customer data, so syndication and payout deduction without recorded agreement is a trust/legal exposure we close at the schema level. Consent toggles are visible to the vendor and audited.

**Recommendation:** for fully managed vendors prefer **(b)** — it removes the per-vendor token-lapse failure mode (consistent with §3's non-expiring System User token). Use **(a)** only when an action needs the vendor's *own* asset (their Facebook Page/IG for organic posts, or a vendor-funded ad account in Phase 3).

### 7A.6 Operator ads via MCP, scoped per single vendor — server-derived scope + budget ceiling

Per §7, the connected **Meta Ads MCP** and **Google Ads MCP** are an operator control plane. For admin-managed ads, `launchCampaign(vendorId, spec, caller)` (gated `MARKETING_ADS_MANAGE`) scopes every action to **one vendor's slice** of the platform-owned assets:

- **Meta:** launch an **Advantage+ Catalog** campaign whose ad set targets that vendor's **Product Set** (`custom_label_0 = vendorId`, via MCP `create_product_set` / `list_product_sets`), then `create_campaign` → `create_adset` → `create_ad`; pause via `update_campaign` / `update_adset`.
- **Google:** create a **PMax** campaign (`create_google_ads_pmax_campaign`) with a **listing-group tree** (`create_google_ads_shopping_listing_group_tree`) filtered to that vendor's `external_seller_id = vendorId` on the MCA; pause via `pause_google_ads_campaign`.

Two hard invariants enforced in the service, **not** trusted from the client:

1. **Server-derived scope.** The `productSetId` (Meta) / listing-group filter (Google) is **derived from `vendorId` server-side** — `launchCampaign` resolves or creates the vendor's own Product Set and **never accepts a `productSetId`/listing-group from the request body**. The MCP servers resolve a single Business/MCC and will target *any* set id passed, so accepting one from the client would let an `ADS_MANAGE` operator mis-scope spend onto a different vendor. Deriving it server-side makes cross-vendor spend mis-scoping structurally impossible.
2. **Budget ceiling.** A configurable max `dailyBudget` (settings-backed) is validated in `launchCampaign` **before** the MCP call and **independent of role**, so neither a careless/compromised buyer-role admin nor a SUPER_ADMIN (whose permission short-circuit can't be constrained by RBAC, §7A.3) can commit unbounded vendor-attributed budget.

The result — `externalCampaignId`, server-derived `productSetId`/listing-group, budget, mode — is persisted in a `MarketingSpend` ledger row (§7A.8) and audited (§7A.4).

### 7A.7 Admin UI — global dashboard + per-vendor console

Add a **"Marketing"** item to the admin `NAV` array in `apps/admin/src/app/(dashboard)/layout.tsx` (the array spans lines 10–25), inserted between **"Payment methods"** (line 21) and **"Settings"** (line 22), gated so non-marketing admins don't see it:

```ts
{ label: 'Marketing', href: '/marketing', icon: Icons.Chart, match: (p) => p.startsWith('/marketing'), perm: ['MARKETING_VIEW','MARKETING_MANAGE'] },
```

The NAV filter (layout.tsx lines 46–47) uses `perms.some(p => has(p))` (OR semantics), so the array form correctly shows the item to any admin holding *either* permission.

**(a) Global marketing dashboard — `/marketing`.** All-vendors roll-up following the existing page pattern (`'use client'`, `useState`+`useEffect`+`api()`, `PageHeader` + `KpiCard` + `Card` grid, `DashboardShell` from `@jewel/ui`, like `payouts/page.tsx`). Shows feed health across all vendors (counts by `FeedItemStatus`), connection status per vendor (`CONNECTED`/`EXPIRED`/`REVOKED` from `MarketingConnection.status`), and spend/ROAS roll-up (`MarketingSpend` + `ConversionEvent`). Rows are a per-vendor table mirroring the payouts table; each links into the console.

**(b) Per-vendor marketing console — `/vendors/[vendorId]/marketing`.** The **first per-vendor detail page in the admin app** (today `/vendors` is a list with status-action buttons only). It follows the **order-detail dynamic-route pattern** (`orders/[id]/page.tsx`): `useParams<{ vendorId: string }>()`, then `api('/api/admin/marketing/vendors/${vendorId}/status')` etc. The console **mirrors the vendor's own Marketing pages of §6** (Connect accounts, Catalog status, Tracking, managed-marketing consent toggle, and Phase-2 Campaigns) but every mutating button calls the **`/api/admin/marketing/vendors/:vendorId/*`** endpoints and is gated client-side via `usePermissions().has('MARKETING_MANAGE' | 'MARKETING_ADS_MANAGE')`. Reachable from the global dashboard rows and from a new "Marketing" link on each `/vendors/page.tsx` row. Secrets are masked exactly as `payments.ts` masking — admin sees connection status and `publicConfig`, never decrypted tokens.

### 7A.8 Billing / commission — MarketingSpend ledger ties into gross − commission settlement

Per §7, paid spend is a platform cost today, settled against the existing **gross − 10% commission** payout (`admin.ts` payout calc / `jobs/settlement.ts`, which settles on **DELIVERED**). When an admin runs spend *for a specific vendor* it must be attributable so the §7 option-(b) "bill vendors a marketing fee on top of commission" is enforceable. Introduce a **`MarketingSpend` ledger** (the §7 future-ledger, now concrete), `vendorId`-keyed, carrying `MarketingMode` **TEST/LIVE** (reusing §4d's `MarketingConnection.mode` semantics) so test campaigns never hit settlement:

- Each operator campaign launch/spend event writes a `MarketingSpend` row (`vendorId`, `platform`, `externalCampaignId`, `amount`, `currency`, `mode`, `incurredAt`).
- Settlement sums **LIVE** `MarketingSpend` for the vendor in the period and deducts it as a marketing fee from gross − commission — **but only when `Vendor.managedMarketingConsent === true`** (§7A.5); without recorded consent the spend is reporting-only and the platform absorbs it. **TEST** rows are always excluded from payout math.
- The global dashboard's ROAS roll-up divides `ConversionEvent` allocated revenue (§8b, per-vendor) by `MarketingSpend` per vendor.

### 7A.9 Schema deltas — small, additive, nullable (db push safe)

Only the minimum beyond §4. All additive/nullable so `npm run db:migrate` → `prisma db push` stays safe:

```prisma
// On model MarketingConnection (§4d) — provenance + platform-managed mode:
  connectedByAdminId String?   // admin User.id when connected on behalf (mode (a)); null = vendor self-connected. Provenance only.
  managedByPlatform  Boolean  @default(false)  // mode (b): use platform System User / service-account token, no vendor OAuth

// On model Vendor — managed-marketing consent (gates mode (b) sync + settlement deduction, §7A.5/§7A.8):
  managedMarketingConsent Boolean @default(false)
  marketingSpend          MarketingSpend[]      // reverse relation

// New: per-vendor spend ledger feeding settlement (§7A.8)
model MarketingSpend {
  id                String           @id @default(uuid())
  vendorId          String
  vendor            Vendor           @relation(fields: [vendorId], references: [id], onDelete: Cascade)
  platform          MarketingPlatform
  externalCampaignId String?
  amount            Decimal          @db.Decimal(10, 2)
  currency          String           @default("INR")
  mode              MarketingMode    @default(LIVE)   // TEST excluded from settlement
  incurredAt        DateTime         @default(now())
  createdById       String?          // admin who launched the spend (provenance)
  createdAt         DateTime         @default(now())
  @@index([vendorId])
  @@index([vendorId, mode, incurredAt])
}
```

Plus the three new `Permission` enum values (§7A.3) in `schema.prisma` and their manual mirror in `packages/lib/src/permissions.ts`. No new `AdminRole`/`UserAdminRole` schema is needed — the two operator roles are *data* created through the existing RBAC API. The dormant `IMPERSONATE` enum value is left untouched. The reserved `SYSTEM_ACTOR_ID` (§7A.4) is a constant, not a schema change.

### 7A.10 Phasing — slot into the existing §10 Phase 1/2/3

- **Phase 1 (with the §10 MVP):** Shared service layer (§7A.1) so vendor and admin both call it from day one. Admin can **connect (modes a + b) + force-sync + view** *any* vendor — `/api/admin/marketing/vendors/:vendorId/{connect,sync,status,feed-fields}`. Add `MARKETING_VIEW` / `MARKETING_MANAGE` permissions, the admin "Marketing" nav item, the global dashboard, and the per-vendor console (read + feed/connection ops). Schema: `MarketingConnection.connectedByAdminId` + `managedByPlatform`, `Vendor.managedMarketingConsent`. Hardened OAuth callback (HMAC over `byAdmin`, single-use short-TTL nonce, callback-time live-permission re-check). Reserved `SYSTEM_ACTOR_ID` for job decryptions. All on-behalf actions + all token decryptions audited (§7A.4) into the existing `/rbac/audit` viewer.
- **Phase 2:** Operator MCP campaigns scoped per vendor (§7A.6) behind `MARKETING_ADS_MANAGE`, with **server-derived productSetId/listing-group and the server-side budget ceiling**; the `MarketingSpend` ledger (§7A.8) and its consent-gated settlement deduction; Campaigns tab in the per-vendor console; spend/ROAS roll-up on the global dashboard.
- **Phase 3:** Scoped staff roles operationalized (seed "Marketing Operator" / "Marketing Buyer" `AdminRole` rows, least-privilege enforced in prod) **alongside vendor self-serve ads** (§10 Phase 3) — including extending audit coverage to vendor self-serve mutations (§7A.4) — both still flowing through the one shared service, plus vendor-funded ad accounts via Partner Access using mode-(a) connections.

---

## 8. Conversion tracking specifics

### 8a. Server-side `Purchase` fires from BOTH payment paths (corrects the COD bug)

There is **no single choke point**. `confirmOrderPaid()` in `apps/api/src/lib/orderConfirm.ts` is called only by `/verify-payment` (orders.ts:665) and the Razorpay webhook (`payments.ts`). The **COD path is separate**: `POST /api/orders/cod` (orders.ts:435) creates `OrderItem`s with status **PENDING**, does inline coupon redemption + stock decrement, generates the invoice, and calls `notifyOrderConfirmation(order.id)` directly (orders.ts:616) — it **never** touches `confirmOrderPaid()`. Firing the server `Purchase` only from `confirmOrderPaid()` would **drop every COD order**, a large share of Indian jewellery sales.

Therefore wire **two emit sites**, both calling the same idempotent fan-out:

- **Prepaid** — in `confirmOrderPaid()`, after the `$transaction` commits and only when `claimed === true` (not on `alreadyProcessed` re-calls — exactly-once for free), alongside `void notifyOrderConfirmation(order.id)` (orderConfirm.ts:83):
  ```ts
  if (claimed) void fireConversionEvents(order.id); // never throws
  ```
- **COD** — in the `/cod` handler, immediately after `void notifyOrderConfirmation(order.id)` (orders.ts:616):
  ```ts
  void fireConversionEvents(order.id); // never throws
  ```
  Idempotency for COD is the `ConversionEvent` `@@unique([orderId, platform, vendorId, eventName])` constraint — `fireConversionEvents` no-ops on rows that already exist, so retries/duplicate submits don't double-count. (COD orders are PENDING, not PAID — the conversion represents *order placement*, which is the correct attribution signal for COD, with refund/cancel handling per §8c.)

### 8b. Per-vendor value allocation for multi-vendor orders (closes the double-count gap)

One order can span vendors. Order-level amounts (`Order.totalAmount`, `discountAmount`, `shippingTotal`, `giftWrapFee`) MUST be **allocated per vendor** so each vendor's `ConversionEvent.value` reflects only that vendor's share — otherwise every vendor's catalog gets the full order total and ROAS is inflated N×. `fireConversionEvents(orderId)` loads the order with `items { productId, vendorId, quantity, priceAtPurchase }`, then:

1. **Goods subtotal per vendor** = Σ (`item.priceAtPurchase * item.quantity`) over that vendor's items (`priceAtPurchase` is the authoritative per-item value already snapshotted on `OrderItem`).
2. **Allocate order-level discount/shipping/giftWrap pro-rata** by goods subtotal share: `vendorValue = vendorGoods − discount·share + shipping·share + giftWrap·share` (share = vendorGoods / Σ goods). Round each vendor's value to 2 dp and reconcile the rounding remainder onto the largest-share vendor so Σ vendorValue === `Order.totalAmount` exactly.
3. Emit **one `ConversionEvent` per platform per vendor** with that vendor's `value`, `content_ids` limited to that vendor's items, and `eventId = ${orderId}:${vendorId}`.

### 8c. Refund / cancellation handling (closes the missing topic)

When an order/item transitions to **REFUNDED** or **CANCELLED** (the item-status PATCH and refund flows in `orders.ts`/`returns.ts`), fire negative-conversion adjustments so platform ROAS stays truthful:
- **Meta CAPI:** send a `Refund` event (or a negated-value purchase per Meta's refund schema) referencing the original `event_id`, scoped per vendor (only the refunded vendor's allocated value).
- **Google Ads:** issue a **conversion adjustment** (RETRACTION for full cancel, RESTATEMENT with reduced value for partial refund) keyed on the original `order_id`/`gclid`.
- Record a `ConversionEvent` row with `eventName = "Refund"` for audit + idempotency.

### 8d. Currency precision

- **Google** wants `amountMicros = round(rupees * 1_000_000)` with `currencyCode = "INR"`. Compute from the Prisma `Decimal` using integer-safe rounding (`Decimal.mul(1e6).toFixed(0)`), never float arithmetic. Combo prices use the inherited value (`combo.price ?? product.price`) before conversion.
- **Meta** `value` is a plain decimal with `currency: "INR"` (2 dp).
- Conversion `value` per vendor uses the rounded per-vendor allocation from §8b (Σ === order total).

### 8e. CAPI payload + dedup + PII
- `POST https://graph.facebook.com/v25.0/<DATASET_ID>/events`: `event_name: "Purchase"`, `event_time` (unix), `action_source: "website"`, **`event_id = ${orderId}:${vendorId}`** (the browser Pixel on the confirmation page sends the matching `event_id`).
- `user_data`: **SHA-256 of normalized** `em` (lowercase+trim email), `ph` (digits incl. country code) + **raw** `client_ip_address`, `client_user_agent`, `fbc`, `fbp` (NOT hashed; persisted on `Order` at checkout).
- `custom_data`: per-vendor `value`, `currency: "INR"`, `content_type: "product"`, `content_ids` = the same item ids used in the catalog (`productId` or `${productId}_${comboId}`), `contents` with per-item qty/price, `order_id`.
- **All of the above is gated on `Order.marketingConsent === GRANTED`** (no PII upload otherwise; non-PII server events may still fire where lawful).

### 8f. Client pixel/tag changes
- Move `track()` into `@jewel/lib`; add analytics to `apps/storefront` layout (currently absent); fire `view_item`/`ViewContent`, `add_to_cart`/`AddToCart`, `begin_checkout`/`InitiateCheckout`, and `Purchase` (with matching `event_id` + GA4 `items[]`) on confirmation. Inject scripts only after consent (§9). Set `NEXT_PUBLIC_GA4_ID` / `NEXT_PUBLIC_META_PIXEL_ID` in `apps/web` and `apps/storefront`.

### 8g. Conversion testing strategy
- **Meta:** use `test_event_code` against the dataset's Test Events tool to validate `Purchase`/`Refund` payloads and Event Match Quality before going live; verify browser+server dedup by confirming a single deduped event per `event_id`.
- **Google:** validate Merchant feed in Merchant Center diagnostics; (Phase 2) use the Google Ads conversion debug / `UploadClickConversions` validateOnly + offline-diagnostics to confirm gclid attribution and adjustments.

---

## 9. Security, privacy & compliance

- **Token encryption:** every token stored only as `encryptJson(...)` in `MarketingConnection.credentials`, decrypted on demand; same master key already asserted at boot; mask in admin UI. **Refresh** updates the encrypted blob in place (§3 `tokens.ts`).
- **Decryption audit logging (now scheduled, Phase 1):** wire `apps/api/src/lib/audit.ts` to log every token decryption (actor + purpose + connection id) in `tokens.getValidToken()`. This was previously a noted-but-unscheduled gap; it ships in Phase 1 with the token vault.
- **Consent / DPDP / GDPR (Phase 1, load-bearing):** pixels are injected only after the consent banner grants consent; the server gates CAPI/Google PII upload on `Order.marketingConsent === GRANTED`. India's **DPDP Act** disclosure of Meta/Google data sharing goes in the privacy policy; the schema + banner + checkout stamping in §4c make this enforceable rather than aspirational.
- **Scope minimization:** request only each phase's scopes (`catalog_management` + `business_management` for Phase-1 Meta; `content` for Google). Defer `ads_management` / `adwords` / `instagram_content_publish`.
- **PII normalization:** SHA-256 **after** normalization (bad normalization tanks Event Match Quality); send only hashed identifiers + the allowed raw network fields. Accept Google's customer-data terms before sending hashed data.
- **Image policy (closes missing topic):** feed `image_link` MUST be a publicly fetchable Cloudinary URL (no auth), meet platform **minimum dimensions** (Google ≥250×250 non-apparel, recommend ≥800px; Meta ≥500×500), and carry **no promotional overlays/watermarks/borders** (auto-disapproval). The feed builder picks `images[0]` as primary + `additional_image_link`, and the listing editor warns on too-small or overlaid images.
- **Rate limits & backoff (closes missing topic):** Phase 1 Meta is scheduled-fetch (no per-item ceiling concern). Google Merchant `products.insert` is throttled with bounded concurrency + exponential backoff + retry on 429/5xx; per-item failures persist to `ProductFeedState.errorMessage`. Phase 2 Meta `items_batch` respects the per-batch item ceiling, polls `check_batch_request_status`, and honours the low rate ceiling on a brand-new catalog.
- **Policy gotchas:** Start **Meta Business Verification + App Review** and **Google verification** day 1 (multi-week). Meta native US checkout deprecated (2025) → Shops/IG tags redirect to our storefront; the `Purchase` event closes the loop. Item ids stable/unique/namespaced per vendor. **Jewellery policy:** generally allowed, but loose gemstones/bullion/some precious-metal items can be restricted under Meta Commerce Policy — vet vendor categories before sync; use existing `hallmarked`/`huid`/`purity` for AI-caption disclaimers.

---

## 10. Phased roadmap

### Phase 1 — MVP (feed + Google Merchant + pixels + server Purchase + connect). *Narrowed & shippable.*
- [ ] Schema: feed fields on `Product`/`ProductVariationCombo`; new enums; **consent fields** on `User`/`Order` + click ids; `MarketingConnection`, `ProductFeedState`, `ConversionEvent`; run `npm run db:migrate`.
- [ ] `lib/marketing/feed.ts` — canonical Google-spec builder with **eligibility filter (§2a)**, **field validation (§2b)**, **combo price inheritance + variant rows**, **`googleProductCategory` mapping (§11)**, image-policy checks.
- [ ] `GET /api/marketing/feed.xml[?vendor=]` — **public, rate-limited**, ETag/cache; mounted public in `index.ts`.
- [ ] `lib/marketing/googleMerchant.ts` — Merchant API v1 `products.insert` (`external_seller_id`, `amountMicros`) with backoff; `metaCatalog.ts` — register `feed.xml` as a Meta **scheduled feed** (no batch in Phase 1).
- [ ] `lib/marketing/tokens.ts` — token refresh (Google offline refresh token; Meta System User for sync) + **audit-logged decryption**.
- [ ] OAuth connect/callback for Meta (System User for catalog) + Google (service account / offline OAuth).
- [ ] Consent banner (`@jewel/ui`) + checkout consent/click-id stamping in `orders.ts` (`/checkout` and `/cod`).
- [ ] Client pixels/tags: move `track()` to `@jewel/lib`, add analytics to storefront layout, fire the four funnel events consent-gated, set env IDs.
- [ ] **Server `Purchase` from BOTH paths** — `fireConversionEvents` in `confirmOrderPaid()` (claimed-only) **and** the `/cod` handler; **per-vendor value allocation (§8b)**; Meta CAPI w/ `event_id` dedup + hashed PII; record `ConversionEvent` per vendor.
- [ ] **Refund/cancel adjustments (§8c)** wired into the item-status/return transitions.
- [ ] `jobs/catalogSync.ts` — nightly reconcile + drift re-push; wired in the listen block; respects `DISABLE_BACKGROUND_JOBS`.
- [ ] Vendor dashboard: **Marketing** nav (between Payouts/Payment methods) + Connect / Catalog status / Tracking; listing-editor feed-fields step.
- [ ] **Conversion testing (§8g):** Meta `test_event_code` + Merchant Center diagnostics in staging before live.
- [ ] Kick off Meta Business Verification/App Review + Google verification (long-lead, parallel).

### Phase 2 — Meta batch, Google Ads upload, UTM/AI tooling, organic posting, operator ads
- [ ] Meta `items_batch` real-time upsert/delete (incremental via `ProductFeedState`) + polling/backoff.
- [ ] Google Ads server-side `UploadClickConversions` (gclid/gbraid/wbraid) for paid Shopping/PMax.
- [ ] Web PDP OG: restructure `apps/web` PDP into a server wrapper + client child to add `generateMetadata` (storefront already has it).
- [ ] UTM builder (`MarketingLink`) + short links + click tracking; AI captions via `ai.ts` (`aiAvailable()` gate); organic IG/FB posts (`ScheduledPost` + scheduler job + Ayrshare or native Meta publishing).
- [ ] Operator-run platform ads via the connected MCP servers (Advantage+ Catalog / PMax scoped by Product Set) + reporting into the dashboard.

### Phase 3 — Vendor self-serve ads & per-vendor isolation
- [ ] Programmatic per-vendor campaigns (Meta Marketing API / Google Ads API under System User / Partner Access / MCC), budget-capped "boost product".
- [ ] Per-vendor Pixel/Tag IDs (`Vendor.metaPixelId` / `ga4Id`, routed via `vendor-context.tsx`); per-vendor catalogs/sub-accounts for high-volume vendors; custom-domain verification reconciliation.
- [ ] `MarketingSpend` ledger + billing into payout/settlement; vendor-funded ad accounts via Partner Access.

---

## 11. Effort, risks & open questions

**Rough effort (engineer-weeks):**
- Phase 1 (narrowed): **3–5 weeks** eng + **2–6 weeks elapsed** on Meta/Google reviews (parallelizable). Feed generator + validation + sync job ~1.5w; OAuth/token vault + refresh + audit ~1w; tracking (client + dual-path CAPI + per-vendor split + refunds) ~1.5w; consent + vendor UI ~1w.
- Phase 2: **4–8 weeks** (Meta batch, Google upload, organic posting, AI/UTM, operator-ads polish).
- Phase 3: **6–10 weeks** (multi-tenant ad automation + billing).

**Top risks:**
1. **Review/verification gating** — start day 1; ship feed + tracking against the dev Business/test accounts first.
2. **Feed/site drift** — nightly reconcile + drift check (§2b); availability always from live stock.
3. **Conversion correctness** — COD path dropped (now fixed, §8a), per-vendor double-count (now allocated, §8b), `event_id`/`event_name` mistakes, PII normalization, Google web↔server double-count. Centralize in `conversions.ts` with tests + staged `test_event_code`.
4. **Consent compliance** — DPDP/GDPR; banner + server gating ship in Phase 1.
5. **Jewellery policy rejections** — vet loose gemstones/bullion before sync.
6. **`prisma db push` drift** — additive/nullable only; review the diff (repo root-owned → `sudo`; PM2 `jewel-api`).

**Open questions (genuinely deferred — not Phase-1 blockers):**
- Per-vendor vs platform Pixel/dataset (drives Phase 3 `Vendor.metaPixelId`).
- Ad-spend funding model (platform-absorbed vs vendor-billed vs vendor-funded account) → billing/payout design + Partner Access.
- Google topology: multi-seller (Phase 1) vs graduating select vendors to single-seller sub-accounts.
- Organic posting: rent Ayrshare vs build native Meta publishing — decide at Phase 2 by vendor count.
- `googleProductCategory` mapping **mechanism** (resolved to be in Phase 1, but pick one): per-`Category` manual assignment, a `CategoryGoogleMapping` table seeded from the existing jewellery-taxonomy seed, or AI-assisted mapping. (Recommendation: seed a `CategoryGoogleMapping` from the taxonomy seed and let vendors override per product.)