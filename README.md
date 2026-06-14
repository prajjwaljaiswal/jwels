# Vrindaonline Marketplace

A multi-vendor jewellery e-commerce platform (B2C, Flipkart/Amazon-style). Vendors register and get manually approved by an admin, then list and sell products. Customers browse the marketplace, add to cart, and check out via Razorpay. The platform earns a flat commission (default 10%) on each order.

## Stack

- **Backend:** Node.js + Express + TypeScript + Prisma
- **Database:** PostgreSQL (schema synced with `prisma db push` — there are no migration files)
- **Frontend:** Next.js 14 (App Router), Zustand, Tailwind
- **Auth:** JWT (stored in localStorage, sent as `Authorization: Bearer`)
- **Images/media:** Cloudinary
- **Payments:** Razorpay
- **Search:** Algolia (react-instantsearch on the storefront app)
- **Email:** nodemailer (SMTP)
- **AI (optional):** Anthropic SDK — powers page-block / theme generation in the vendor storefront builder

## Project structure

npm workspaces monorepo — five apps and two shared packages, all talking to the single Express API over HTTP.

```
vrindaonline-marketplace/
├── apps/
│   ├── api/         # Express + TypeScript backend         (port 4000)
│   ├── web/         # Customer marketplace storefront       (port 3000)
│   ├── vendor/      # Vendor dashboard                      (port 3001)
│   ├── admin/       # Admin console                         (port 3002)
│   └── storefront/  # Standalone per-vendor branded shop    (port 3003)
└── packages/
    ├── lib/         # Shared utilities & Zustand stores (@jewel/lib)
    └── ui/          # Shared React components (@jewel/ui)
```

`web` is the aggregate marketplace (browse across all vendors). `storefront` is the per-vendor branded shop — routes are rooted at `[vendorId]`, with their own cart/checkout/account and page-builder-driven pages, and search runs through Algolia rather than the API.

See [CLAUDE.md](./CLAUDE.md) for the full architecture breakdown.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Create a `.env` in `apps/api` and a `.env` (or `.env.local`) in each frontend app. Each app ships an `.env.example` as a starting point — but note the backend code requires a few keys not yet listed in `apps/api/.env.example`.

**`apps/api/.env`:**
- `DATABASE_URL` — Postgres connection string (Neon, Supabase, or local)
- `JWT_SECRET` — 32+ random bytes (`openssl rand -hex 32`)
- `ENCRYPTION_KEY` — **required**; the API refuses to boot without it. Generate one with `npm --prefix apps/api run gen:enc-key`.
- `CLOUDINARY_*` — free credentials at cloudinary.com
- `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` — from the Razorpay dashboard
- `PLATFORM_COMMISSION_PERCENT` — platform cut per order (default `10`)
- `WEB_ORIGIN` — CORS origin for the web app
- Algolia keys (`ALGOLIA_*`) — for product indexing/search
- SMTP settings — for nodemailer (password reset, notifications)
- `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` — optional, enables AI page/theme generation

**Each frontend app (`apps/{web,vendor,admin,storefront}/.env`):**
- `NEXT_PUBLIC_API_URL` — backend base URL (e.g. `http://localhost:4000`)
- `storefront` additionally needs the public Algolia keys (`NEXT_PUBLIC_ALGOLIA_*`) for client-side search

### 3. Set up the database

```bash
npm run db:migrate          # prisma db push — syncs schema.prisma to the DB
npm --prefix apps/api run prisma:seed   # creates the default admin + RBAC roles
```

Optional catalog seed data (category tree, mega-menu, jewellery attributes) lives in the other `prisma:seed:*` scripts — see `apps/api/package.json`.

### 4. Start the dev servers

Run whichever apps you need (each in its own terminal):

```bash
npm run dev:api          # http://localhost:4000
npm run dev:web          # http://localhost:3000
npm run dev:vendor       # http://localhost:3001
npm run dev:admin        # http://localhost:3002
npm run dev:storefront   # http://localhost:3003
```

## Default admin

After seeding:
- Email: `admin@vrindaonline.local`
- Password: `admin123` (change immediately)

The seed also creates system RBAC roles (`SUPER_ADMIN`, `VENDOR_MODERATOR`, `FINANCE`, `CATALOG_MANAGER`, …) used by the admin console.

## Key flows

1. **Vendor signup** → vendor fills out shop profile and completes KYC onboarding → admin approves in the admin console.
2. **Vendor adds products** in the vendor dashboard (only after approval), using the multi-step listing editor.
3. **Vendor builds their storefront** — page-builder blocks, theme, mega-menu — served by the standalone `storefront` app.
4. **Customer browses** the marketplace, adds to cart (single-vendor rule), and checks out via Razorpay.
5. **Vendor manages orders** — marks items shipped/delivered; an auto-deliver background job advances stale shipments.
6. **Admin handles payouts** — the payouts view shows the balance owed per vendor (gross minus platform commission).

## Production

All five apps run under PM2 via `ecosystem.config.js`:

```bash
npm run build:all   # build api + all four Next.js apps
npm run pm2:start   # / pm2:stop / pm2:restart / pm2:logs / pm2:status
```

## Tests

No test suite is configured.
