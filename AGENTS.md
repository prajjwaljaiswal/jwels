# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Commands

### From workspace root
```bash
npm run dev:api       # Start backend (port 4000, hot reload via tsx watch)
npm run dev:web       # Start customer storefront (port 3000)
npm run dev:vendor    # Start vendor dashboard (port 3001)
npm run dev:admin     # Start admin console (port 3002)
npm run db:migrate    # Run Prisma migrations
npm run db:studio     # Open Prisma Studio GUI (port 5555)
```

### Backend (apps/api)
```bash
npm run build              # tsc → dist/
npm run start              # node dist/index.js
npm run prisma:seed        # Create default admin (admin@jewel.local / admin123)
```

### Frontend apps (apps/web | apps/vendor | apps/admin)
```bash
npm run lint   # next lint
npm run build  # next build
```

No test suite is configured.

## Architecture

npm workspaces monorepo with four apps and two shared packages. All apps communicate with the single Express API over HTTP.

```
jewel-marketplace/
├── apps/
│   ├── api/        Express + TypeScript backend (port 4000)
│   ├── web/        Next.js 14 customer storefront (port 3000)
│   ├── vendor/     Next.js 14 vendor dashboard (port 3001)
│   └── admin/      Next.js 14 admin console (port 3002)
└── packages/
    ├── lib/        Shared utilities & Zustand stores (@jewel/lib)
    └── ui/         Shared React components (@jewel/ui)
```

### Backend (`apps/api`)

Express REST API mounted at `/api/*`. Route files in `src/routes/` map to resources:

- `auth.ts` — register, login, `/me`
- `products.ts` — CRUD with Cloudinary image upload, public listing/search
- `vendors.ts` — vendor profile creation and approval workflow
- `orders.ts` — order creation, Razorpay payment webhook, status updates
- `admin.ts` — vendor approval, payout calculation (gross − 10% commission)

`src/middleware/auth.ts` provides JWT verification and role-based guards (CUSTOMER / VENDOR / ADMIN). `src/lib/` exports singletons for Prisma, Cloudinary, JWT helpers, and the Razorpay SDK.

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

Backend (`apps/api/.env`): `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CLOUDINARY_*`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `PLATFORM_COMMISSION_PERCENT` (default 10), `WEB_ORIGIN`.

All frontend apps (`apps/*/env`): `NEXT_PUBLIC_API_URL` (points to backend, e.g. `http://localhost:4000`).
