# jewel-marketplace — Feature Roadmap

A B2C multi-vendor jewellery marketplace (Flipkart/Amazon model). Tasks are grouped by quarter and ordered by ROI. Implement top-to-bottom; each task is scoped to be a 1–5 day chunk.

**Legend:** `[ ]` todo · `[~]` in progress · `[x]` done
**Effort:** S (≤1d) · M (2–3d) · L (4–7d) · XL (>1w, split further)
**Impact:** ★ low · ★★ medium · ★★★ high

---

## Q1 — Conversion Fundamentals
*Goal: stop leaking buyers who already want to buy. Biggest ROI work.*

### 1. Server-side cart
- [ ] **1.1** Add `Cart` + `CartItem` Prisma models (userId, items, variationComboId, quantity, updatedAt) — **S, ★★★**
- [ ] **1.2** Build `/api/cart` routes (GET, POST add, PATCH qty, DELETE item, DELETE clear) — **M, ★★★**
- [ ] **1.3** Migrate frontend Zustand cart to hydrate from server when logged in; merge guest cart on login — **M, ★★★**
- [ ] **1.4** Add abandoned-cart marker (`abandonedAt` timestamp set after 1h idle) — **S, ★★**

### 2. Wishlist & save-for-later
- [ ] **2.1** Add `Wishlist` model (userId, productId, addedAt, unique pair) — **S, ★★★**
- [ ] **2.2** Wishlist API routes (list, add, remove, count) — **S, ★★★**
- [ ] **2.3** Heart icon on product cards + PDP; wishlist page at `/account/wishlist` — **M, ★★★**
- [ ] **2.4** "Save for later" action in cart (moves item to wishlist) — **S, ★★**

### 3. Guest checkout & address book
- [ ] **3.1** Add `Address` model (userId, label, name, phone, line1, line2, city, state, pincode, isDefault) — **S, ★★★**
- [ ] **3.2** Address CRUD API + UI under `/account/addresses` — **M, ★★★**
- [ ] **3.3** Checkout picks from address book instead of one-off entry — **S, ★★★**
- [ ] **3.4** Guest checkout flow: email + phone only, auto-create user on payment — **M, ★★**

### 4. Product detail page (PDP) rebuild
- [ ] **4.1** Image gallery: zoom on hover, swipe on mobile, video-first if video present — **M, ★★★**
- [ ] **4.2** Sticky "Add to cart" + "Buy now" CTA on mobile scroll — **S, ★★★**
- [ ] **4.3** Delivery-by date estimator (pincode → vendor pickup → carrier ETA) — **M, ★★★**
- [ ] **4.4** Stock urgency ("Only 3 left") + recently viewed by N people (cached counter) — **S, ★★**
- [ ] **4.5** Related products section (same category, similar price band) — **S, ★★**
- [ ] **4.6** Recently viewed (localStorage → server when logged in) — **S, ★★**
- [ ] **4.7** Q&A section on PDP: buyer asks, vendor answers — new `ProductQuestion` model — **M, ★★**

### 5. Search upgrade
- [ ] **5.1** Pick engine — Meilisearch (self-host) or Algolia (managed). Decide & document — **S, ★★★**
- [ ] **5.2** Index Product on create/update/delete (background job) — **M, ★★★**
- [ ] **5.3** Faceted search: category, price range, metal, vendor, rating, in-stock — **M, ★★★**
- [ ] **5.4** Synonyms dictionary (jhumka↔earring, mangalsutra, kada↔bracelet, …) — **S, ★★★**
- [ ] **5.5** Search autosuggest dropdown (recent + popular + product previews) — **M, ★★**
- [ ] **5.6** "No results" fallback with category suggestions — **S, ★**

### 6. SEO foundation
- [ ] **6.1** JSON-LD structured data on PDP (Product, Offer, AggregateRating, BreadcrumbList) — **S, ★★★**
- [ ] **6.2** Dynamic `sitemap.xml` + `robots.txt` — **S, ★★★**
- [ ] **6.3** OG/Twitter card meta on PDP and category pages — **S, ★★**
- [ ] **6.4** Server-render PDP + category pages (SSR/ISR), not client-only — **M, ★★★**
- [ ] **6.5** Canonical URLs, slugged product URLs (`/products/<slug>-<id>`) — **S, ★★**

