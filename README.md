# Jewel Marketplace

A multi-vendor jewelry e-commerce platform. Vendors register, get manually approved by admin, and sell their products. Customers browse, add to cart, and checkout via Razorpay.

## Stack

- **Backend:** Node.js + Express + TypeScript + Prisma
- **Database:** PostgreSQL
- **Frontend:** Next.js 14 (App Router)
- **Auth:** JWT
- **Images:** Cloudinary
- **Payments:** Razorpay (one-time payment to platform, vendor payouts handled manually)

## Project Structure

```
jewel-marketplace/
├── apps/
│   ├── api/          # Express backend
│   └── web/          # Next.js frontend (storefront + vendor + admin)
└── package.json      # workspace root
```

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` in both `apps/api` and `apps/web`:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

Fill in:
- `DATABASE_URL` — Postgres connection string (Neon, Supabase, or local)
- `JWT_SECRET` — any long random string
- `CLOUDINARY_*` — get free credentials at cloudinary.com
- `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` — get from razorpay.com dashboard

### 3. Run database migrations

```bash
cd apps/api
npx prisma migrate dev --name init
npx prisma db seed     # creates default admin user
```

### 4. Start dev servers

In two terminals:

```bash
npm run dev:api    # http://localhost:4000
npm run dev:web    # http://localhost:3000
```

## Default admin

After seeding:
- Email: `admin@jewel.local`
- Password: `admin123` (change immediately)

## Key flows

1. **Vendor signup** → vendor fills shop profile → admin approves at `/admin/vendors`
2. **Vendor adds products** at `/vendor/products` (only after approval)
3. **Customer browses** at `/products`, adds to cart, checks out via Razorpay
4. **Vendor sees orders** at `/vendor/orders`, marks as shipped/delivered
5. **Admin handles payouts manually** by viewing `/admin/payouts` (shows balance owed per vendor minus platform commission)

## What's intentionally not included (yet)

- Search (use Postgres `ILIKE` for now; add Meilisearch later)
- Reviews & ratings
- Wishlist
- Email notifications (add Resend when needed)
- Refunds (handle manually via Razorpay dashboard)

These are easy to add once the core works.
