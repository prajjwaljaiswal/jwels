---
name: etsy-style
description: Apply Etsy-inspired visual design to the jewel-marketplace storefront, vendor dashboard, and admin panel. Use when building or restyling any Next.js page in apps/web — product grids, product detail, cart/checkout, auth, vendor shop manager, admin approval/payouts. Encodes Etsy's color palette, typography, spacing, component patterns (product card, filter rail, dashboard shell), and tone so every surface feels like one cohesive marketplace.
---

# Etsy-Style Design Skill — Jewel Marketplace

This skill captures Etsy's marketplace design language and adapts it for the three audiences in this app: **shoppers** (storefront), **vendors** (shop manager), and **admins** (operations console). Use it any time you generate or edit UI in `apps/web`.

## 1. Foundations

### Color tokens
Etsy's brand is a warm orange paired with deep neutrals and a cream/off-white canvas. Encode these as CSS variables in `apps/web/src/app/globals.css`:

```css
:root {
  /* Brand */
  --color-orange-600: #F1641E;   /* primary CTA, brand */
  --color-orange-700: #D5530F;   /* hover */
  --color-orange-50:  #FFF1E8;   /* tinted backgrounds, badges */

  /* Neutrals */
  --color-ink-900: #222222;      /* primary text, logo */
  --color-ink-700: #595959;      /* body */
  --color-ink-500: #8F8F8F;      /* secondary / meta */
  --color-line:    #E1E3DF;      /* hairline borders */
  --color-canvas:  #FAF9F5;      /* page background (warm cream) */
  --color-surface: #FFFFFF;      /* cards */

  /* Semantic */
  --color-success: #2E7D32;      /* "In stock", approved */
  --color-warn:    #B26A00;      /* sale, low stock */
  --color-danger:  #C5221F;
  --color-star:    #F1641E;      /* review stars use brand orange */

  /* Radii & shadow */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-pill: 999px;
  --shadow-card: 0 1px 2px rgba(0,0,0,.04);
  --shadow-pop:  0 8px 24px rgba(0,0,0,.10);
}
```

### Typography
Etsy uses **Graphik** (proprietary). Use the closest free pairing:

- Headings: `Söhne`, fall back to **Inter** (700 / 600).
- Body: **Inter** 400/500.
- Display (hero, shop name banner): **Recoleta** or **DM Serif Display** for an artisanal touch. Reserve for hero headlines and shop names — not for UI chrome.

Type scale (rem):
```
xs 0.75 / sm 0.875 / base 1 / lg 1.125 / xl 1.25 / 2xl 1.5 / 3xl 2 / 4xl 2.5 / 5xl 3.25
line-height: 1.5 body, 1.2 display
letter-spacing: -0.01em on headings, 0.04em uppercase eyebrows
```

### Spacing & layout
- 8-pt grid. Card padding 16, section padding 32–64.
- Container max width **1440px** with 24–32px gutters; product grid breakpoints 2 / 3 / 4 / 5 cols at 480/768/1024/1440.
- Hairlines `1px solid var(--color-line)`; never use heavy shadows for separation.

### Buttons
- Primary: `bg-orange-600 text-white rounded-pill px-6 py-3 font-semibold`, hover `orange-700`, focus ring `2px orange-600 / offset 2`.
- Secondary: `bg-white text-ink-900 border border-ink-900 rounded-pill`.
- Tertiary / link: `text-ink-900 underline underline-offset-4 hover:text-orange-700`.
- Pill shape is the Etsy signature — apply to most CTAs except dense table buttons (use `rounded-md` there).

### Iconography
Use **lucide-react**. 20px in chrome, 16px inline with text. Heart icon for favorites is outlined by default, fills `--color-orange-600` when active.

## 2. Storefront patterns (`apps/web/src/app/...`)

### Global header
Two-row sticky header on `/` and `/products`:
1. **Top row** (h-16): logo left (orange wordmark), centered search bar, right icons (Sign in, Cart with badge, Heart/Favorites). Search is a **pill** with inset category dropdown on the left and an orange circular search button on the right.
2. **Category strip** (h-11): horizontally scrollable text links — Necklaces / Earrings / Rings / Bracelets / Bridal / Gifting. Underline on hover, no background fill.

Mobile collapses to logo + cart + hamburger; search drops to its own row.