### 7. Notifications & lifecycle email
- [ ] **7.1** Transactional email setup (Resend / SES) + base templates — **S, ★★★**
- [ ] **7.2** Order lifecycle emails: placed, paid, shipped, delivered, refunded — **M, ★★★**
- [ ] **7.3** Abandoned-cart email job (24h after `abandonedAt`) — **M, ★★★**
- [ ] **7.4** Price-drop & back-in-stock subscriptions per product — **M, ★★**
- [ ] **7.5** Web push notifications (service worker + VAPID) — **L, ★★**

---

## Q2 — Trust & Jewellery Moat
*Goal: build the jewellery-specific differentiators that horizontals can't copy quickly.*

### 8. Jewellery domain model
- [ ] **8.1** Add `JewelleryDetails` model (productId, karat, purity, grossWeight, netWeight, stoneWeight, makingChargePct, wastagePct, hallmark, huid) — **M, ★★★**
- [ ] **8.2** Add `Certificate` model (productId, lab [BIS/IGI/GIA/SGL], number, fileUrl, issuedAt) — **S, ★★★**
- [ ] **8.3** Add `Stone` model (productId, type, shape, carat, clarity, colour, cut, count) — **M, ★★**
- [ ] **8.4** Vendor PDP edit form: jewellery fields, certificate upload, stone details — **L, ★★★**

### 9. Live metal pricing
- [ ] **9.1** `MetalRate` model (metal, purity, ratePerGram, source, fetchedAt) — **S, ★★★**
- [ ] **9.2** Daily cron to fetch gold/silver rates (MetalPriceAPI or scrape MCX) — **M, ★★★**
- [ ] **9.3** Price computation service: `(netWeight × rate) + making + wastage + stones + GST` — **M, ★★★**
- [ ] **9.4** Per-vendor toggle: static price OR live-priced — **S, ★★**
- [ ] **9.5** PDP "Price breakup" expandable section with line items — **M, ★★★**

### 10. Certificate & hallmark trust signals
- [ ] **10.1** BIS hallmark badge + HUID display on PDP — **S, ★★★**
- [ ] **10.2** Inline PDF/image certificate viewer (modal) — **S, ★★★**
- [ ] **10.3** Verified-vendor badge tied to KYC completion — **S, ★★**
- [ ] **10.4** Trust strip on PDP: hallmarked · certified · 30-day returns · free shipping — **S, ★★★**

### 11. Size guides & fit
- [ ] **11.1** Size guide modal per category (ring, bangle, chain length) with printable PDF — **M, ★★**
- [ ] **11.2** Ring sizer tool (print template + visual circle comparison) — **M, ★★**

### 12. Buyback & lifetime exchange
- [ ] **12.1** Extend `VendorReturnPolicy` (or new `VendorExchangePolicy`) with buyback/exchange terms — **S, ★★**
- [ ] **12.2** Display exchange policy on PDP — **S, ★★**
- [ ] **12.3** Buyer-side "Request exchange" flow on past orders — **L, ★★**

### 13. Try at Home (manual MVP)
- [ ] **13.1** "Try at Home" button on eligible products (vendor opt-in flag) — **S, ★★**
- [ ] **13.2** `TryAtHomeRequest` model (buyer, productIds, slot, address, status) — **M, ★★**
- [ ] **13.3** Admin queue + WhatsApp/email handoff to vendor — **M, ★★**

### 14. Escrow payouts (buyer protection)
- [ ] **14.1** Hold payouts until delivered + return window expired — **M, ★★★**
- [ ] **14.2** Vendor payout statement: pending / available / paid balances — **M, ★★★**
- [ ] **14.3** Admin trigger to release payout (manual first, automate later) — **S, ★★**

