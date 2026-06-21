# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### From workspace root
```bash
npm run dev:api          # Start backend (port 4000, hot reload via tsx watch)
npm run dev:web          # Start customer storefront (port 3000)
npm run dev:vendor       # Start vendor dashboard (port 3001)
npm run dev:admin        # Start admin console (port 3002)
npm run dev:storefront   # Start per-vendor branded storefront (port 3003)
npm run db:migrate       # Sync schema to DB — runs `prisma db push` (NOT migrate; no migration files)
npm run db:studio        # Open Prisma Studio GUI (port 5555)
npm run build:all        # Build all five apps in sequence
```

### Production (PM2)
`ecosystem.config.js` runs all five apps as PM2 processes (`vrindaonline-api`, `vrindaonline-web`, `vrindaonline-vendor`, `vrindaonline-admin`, `vrindaonline-storefront`). Build first (`npm run build:all`), then:
```bash
npm run pm2:start   # / pm2:stop / pm2:restart / pm2:logs / pm2:status
```

### Backend (apps/api)
```bash
npm run build                      # tsc --noCheck → dist/ (type errors are NOT caught at build — run tsc separately to typecheck)
npm run start                      # node dist/index.js
npm run prisma:seed                # Create default admin (admin@vrindaonline.local / admin123)
npm run prisma:seed:jewellery-taxonomy   # Seed category tree / mega-menu / attributes (see other prisma:seed:* scripts)
npm run gen:enc-key                # Generate a value for ENCRYPTION_KEY (required — boot asserts it is set)
npm run algolia:reindex            # Rebuild the Algolia product index
```

### Frontend apps (apps/web | apps/vendor | apps/admin | apps/storefront)
```bash
npm run lint   # next lint
npm run build  # next build
```

No test suite is configured.

## Architecture

npm workspaces monorepo with five apps and two shared packages. All apps communicate with the single Express API over HTTP.

```
vrindaonline-marketplace/
├── apps/
│   ├── api/         Express + TypeScript backend (port 4000)
│   ├── web/         Next.js 14 customer marketplace storefront (port 3000)
│   ├── vendor/      Next.js 14 vendor dashboard (port 3001)
│   ├── admin/       Next.js 14 admin console (port 3002)
│   └── storefront/  Next.js 14 standalone per-vendor branded storefront (port 3003)
└── packages/
    ├── lib/         Shared utilities & Zustand stores (@jewel/lib)
    └── ui/          Shared React components (@jewel/ui)
```

`web` is the aggregate marketplace (browse all vendors); `storefront` is the per-vendor branded shop — its routes are rooted at `[vendorId]` with their own cart/checkout/account/orders and page-builder-driven pages (`[vendorId]/[pageSlug]`), and search is powered by Algolia / react-instantsearch rather than the API.

### Backend (`apps/api`)

Express REST API mounted at `/api/*` (route-to-mount mapping lives in `src/index.ts`). Notable route files in `src/routes/`:

- `auth.ts` — register, login, `/me`, password reset
- `products.ts` — CRUD with Cloudinary image upload, public listing/search
- `vendors.ts` — vendor profile creation and approval workflow
- `orders.ts` — order creation, Razorpay payment webhook, status updates
- `admin.ts` / `rbac.ts` — vendor approval, payout calc (gross − 10% commission), role/permission management
- `cart.ts`, `wishlist.ts`, `addresses.ts` — server-side persistence synced from the frontend Zustand stores
- `categories.ts`, `collections.ts`, `coupons.ts`, `reviews.ts`, `questions.ts` — catalog & merchandising
- `vendorPages.ts` — page-builder pages; exports both the authed router and a `publicRouter` mounted at `/api/storefront-pages` for the storefront app
- `shipping.ts`, `fulfillment.ts`, `returns.ts`, `payments.ts`, `assets.ts` (vendor media library, mounted under `/api/vendors`), `settings.ts`
- `marketing.ts` — vendor self-serve marketing hub + public product feed (`feed.xml`); `adminMarketing.ts` mounted at `/api/admin/marketing` is the admin operator surface (per-route perms) to manage any vendor's marketing
- `support.ts` — support tickets + realtime chat (customer/vendor/admin); realtime notifications ride the socket.io server

The Express app is wrapped in an explicit `http.createServer` so **socket.io** (`src/lib/realtime.ts`, `initRealtime`) shares the same port. Boot order: `assertEncryptionKeyConfigured()` first, then helmet (CSP off — API returns JSON only) + CORS (`src/lib/cors.ts`) + `express-rate-limit`. The raw request body is captured (`req.rawBody`) so webhook handlers can verify Razorpay HMAC signatures over the exact signed bytes. A top-level `unhandledRejection` handler swallows transient PgBouncer "connection closed" errors so Prisma can auto-reconnect.