### Home / `/`
- **Hero**: full-bleed editorial photo, left-aligned headline in the serif display font, subhead, two pill CTAs ("Shop new arrivals" primary, "Become a vendor" secondary).
- **Category tiles**: 6 circular images with text under each. 96–128px circles, gap-8.
- **Curated rails**: horizontally scrollable rows of product cards titled "Editor's picks", "Under ₹2,000", "Bestsellers". Use `overflow-x-auto snap-x` and a gradient mask at the right edge.
- **Trust band**: 4-up grid — Certified vendors • Free returns • Secure payments (Razorpay) • Hallmarked gold. Icon + 1-line copy.

### Product card (`<ProductCard />`)
The most-reused component. Build once and import everywhere.
```
container: relative, rounded-md, hover:shadow-pop transition
image: aspect-square, object-cover, rounded-md
heart: absolute top-2 right-2, 32px white circle, drop-shadow
badge: absolute top-2 left-2, "Bestseller" / "Sale −20%" / "Free shipping" — pill, bg-white/90 backdrop-blur, text-xs font-semibold
content: pt-3 px-1
  line 1: vendor name — text-xs text-ink-500
  line 2: title — text-sm text-ink-900, clamp 2 lines
  line 3: stars (orange, 14px) + "(124)" review count text-xs text-ink-500
  line 4: price text-base font-bold; struck-through MRP next to it in text-ink-500
  optional: green text-xs "Free shipping"
```
Hover: subtle lift + secondary image swap if `images[1]` exists.

### Listing / `/products`
Two-column 240px filter rail + grid:
- Filter rail: collapsible accordions — Category, Material (Gold/Silver/Diamond/Gemstone), Price (range slider with two number inputs), Vendor, Rating (★ and up). Active filters render as **dismissible chips** above the grid.
- Sort dropdown right-aligned: Relevance / Newest / Price ↑↓ / Top reviewed.
- Result count + breadcrumb on the left.
- Grid: 4 cols desktop, 3 tablet, 2 mobile.

### Product detail / `/products/[id]`
Two-column above the fold:
- Left: gallery — vertical thumbnail strip (5 images) + main image, square 1:1, zoom on hover.
- Right column (sticky):
  1. Vendor link (small) → shop page
  2. Title (text-2xl, serif optional)
  3. Stars + review count + "X sold"
  4. Price block, optional sale chip
  5. Variant pickers (Size, Metal) as pill swatches
  6. Quantity stepper + **two stacked CTAs**: orange "Add to cart" pill, black outlined "Buy it now"
  7. Highlights checklist (Hallmarked, Ships in 2 days, 30-day returns) with green check icons
  8. Collapsible: Description / Materials / Shipping & returns / Reviews
- Below the fold: "Reviews" with photo thumbnails, 5-star bar chart, then "More from this shop" rail and "You may also like" rail.

### Cart, checkout, auth
- Cart `/checkout`: line items left, sticky order summary right with order total, taxes, shipping, "Place order" pill. Apply the Razorpay handoff inline.
- Auth pages: centered 420px card, serif headline "Sign in" or "Create your account", inputs with floating labels and 1px borders that thicken to ink-900 on focus, social-auth optional below a "or" divider.

## 3. Vendor shop manager (`/vendor/*`)

Modeled on Etsy Shop Manager — sidebar shell, dashboard cards, batch tables.

### Layout shell `<VendorShell />`
- Left sidebar 240px, white, hairline border. Sections:
  - **Dashboard** (home icon)
  - **Listings** (tag) — sub: All, Active, Drafts, Sold out
  - **Orders** (package) — sub: To ship, Shipped, Completed
  - **Reviews** (star)
  - **Payouts** (wallet)
  - **Shop settings** (sliders)
- Top bar: shop name + "View shop" link, notifications bell, avatar.
- Active sidebar item: bg `--color-orange-50`, text `--color-ink-900`, left 3px orange bar.

### Dashboard `/vendor`
Above-the-fold KPI cards (4-up): Today's revenue • Orders to ship • Views (7d) • Conversion. Each card is white, 24px padding, label in xs uppercase ink-500, value in 3xl bold ink-900, delta chip green/red with arrow.

Below: "Orders to ship" table (max 5 rows + "View all"), "Recent reviews" list, "Listings to refresh" prompt card with orange CTA.