### 15. Payment options
- [ ] **15.1** Razorpay EMI / Cardless EMI enablement + UI on checkout — **M, ★★★**
- [ ] **15.2** UPI Intent flow polish + saved UPI IDs — **S, ★★**
- [ ] **15.3** Pay Later (Simpl / LazyPay via Razorpay) — **M, ★★**
- [ ] **15.4** Cash on Delivery rules (max value, pincode whitelist, vendor opt-in) — **M, ★★**

---

## Q3 — Seller Success
*Goal: make vendors successful so they don't churn. Flipkart Seller Hub / Amazon Seller Central analogues.*

### 16. Seller analytics dashboard
- [ ] **16.1** Aggregation queries: views, add-to-cart, orders, revenue, conversion rate, AOV — **M, ★★★**
- [ ] **16.2** Track product views (lightweight event table or PostHog) — **M, ★★★**
- [ ] **16.3** Dashboard page at `/vendor/analytics` with charts (Recharts) — **L, ★★★**
- [ ] **16.4** Top products, slow movers, return rate by product — **M, ★★**
- [ ] **16.5** Buyer demographics (city, repeat vs new) — **M, ★**

### 17. Bulk operations
- [ ] **17.1** CSV product import (template download, dry-run preview, error report) — **L, ★★★**
- [ ] **17.2** CSV product export — **S, ★★**
- [ ] **17.3** Bulk price/stock update by category or tag — **M, ★★**
- [ ] **17.4** Bulk image upload (drag-drop, auto-match by SKU) — **M, ★★**

### 18. Inventory management
- [ ] **18.1** Low-stock alert threshold per product + dashboard widget — **S, ★★★**
- [ ] **18.2** Low-stock email to vendor (daily digest) — **S, ★★**
- [ ] **18.3** Stock history log (changes, who/when/why) — **M, ★**
- [ ] **18.4** Reserved-stock handling during checkout (15-min hold) — **M, ★★★**

### 19. Returns & RTO workflow
- [ ] **19.1** `ReturnRequest` model (orderItemId, reason, mediaUrls, status, refundMode) — **M, ★★★**
- [ ] **19.2** Buyer flow: "Return this item" from orders page — **M, ★★★**
- [ ] **19.3** Vendor flow: approve/reject, generate return label — **L, ★★★**
- [ ] **19.4** Refund execution (Razorpay refund API) + order status updates — **M, ★★★**
- [ ] **19.5** Return reason analytics for vendors — **S, ★★**

### 20. GST invoicing
- [ ] **20.1** Add HSN code field per product (default by category) — **S, ★★★**
- [ ] **20.2** Capture vendor GSTIN + buyer billing state — **S, ★★★**
- [ ] **20.3** Invoice generator: CGST/SGST/IGST split by state comparison — **L, ★★★**
- [ ] **20.4** PDF invoice (Puppeteer/pdfkit) attached to order email — **M, ★★★**
- [ ] **20.5** Vendor invoice register / download all — **S, ★★**
- [ ] **20.6** (Optional) e-Invoice IRN integration (ClearTax/NIC) — **L, ★**

### 21. Vendor SLA & performance
- [ ] **21.1** Track: ship-on-time %, cancellation %, return %, avg rating — **M, ★★★**
- [ ] **21.2** Vendor scorecard page — **M, ★★**
- [ ] **21.3** Auto-warn / auto-suspend rules in admin — **M, ★★**

### 22. Promoted listings (revenue line)
- [ ] **22.1** `AdCampaign` model (vendorId, productId, bid, budget, dates) — **M, ★★★**
- [ ] **22.2** Bidding & ad slot logic on category/search pages — **L, ★★★**
- [ ] **22.3** Vendor self-serve ad UI + reporting — **L, ★★★**
- [ ] **22.4** Admin revenue dashboard for ads — **S, ★★**

### 23. Vendor KYC
- [ ] **23.1** KYC flow: PAN, GSTIN, bank account, cancelled cheque upload — **M, ★★★**
- [ ] **23.2** PAN/GSTIN validation API (Karza/Surepass/manual) — **M, ★★**
- [ ] **23.3** Verified badge unlocked on KYC complete — **S, ★★**