`src/middleware/auth.ts` provides JWT verification and role-based guards (CUSTOMER / VENDOR / ADMIN). `src/lib/` exports singletons and helpers: `prisma`, `cloudinary`, `jwt`, `razorpay`, plus `crypto.ts` (field-level encryption — `assertEncryptionKeyConfigured()` runs at boot and aborts if `ENCRYPTION_KEY` is unset), `algolia.ts` (search index sync), `ai.ts` (Anthropic SDK), `email.ts` (nodemailer), `push.ts` (web-push), `whatsapp.ts`, `invoice.ts` (pdfkit PDF invoices), `payouts.ts` (manual-settlement ledger; pluggable provider later), `realtime.ts` (socket.io), `logger.ts` (pino), `revalidate.ts` (Next.js ISR triggers), `orderConfirm.ts`, `fulfillmentSync.ts`, `audit.ts`, `coupon.ts`, `shipping.ts`, `states.ts`, `support-access.ts`, `vendor-slug.ts`, `themePresets.ts`, `blockSchemas.ts`.

`src/jobs/` holds setInterval-based background jobs started in `index.ts` on listen: `abandonedCart.ts`, `autoDeliver.ts`, `settlement.ts`, `catalogSync.ts`, `supportAutoClose.ts`.

**Database:** PostgreSQL via Prisma 5. Schema at `apps/api/prisma/schema.prisma`. Key relationships: User → Vendor (optional, one-to-one) → Products; User → Orders → OrderItems → Product + Vendor. OrderItem has its own status field to support split-vendor shipping.

### Shared Packages

**`packages/lib` (`@jewel/lib`)** — utilities & Zustand stores used by all frontend apps:
- `api.ts` — fetch wrapper that injects JWT from localStorage
- `cart.ts` / `cart-api.ts` — Zustand cart store (single-vendor rule, localStorage + server sync)
- `permissions.ts` — RBAC hook + `/api/auth/me` cache
- `currency.ts` / `currency.config.ts` — currency Zustand store
- `wishlist.ts`, `addresses.ts`, `recently-viewed.ts`, `vendor-context.tsx`

**`packages/ui` (`@jewel/ui`)** — shared React components:
- `dashboard/DashboardShell` — sidebar nav shell (used by both vendor and admin)
- `listing-editor/` — multi-step product creation wizard (vendor)
- `blocks/` — page builder section types (vendor storefront)
- `storefront/` — Header, Footer, ProductCard, MegaMenu (customer web)
- `products/`, `search/`, `media/`, `landing/`, etc.

Both packages use TypeScript path aliases in each app's `tsconfig.json`:
```
@/components/* → packages/ui/src/*
@/lib/*        → packages/lib/src/*
```
And `transpilePackages: ['@jewel/ui', '@jewel/lib']` in each app's `next.config.js`.

### Frontend Apps

**`apps/web`** — customer storefront (port 3000):
- `src/app/(main)/` — public routes: home, products, cart, checkout, account, orders
- `src/app/store/[vendorId]/` — public vendor storefronts

**`apps/vendor`** — vendor dashboard (port 3001):
- `src/app/(dashboard)/` — all vendor panel routes (products, orders, analytics, storefront, payouts…)
- `src/app/auth/` — vendor login/register
- `src/app/onboard/` — KYC onboarding flow

**`apps/admin`** — admin console (port 3002):
- `src/app/(dashboard)/` — all admin panel routes (vendor approvals, payouts, RBAC, categories…)
- `src/app/auth/login/` — admin login

### Auth flow

JWT issued on login, stored in localStorage by the frontend. The `api()` helper in `@jewel/lib` attaches it as `Authorization: Bearer <token>`. Backend middleware decodes it and attaches `req.user`. Role checks happen per-route.

### Environment variables

Backend (`apps/api/.env`): `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `ENCRYPTION_KEY` (required — generate via `npm run gen:enc-key`; the process refuses to boot without it), `CLOUDINARY_*`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `PLATFORM_COMMISSION_PERCENT` (default 10), `WEB_ORIGIN`, Algolia (`ALGOLIA_*`), Anthropic (`ANTHROPIC_API_KEY`), and SMTP/email settings for nodemailer.

All frontend apps (`apps/*/.env`): `NEXT_PUBLIC_API_URL` (points to backend, e.g. `http://localhost:4000`). The `storefront` app additionally needs the public Algolia keys (`NEXT_PUBLIC_ALGOLIA_*`) for client-side search.