### Listings `/vendor/products`
Etsy's batch-edit pattern:
- Toolbar: search, status tabs (All / Active / Draft / Sold out), bulk-select with bulk actions (Activate, Deactivate, Edit price, Delete) shown only when rows are checked.
- Table columns: checkbox • thumbnail (48×48) • title + SKU • price (inline editable) • stock • status pill • actions (kebab).
- Empty state: illustration + "Add your first listing" pill CTA.

### Listing editor
Two-column form: left scrolls (Title, Description rich text, Photos drop-zone with reorder, Category, Materials chips, Price/Stock/SKU, Variants table, Shipping profile). Right column is a **sticky preview** rendering the actual `<ProductCard />` and detail snippet so vendors see exactly what shoppers see. Bottom action bar: "Save draft" secondary, "Publish" primary orange pill.

### Orders `/vendor/orders`
Tab strip (To ship / Shipped / Completed / Cancelled) with counts. Cards per order showing buyer initials avatar, items thumbnails, total, ship-by date in red if overdue, primary action "Print label" / "Mark shipped".

## 4. Admin console (`/admin/*`)

More dense and operational. Same color palette but pull contrast up — use `--color-canvas` only on the page bg, white surfaces with stronger borders.

### Layout `<AdminShell />`
Same sidebar pattern as vendor but sections: **Overview, Vendor approvals, Products, Orders, Payouts, Users, Reports, Settings**. Add a small "ADMIN" eyebrow above the logo.

### Overview `/admin`
Top metrics 4-up: GMV (30d), Orders, Active vendors, Pending approvals (clickable → approval queue). Below: stacked area chart of GMV, table of "Vendors awaiting approval" with inline Approve / Reject buttons, and "Payouts due this week".

### Vendor approval queue `/admin/vendors`
List of pending vendors as cards: logo, business name, GST, submitted-at, KYC docs as thumbnail chips → click to preview modal. Two-button footer: outlined "Reject" (opens reason modal) and orange pill "Approve". Approved vendors move to a second tab.

### Payouts `/admin/payouts`
Table — vendor, gross, commission (10%), net payout, period, status. Filter by date range and status. Row action: "Mark paid" opens confirm modal showing the math (`gross × 0.9`).

## 5. Tone & copy

Etsy's voice is warm, human, slightly handcrafted. Apply to micro-copy:
- Buttons: "Add to cart", "Save for later", "Make it yours" (not "Submit").
- Empty states: "No favorites yet — start a wishlist" with a gentle illustration.
- Confirmation: "Order placed — your jeweler is getting it ready ✨" (only place an emoji is acceptable; user must opt-in to others).
- Error: friendly first ("Something went sideways"), then technical detail in smaller text.

## 6. Implementation checklist

When you build or restyle a page, verify:
- [ ] Page background is `--color-canvas`, cards are white.
- [ ] Primary CTAs are orange pills; never blue.
- [ ] Body text is `--color-ink-700`, headings `--color-ink-900`; no pure black.
- [ ] Product cards reuse the shared `<ProductCard />` — do **not** re-implement per page.
- [ ] Stars, hearts, and active filter chips all use the brand orange.
- [ ] Vendor and admin pages use the sidebar shell, not the storefront header.
- [ ] All inputs are 44px tall, 1px ink border, focus ring orange.
- [ ] Pages are responsive at 480/768/1024/1440.
- [ ] Loading skeletons match card shape (rounded-md, aspect-square for product image area).

## 7. Suggested file structure

```
apps/web/src/
  components/
    ui/              # Button, Input, Pill, Chip, Stars, Skeleton
    storefront/      # Header, CategoryStrip, ProductCard, FilterRail, Hero
    vendor/          # VendorShell, KpiCard, ListingsTable, OrderCard
    admin/           # AdminShell, ApprovalCard, PayoutTable
  app/
    layout.tsx       # storefront shell (default)
    vendor/layout.tsx
    admin/layout.tsx
```

Tailwind: extend `theme.colors` with the tokens above, and add `borderRadius.pill: '999px'`. Avoid arbitrary values — always reference tokens so the palette stays consistent.

## References

- Etsy brand orange `#F1641E` ([BrandColorCode](https://www.brandcolorcode.com/etsy), [Mobbin](https://mobbin.com/colors/brand/etsy))
- Etsy Shop Manager structure ([SellingOS guide](https://sellingos.com/etsy-shop-manager-complete-guide-2025/), [Gelato 2026 guide](https://www.gelato.com/blog/etsy-shop-manager))
- Card design conventions ([WPDean roundup](https://wpdean.com/product-card-design/))