---

## Q4 — Growth Flywheel
*Goal: cheap, repeat re-engagement. Compounds over time.*

### 24. Referral & loyalty
- [ ] **24.1** Referral codes per user; reward both sides on first order — **M, ★★★**
- [ ] **24.2** Loyalty points: earn on order, redeem on cart — **L, ★★★**
- [ ] **24.3** Tier system (Silver/Gold/Platinum) with perks — **M, ★★**

### 25. Coupons UX polish
- [ ] **25.1** "Apply coupon" drawer on checkout with eligible-coupon list — **S, ★★**
- [ ] **25.2** First-order coupon auto-applied for new users — **S, ★★★**
- [ ] **25.3** Coupon performance analytics for vendors — **S, ★★**

### 26. Reviews & UGC
- [ ] **26.1** Photo/video review uploader polish + moderation queue — **M, ★★**
- [ ] **26.2** Verified-purchase badge — **S, ★★**
- [ ] **26.3** Helpful votes + sort by helpful — **S, ★★**
- [ ] **26.4** Vendor response to review — **S, ★★**
- [ ] **26.5** Review email after delivery (with photo bounty: ₹50 coupon) — **M, ★★★**

### 27. Mobile app (React Native)
- [ ] **27.1** Expo bootstrap + auth + product list — **L, ★★★**
- [ ] **27.2** PDP + cart + checkout — **XL, ★★★**
- [ ] **27.3** Push notifications (FCM/APNs) — **M, ★★★**
- [ ] **27.4** Play Store + App Store listings — **M, ★★**

### 28. Marketing campaigns
- [ ] **28.1** Festive landing pages (Akshaya Tritiya, Dhanteras, Diwali, weddings) — **M, ★★★**
- [ ] **28.2** Scheduled product drops with countdown — **M, ★★**
- [ ] **28.3** Email/push campaign builder for admin — **L, ★★**

### 29. Affiliate / influencer program
- [ ] **29.1** `Affiliate` model + unique tracking links — **M, ★★**
- [ ] **29.2** Attribution cookie + commission ledger — **M, ★★**
- [ ] **29.3** Affiliate dashboard with payouts — **L, ★★**

### 30. Analytics & ads infrastructure
- [ ] **30.1** GA4 + Meta Pixel + GTM setup — **S, ★★★**
- [ ] **30.2** Server-side conversion API (Meta CAPI) — **M, ★★★**
- [ ] **30.3** PostHog or Mixpanel for product analytics — **M, ★★**
- [ ] **30.4** Cohort + funnel dashboards — **M, ★★**

---

## Cross-cutting / platform hygiene
*Pick up alongside feature work as pain points appear.*

- [ ] **P.1** Test suite (Vitest for API, Playwright for critical flows) — **L, ★★★**
- [ ] **P.2** CI pipeline (lint + typecheck + test on PR) — **S, ★★★**
- [ ] **P.3** Error monitoring (Sentry both apps) — **S, ★★★**
- [ ] **P.4** Rate limiting + request validation (zod) on API — **M, ★★★**
- [ ] **P.5** Image CDN optimization (Cloudinary transformations, lazy load, AVIF) — **S, ★★**
- [ ] **P.6** Database backups + restore drill — **S, ★★★**
- [ ] **P.7** Staging environment — **M, ★★★**
- [ ] **P.8** Admin audit-log UI improvements — **S, ★**
- [ ] **P.9** Accessibility audit (Lighthouse, axe) — **M, ★★**
- [ ] **P.10** Performance budget (PDP LCP < 2.5s, CLS < 0.1) — **M, ★★★**

---

## How to use this document
1. Pick the next unchecked task starting from the top.
2. Tell Claude: *"Implement task 1.1"* (or the section name).
3. Claude will scope it, implement, and we mark it done.
4. Tasks within a section can usually be done in order; sections (Q1 → Q4) should also be respected — Q1 is highest ROI.
5. Adjust priority as we learn from real users; this is a living document.
