import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { Role, VendorStatus, BusinessType, KycStatus, CategoryApprovalStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';
import { uploadBuffer } from '../lib/cloudinary';
import { encryptString, decryptString, maskSecret } from '../lib/crypto';
import { isValidVendorSlug, RESERVED_VENDOR_SLUGS, resolveVendorId, uniqueVendorSlug, VENDOR_UUID_RE } from '../lib/vendor-slug';
import { listPresets, getPreset, SYSTEM_TITLES, type SystemPageKind } from '../lib/themePresets';
import { SYSTEM_PAGE_SLUGS } from '../lib/blockSchemas';

const router = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

const onboardSchema = z.object({
  shopName: z.string().min(2),
  description: z.string().optional(),
  address: z.string().optional(),
  shopLogoUrl: z.string().url().optional(),
});

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

const themeSchema = z.object({
  colors: z.object({
    primary:     hex.optional(),
    accent:      hex.optional(),
    background:  hex.optional(),
    text:        hex.optional(),
    headerBg:    hex.optional(),
    headerText:  hex.optional(),
    footerBg:    hex.optional(),
    footerText:  hex.optional(),
  }).partial().optional(),
  typography: z.object({
    headingFont: z.enum(['serif', 'sans', 'display']).optional(),
    bodyFont:    z.enum(['serif', 'sans']).optional(),
  }).partial().optional(),
  header: z.object({
    announcement: z.string().max(200).optional(),
    showSearch:   z.boolean().optional(),
    showMarketplaceLink: z.boolean().optional(),
    logoHeight:   z.number().int().min(16).max(200).optional(),   // logo render height in px
    logoMaxWidth: z.number().int().min(40).max(600).optional(),   // optional max-width cap in px
    navLinks: z.array(z.object({
      label: z.string().min(1).max(40),
      href:  z.string().min(1).max(300),
    })).max(8).optional(),
  }).partial().optional(),
  footer: z.object({
    about: z.string().max(500).optional(),
    columns: z.array(z.object({
      title: z.string().min(1).max(40),
      links: z.array(z.object({
        label: z.string().min(1).max(40),
        href:  z.string().min(1).max(300),
      })).max(10),
    })).max(4).optional(),
    socials: z.array(z.object({
      platform: z.enum(['instagram','facebook','twitter','youtube','whatsapp','pinterest','tiktok','linkedin']),
      url: z.string().url(),
    })).max(8).optional(),
    contactEmail: z.string().email().optional().or(z.literal('')),
    contactPhone: z.string().max(40).optional(),
    copyright:    z.string().max(200).optional(),
  }).partial().optional(),
  faviconUrl: z.string().url().max(2000).optional().or(z.literal('')), // vendor-uploaded favicon
  animations: z.object({
    enabled: z.boolean().optional(),
    style:   z.enum(['fade', 'fade-up', 'left', 'right', 'zoom']).optional(),
    speed:   z.enum(['slow', 'normal', 'fast']).optional(),
    stagger: z.boolean().optional(),
    hover:   z.boolean().optional(),
  }).partial().optional(),
}).strict();

const settingsSchema = z.object({
  shopName:     z.string().min(2).optional(),
  slug:         z.string().min(3).max(60).optional().transform((v) => v?.trim().toLowerCase() || undefined),
  tagline:      z.string().max(120).optional(),
  description:  z.string().max(1000).optional(),
  address:      z.string().optional(),
  themeColor:   hex.optional(),
  customDomain: z.string().max(253).optional().transform((v) => v?.trim().toLowerCase() || undefined),
  theme:        z.string().optional(), // JSON string from multipart form
});

// ── STEPPED ONBOARDING WIZARD ────────────────────────────────────────────────

const PAN_REGEX  = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const GST_REGEX  = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;

const stepShopSchema = z.object({
  shopName:    z.string().min(2).max(60),
  tagline:     z.string().max(120).optional(),
  description: z.string().max(1000).optional(),
});

const stepBusinessSchema = z.object({
  businessType: z.nativeEnum(BusinessType),
  legalName:    z.string().min(2).max(120),
  panNumber:    z.string().regex(PAN_REGEX, 'PAN must be 10 chars, format ABCDE1234F'),
  gstin:        z.string().regex(GST_REGEX, 'Invalid GSTIN').optional().or(z.literal('')),
}).refine(
  (d) => d.businessType === 'INDIVIDUAL' || (d.gstin && d.gstin.length > 0),
  { message: 'GSTIN is required for non-individual businesses', path: ['gstin'] }
);

const stepBankSchema = z.object({
  bankAccountName:   z.string().min(2).max(120),
  bankAccountNumber: z.string().regex(/^[0-9]{9,18}$/, 'Account number must be 9–18 digits'),
  bankIfsc:          z.string().regex(IFSC_REGEX, 'Invalid IFSC code'),
});

const stepAddressSchema = z.object({
  contactName: z.string().min(2).max(80),
  phone:       z.string().min(7).max(20),
  line1:       z.string().min(2).max(200),
  line2:       z.string().max(200).optional(),
  city:        z.string().min(1).max(80),
  state:       z.string().min(1).max(80),
  postalCode:  z.string().min(3).max(12),
  country:     z.string().min(2).max(2).default('IN'),
});

const stepBrandingSchema = z.object({
  themeColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

function vendorPublicView(v: any) {
  return {
    ...v,
    panNumber:         v.panNumber ? maskSecret(decryptString(v.panNumber) || '') : null,
    bankAccountNumber: v.bankAccountNumber ? maskSecret(decryptString(v.bankAccountNumber) || '') : null,
  };
}

async function ensureVendor(userId: string) {
  let v = await prisma.vendor.findUnique({ where: { userId } });
  if (!v) {
    v = await prisma.vendor.create({
      data: { userId, shopName: 'Untitled shop', status: VendorStatus.PENDING, kycStatus: KycStatus.NOT_SUBMITTED },
    });
  }
  return v;
}

// GET current onboarding state (used by the wizard to resume)
router.get('/me/onboarding', requireAuth, requireRole(Role.VENDOR), async (req, res) => {
  const v = await ensureVendor(req.user!.id);
  const addr = await prisma.vendorAddress.findUnique({ where: { vendorId: v.id } });
  const stepsDone = {
    1: !!v.shopName && v.shopName !== 'Untitled shop',
    2: !!v.businessType && !!v.legalName && !!v.panNumber,
    3: !!v.bankAccountName && !!v.bankAccountNumber && !!v.bankIfsc,
    4: !!addr,
    5: !!v.shopLogoUrl || (v.bannerUrls && v.bannerUrls.length > 0) || !!v.themeColor,
    6: !!v.idDocumentUrl,
  };
  const completed = Object.values(stepsDone).filter(Boolean).length;
  const nextStep = ([1, 2, 3, 4, 5, 6] as const).find((s) => !stepsDone[s]) ?? 6;
  res.json({
    vendor: vendorPublicView({ ...v, pickupAddress: addr }),
    stepsDone,
    completed,
    total: 6,
    nextStep,
    submitted: v.kycStatus !== KycStatus.NOT_SUBMITTED,
    kycStatus: v.kycStatus,
    kycRejectionNote: v.kycRejectionNote,
  });
});

const stepUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

// PATCH /onboard/step/:step — partial save per step.
router.patch(
  '/onboard/step/:step',
  requireAuth,
  requireRole(Role.VENDOR),
  stepUpload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'banner', maxCount: 1 },
    { name: 'idDocument', maxCount: 1 },
  ]),
  async (req, res, next) => {
    try {
      const step = Number(req.params.step);
      if (![1, 2, 3, 4, 5, 6].includes(step)) return res.status(400).json({ error: 'Invalid step' });

      const v = await ensureVendor(req.user!.id);
      const files = (req.files as Record<string, Express.Multer.File[]>) || {};
      const updates: Record<string, any> = {};

      if (step === 1) {
        const p = stepShopSchema.safeParse(req.body);
        if (!p.success) return res.status(400).json({ error: p.error.flatten() });
        Object.assign(updates, p.data);
      } else if (step === 2) {
        const p = stepBusinessSchema.safeParse(req.body);
        if (!p.success) return res.status(400).json({ error: p.error.flatten() });
        updates.businessType = p.data.businessType;
        updates.legalName    = p.data.legalName;
        updates.panNumber    = encryptString(p.data.panNumber.toUpperCase());
        updates.gstin        = p.data.gstin ? p.data.gstin.toUpperCase() : null;
      } else if (step === 3) {
        const p = stepBankSchema.safeParse(req.body);
        if (!p.success) return res.status(400).json({ error: p.error.flatten() });
        updates.bankAccountName   = p.data.bankAccountName;
        updates.bankAccountNumber = encryptString(p.data.bankAccountNumber);
        updates.bankIfsc          = p.data.bankIfsc.toUpperCase();
      } else if (step === 4) {
        const p = stepAddressSchema.safeParse(req.body);
        if (!p.success) return res.status(400).json({ error: p.error.flatten() });
        await prisma.vendorAddress.upsert({
          where: { vendorId: v.id },
          update: p.data,
          create: { vendorId: v.id, ...p.data },
        });
      } else if (step === 5) {
        const p = stepBrandingSchema.safeParse(req.body);
        if (!p.success) return res.status(400).json({ error: p.error.flatten() });
        if (p.data.themeColor) updates.themeColor = p.data.themeColor;
        if (files.logo?.[0])   updates.shopLogoUrl = await uploadBuffer(files.logo[0].buffer, 'logos');
        if (files.banner?.[0]) {
          const url = await uploadBuffer(files.banner[0].buffer, 'banners');
          updates.bannerUrls = [...(v.bannerUrls || []), url].slice(0, 5);
        }
      } else if (step === 6) {
        if (!files.idDocument?.[0]) return res.status(400).json({ error: 'idDocument file is required' });
        updates.idDocumentUrl = await uploadBuffer(files.idDocument[0].buffer, 'kyc');
      }

      updates.onboardingStep = Math.max(v.onboardingStep ?? 0, step);
      const updated = await prisma.vendor.update({ where: { id: v.id }, data: updates });
      res.json(vendorPublicView(updated));
    } catch (e) { next(e); }
  }
);

// POST /onboard/submit — final submit, requires all steps complete.
router.post('/onboard/submit', requireAuth, requireRole(Role.VENDOR), async (req, res) => {
  const v = await prisma.vendor.findUnique({ where: { userId: req.user!.id } });
  if (!v) return res.status(404).json({ error: 'Vendor profile not created' });
  const addr = await prisma.vendorAddress.findUnique({ where: { vendorId: v.id } });

  const missing: string[] = [];
  if (!v.shopName || v.shopName === 'Untitled shop') missing.push('shop');
  if (!v.businessType || !v.legalName || !v.panNumber) missing.push('business');
  if (!v.bankAccountName || !v.bankAccountNumber || !v.bankIfsc) missing.push('bank');
  if (!addr) missing.push('address');
  if (!v.idDocumentUrl) missing.push('idDocument');
  if (missing.length) return res.status(400).json({ error: 'Incomplete', missing });

  const updated = await prisma.vendor.update({
    where: { id: v.id },
    data: {
      kycStatus: KycStatus.UNDER_REVIEW,
      status: v.status === VendorStatus.REJECTED ? VendorStatus.PENDING : v.status,
      kycRejectionNote: null,
      onboardingStep: 6,
    },
  });
  res.json(vendorPublicView(updated));
});

// Vendor onboard (legacy single-form profile create/update — kept for backward compat)
router.post('/onboard', requireAuth, requireRole(Role.VENDOR), async (req, res) => {
  const parsed = onboardSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = await prisma.vendor.findUnique({ where: { userId: req.user!.id } });
  if (existing) {
    const updated = await prisma.vendor.update({ where: { id: existing.id }, data: parsed.data });
    return res.json(updated);
  }
  const vendor = await prisma.vendor.create({
    data: { ...parsed.data, userId: req.user!.id, status: VendorStatus.PENDING },
  });
  res.status(201).json(vendor);
});

// Vendor update storefront settings (logo, banners, theme, domain)
router.patch(
  '/me/settings',
  requireAuth,
  requireRole(Role.VENDOR),
  upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'banners', maxCount: 5 }, { name: 'favicon', maxCount: 1 }]),
  async (req, res, next) => {
    try {
      const vendor = await prisma.vendor.findUnique({ where: { userId: req.user!.id } });
      if (!vendor) return res.status(404).json({ error: 'Vendor profile not created' });

      const parsed = settingsSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

      const files = req.files as Record<string, Express.Multer.File[]>;
      const { theme: themeJson, ...rest } = parsed.data;
      const updates: Record<string, any> = { ...rest };

      if (themeJson !== undefined) {
        try {
          const parsedTheme = themeSchema.safeParse(JSON.parse(themeJson));
          if (!parsedTheme.success) {
            return res.status(400).json({ error: { theme: parsedTheme.error.flatten() } });
          }
          updates.theme = parsedTheme.data;
        } catch {
          return res.status(400).json({ error: 'Invalid theme JSON' });
        }
      }

      if (files?.logo?.[0]) {
        updates.shopLogoUrl = await uploadBuffer(files.logo[0].buffer, 'logos');
      }

      // Favicon: upload the file and merge its URL into the theme JSON. Uses the
      // client-sent theme (if any) as the base, else the vendor's existing theme,
      // so a favicon upload never clobbers other theme settings.
      if (files?.favicon?.[0]) {
        const faviconUrl = await uploadBuffer(files.favicon[0].buffer, 'favicons');
        const baseTheme = (updates.theme ?? (vendor.theme as any) ?? {}) as Record<string, any>;
        updates.theme = { ...baseTheme, faviconUrl };
      }

      // keepBannerUrls: existing URLs the client wants to retain (JSON array string)
      let keepUrls: string[] = [];
      if (req.body.keepBannerUrls) {
        try { keepUrls = JSON.parse(req.body.keepBannerUrls); } catch {}
      }

      // Upload new banner files
      const newBannerUrls: string[] = [];
      if (files?.banners?.length) {
        await Promise.all(
          files.banners.map(async (f) => {
            const url = await uploadBuffer(f.buffer, 'banners');
            newBannerUrls.push(url);
          })
        );
      }

      // Final ordered array: kept existing + newly uploaded (max 5)
      updates.bannerUrls = [...keepUrls, ...newBannerUrls].slice(0, 5);

      // Check custom domain uniqueness if provided
      if (updates.customDomain) {
        const conflict = await prisma.vendor.findUnique({ where: { customDomain: updates.customDomain } });
        if (conflict && conflict.id !== vendor.id) {
          return res.status(409).json({ error: 'This domain is already in use by another shop.' });
        }
      }

      // Validate + check slug uniqueness if provided
      if (updates.slug) {
        if (!isValidVendorSlug(updates.slug)) {
          return res.status(400).json({ error: { slug: 'Slug must be 3–60 lowercase letters, digits or dashes.' } });
        }
        if (RESERVED_VENDOR_SLUGS.has(updates.slug)) {
          return res.status(400).json({ error: { slug: 'This slug is reserved. Please choose another.' } });
        }
        const conflict = await prisma.vendor.findUnique({ where: { slug: updates.slug } });
        if (conflict && conflict.id !== vendor.id) {
          return res.status(409).json({ error: { slug: 'This URL is taken by another shop.' } });
        }
      }

      const updated = await prisma.vendor.update({ where: { id: vendor.id }, data: updates });
      res.json(updated);
    } catch (e) { next(e); }
  }
);

router.get('/me', requireAuth, requireRole(Role.VENDOR), async (req, res) => {
  const vendor = await prisma.vendor.findUnique({ where: { userId: req.user!.id } });
  if (!vendor) return res.status(404).json({ error: 'Vendor profile not created' });
  res.json(vendor);
});

router.get('/me/orders', requireAuth, requireRole(Role.VENDOR), async (req, res) => {
  const vendor = await prisma.vendor.findUnique({ where: { userId: req.user!.id } });
  if (!vendor) return res.status(404).json({ error: 'Vendor profile not created' });

  const items = await prisma.orderItem.findMany({
    where: { vendorId: vendor.id },
    include: {
      product: { select: { name: true, images: true } },
      order: {
        select: {
          id: true,
          status: true,
          paymentMethod: true,
          shippingAddress: true,
          createdAt: true,
          customer: { select: { name: true, email: true, phone: true } },
        },
      },
      shipment: { select: { id: true, status: true, awb: true, labelUrl: true, carrierName: true } },
    },
    orderBy: { order: { createdAt: 'desc' } },
  });
  res.json(items);
});

// ── VENDOR DASHBOARD KPIs ────────────────────────────────────────────────────

router.get('/me/dashboard', requireAuth, requireRole(Role.VENDOR), async (req, res) => {
  const vendor = await prisma.vendor.findUnique({ where: { userId: req.user!.id } });
  if (!vendor) return res.status(404).json({ error: 'Vendor profile not created' });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 6); // include today → 7 buckets

  const [todayItems, weekItems, toShip, products] = await Promise.all([
    prisma.orderItem.findMany({
      where: { vendorId: vendor.id, status: { in: ['PAID', 'SHIPPED', 'DELIVERED'] }, order: { createdAt: { gte: today } } },
      select: { priceAtPurchase: true, quantity: true },
    }),
    prisma.orderItem.findMany({
      where: { vendorId: vendor.id, status: { in: ['PAID', 'SHIPPED', 'DELIVERED'] }, order: { createdAt: { gte: weekAgo } } },
      select: { priceAtPurchase: true, quantity: true, order: { select: { createdAt: true } } },
    }),
    prisma.orderItem.count({
      where: { vendorId: vendor.id, status: 'PAID' },
    }),
    prisma.product.findMany({
      where: { vendorId: vendor.id, isActive: true },
      select: { id: true, stockQuantity: true },
    }),
  ]);

  const sumGross = (rows: { priceAtPurchase: any; quantity: number }[]) =>
    rows.reduce((s, r) => s + Number(r.priceAtPurchase) * r.quantity, 0);

  const todayRevenue = sumGross(todayItems);

  // 7-day series, each entry { dateISO, revenue }
  const buckets: { dateISO: string; revenue: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    buckets.push({ dateISO: d.toISOString().slice(0, 10), revenue: 0 });
  }
  for (const it of weekItems) {
    const key = new Date(it.order.createdAt).toISOString().slice(0, 10);
    const b = buckets.find((x) => x.dateISO === key);
    if (b) b.revenue += Number(it.priceAtPurchase) * it.quantity;
  }

  const last7Revenue = buckets.reduce((s, b) => s + b.revenue, 0);
  const lowStockCount = products.filter((p) => p.stockQuantity > 0 && p.stockQuantity <= 3).length;
  const outOfStockCount = products.filter((p) => p.stockQuantity === 0).length;

  res.json({
    todayRevenue,
    last7Revenue,
    series: buckets,
    ordersToShip: toShip,
    activeListings: products.length,
    lowStockCount,
    outOfStockCount,
  });
});

// ── VENDOR ANALYTICS ─────────────────────────────────────────────────────────

router.get('/me/analytics', requireAuth, requireRole(Role.VENDOR), async (req, res) => {
  const vendor = await prisma.vendor.findUnique({ where: { userId: req.user!.id } });
  if (!vendor) return res.status(404).json({ error: 'Vendor profile not created' });

  const days = Math.min(Math.max(parseInt((req.query.days as string) || '30', 10) || 30, 7), 90);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));

  const items = await prisma.orderItem.findMany({
    where: { vendorId: vendor.id, status: { in: ['PAID', 'SHIPPED', 'DELIVERED'] }, order: { createdAt: { gte: start } } },
    include: {
      product: { select: { id: true, name: true, images: true } },
      order:   { select: { id: true, createdAt: true } },
    },
  });

  // Daily series
  const buckets: { dateISO: string; revenue: number; orders: number; units: number }[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    buckets.push({ dateISO: d.toISOString().slice(0, 10), revenue: 0, orders: 0, units: 0 });
  }
  const seenOrderPerDay = new Map<string, Set<string>>();
  let totalRevenue = 0;
  let totalUnits = 0;
  const orderIdsTotal = new Set<string>();

  // Top products
  const byProduct = new Map<string, { id: string; name: string; image: string | null; revenue: number; units: number }>();

  for (const it of items) {
    const dateKey = new Date(it.order.createdAt).toISOString().slice(0, 10);
    const b = buckets.find((x) => x.dateISO === dateKey);
    const itemRev = Number(it.priceAtPurchase) * it.quantity;
    if (b) {
      b.revenue += itemRev;
      b.units   += it.quantity;
      const s = seenOrderPerDay.get(dateKey) ?? new Set();
      s.add(it.orderId);
      seenOrderPerDay.set(dateKey, s);
      b.orders = s.size;
    }
    totalRevenue += itemRev;
    totalUnits   += it.quantity;
    orderIdsTotal.add(it.orderId);

    const p = byProduct.get(it.product.id) ?? {
      id: it.product.id,
      name: it.product.name,
      image: it.product.images[0] ?? null,
      revenue: 0,
      units: 0,
    };
    p.revenue += itemRev;
    p.units   += it.quantity;
    byProduct.set(it.product.id, p);
  }

  const topProducts = Array.from(byProduct.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  const avgOrderValue = orderIdsTotal.size > 0 ? totalRevenue / orderIdsTotal.size : 0;

  res.json({
    days,
    totalRevenue,
    totalOrders: orderIdsTotal.size,
    totalUnits,
    avgOrderValue,
    series: buckets,
    topProducts,
  });
});

// ── VENDOR PAYOUTS / EARNINGS ────────────────────────────────────────────────
//
// Payouts aren't persisted yet — we compute live from OrderItem status.
// DELIVERED + paid = payable balance. PAID/SHIPPED items are pipeline.
// Once a real Settlement model exists, this endpoint should subtract already-paid.

router.get('/me/payouts', requireAuth, requireRole(Role.VENDOR), async (req, res) => {
  const vendor = await prisma.vendor.findUnique({ where: { userId: req.user!.id } });
  if (!vendor) return res.status(404).json({ error: 'Vendor profile not created' });

  const commissionRate = Number(process.env.PLATFORM_COMMISSION_PERCENT || 10) / 100;

  const items = await prisma.orderItem.findMany({
    where: { vendorId: vendor.id, status: { in: ['PAID', 'SHIPPED', 'DELIVERED'] } },
    include: {
      product: { select: { id: true, name: true, images: true } },
      order:   { select: { id: true, createdAt: true } },
      payoutItem: { select: { id: true, payoutId: true } },
    },
    orderBy: { order: { createdAt: 'desc' } },
  });

  let payable = 0;     // delivered, not yet settled
  let settled = 0;     // delivered and already included in a payout
  let pipeline = 0;    // paid/shipped, not yet delivered
  let lifetimeGross = 0;
  let lifetimeCommission = 0;
  const recent: any[] = [];

  for (const it of items) {
    const gross = Number(it.priceAtPurchase) * it.quantity;
    const commission = gross * commissionRate;
    const payout = gross - commission;
    lifetimeGross += gross;
    lifetimeCommission += commission;
    if (it.status === 'DELIVERED') {
      if (it.payoutItem) settled += payout;
      else payable += payout;
    } else {
      pipeline += payout;
    }
    recent.push({
      orderItemId: it.id,
      orderId: it.orderId,
      orderCreatedAt: it.order.createdAt,
      status: it.status,
      product: it.product,
      quantity: it.quantity,
      gross,
      commission,
      payout,
      settled: !!it.payoutItem,
    });
  }

  // Settlement history (the real payout ledger).
  const settlements = await prisma.payout.findMany({
    where: { vendorId: vendor.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  res.json({
    commissionRate,
    payable,
    settled,
    pipeline,
    lifetimeGross,
    lifetimeCommission,
    lifetimePayout: lifetimeGross - lifetimeCommission,
    bank: {
      accountName: vendor.bankAccountName,
      accountNumber: vendor.bankAccountNumber ? maskSecret(decryptString(vendor.bankAccountNumber) || '') : null,
      ifsc: vendor.bankIfsc,
    },
    items: recent.slice(0, 100),
    settlements,
  });
});

// ── VENDOR REVIEWS MODERATION ────────────────────────────────────────────────

router.get('/me/reviews', requireAuth, requireRole(Role.VENDOR), async (req, res) => {
  const vendor = await prisma.vendor.findUnique({ where: { userId: req.user!.id } });
  if (!vendor) return res.status(404).json({ error: 'Vendor profile not created' });

  const filter = (req.query.filter as string) || 'all'; // all | unanswered | answered | hidden
  const where: any = { product: { vendorId: vendor.id } };
  if (filter === 'unanswered') where.vendorResponse = null;
  if (filter === 'answered')   where.vendorResponse = { not: null };
  if (filter === 'hidden')     where.isHidden = true;

  const reviews = await prisma.review.findMany({
    where,
    include: {
      product:  { select: { id: true, name: true, images: true } },
      customer: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  // Aggregate stars for the header.
  const all = await prisma.review.findMany({
    where: { product: { vendorId: vendor.id }, isHidden: false },
    select: { rating: true },
  });
  const total = all.length;
  const avg = total ? all.reduce((s, r) => s + r.rating, 0) / total : 0;
  const breakdown: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  for (const r of all) breakdown[r.rating] = (breakdown[r.rating] || 0) + 1;

  res.json({ reviews, total, averageRating: avg, ratingBreakdown: breakdown });
});

const responseSchema = z.object({
  vendorResponse: z.string().min(2).max(1000),
});

router.patch('/me/reviews/:id/respond', requireAuth, requireRole(Role.VENDOR), async (req, res) => {
  const parsed = responseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const vendor = await prisma.vendor.findUnique({ where: { userId: req.user!.id } });
  if (!vendor) return res.status(404).json({ error: 'Vendor profile not created' });

  const review = await prisma.review.findUnique({
    where: { id: req.params.id },
    include: { product: { select: { vendorId: true } } },
  });
  if (!review || review.product.vendorId !== vendor.id) {
    return res.status(404).json({ error: 'Review not found' });
  }
  const updated = await prisma.review.update({
    where: { id: review.id },
    data: { vendorResponse: parsed.data.vendorResponse, vendorRespondedAt: new Date() },
  });
  res.json(updated);
});

router.patch('/me/reviews/:id/hide', requireAuth, requireRole(Role.VENDOR), async (req, res) => {
  const vendor = await prisma.vendor.findUnique({ where: { userId: req.user!.id } });
  if (!vendor) return res.status(404).json({ error: 'Vendor profile not created' });
  const review = await prisma.review.findUnique({
    where: { id: req.params.id },
    include: { product: { select: { vendorId: true } } },
  });
  if (!review || review.product.vendorId !== vendor.id) {
    return res.status(404).json({ error: 'Review not found' });
  }
  const next = !review.isHidden;
  const updated = await prisma.review.update({ where: { id: review.id }, data: { isHidden: next } });
  res.json(updated);
});

// ── VENDOR CATEGORY PROPOSALS ────────────────────────────────────────────────

const categoryProposalSchema = z.object({
  name:        z.string().min(2).max(60),
  description: z.string().max(500).optional(),
  parentId:    z.string().uuid().optional(),
});

function slugifyCat(name: string) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'category';
}

// GET /api/vendors/me/categories — vendor's own proposals (any status)
router.get('/me/categories', requireAuth, requireRole(Role.VENDOR), async (req, res) => {
  const vendor = await prisma.vendor.findUnique({ where: { userId: req.user!.id } });
  if (!vendor) return res.status(404).json({ error: 'Vendor profile not created' });
  const rows = await prisma.category.findMany({
    where: { proposedByVendorId: vendor.id },
    orderBy: { createdAt: 'desc' },
    include: { parent: { select: { id: true, name: true, slug: true } } },
  });
  res.json(rows);
});

// POST /api/vendors/me/categories — vendor proposes a new category.
// Requires KYC-verified, APPROVED-status vendor (same gate as listing products).
router.post('/me/categories', requireAuth, requireRole(Role.VENDOR), async (req, res, next) => {
  try {
    const parsed = categoryProposalSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const vendor = await prisma.vendor.findUnique({ where: { userId: req.user!.id } });
    if (!vendor) return res.status(404).json({ error: 'Vendor profile not created' });
    if (vendor.status !== VendorStatus.APPROVED || vendor.kycStatus !== KycStatus.VERIFIED) {
      return res.status(403).json({ error: 'Only verified shops can propose new categories' });
    }

    // Parent must be APPROVED and a root (mirrors validateParent in categories.ts).
    if (parsed.data.parentId) {
      const parent = await prisma.category.findUnique({
        where: { id: parsed.data.parentId },
        select: { parentId: true, approvalStatus: true, isActive: true },
      });
      if (!parent || !parent.isActive || parent.approvalStatus !== 'APPROVED') {
        return res.status(400).json({ error: 'Parent category is not available' });
      }
      if (parent.parentId) {
        return res.status(400).json({ error: 'Categories are limited to 2 levels — parent must be a top-level category' });
      }
    }

    // Slug: derive from name + ensure uniqueness in the table.
    let slug = slugifyCat(parsed.data.name);
    let n = 1;
    while (await prisma.category.findUnique({ where: { slug } })) {
      n += 1;
      slug = `${slugifyCat(parsed.data.name)}-${n}`;
    }

    const created = await prisma.category.create({
      data: {
        name:               parsed.data.name,
        slug,
        description:        parsed.data.description,
        parentId:           parsed.data.parentId,
        isActive:           false, // gated until approved
        approvalStatus:     CategoryApprovalStatus.PROPOSED,
        proposedByVendorId: vendor.id,
      },
    });
    res.status(201).json(created);
  } catch (e) { next(e); }
});

// Public: lookup vendor by custom domain
router.get('/by-domain/:domain', async (req, res) => {
  const vendor = await prisma.vendor.findUnique({
    where: { customDomain: req.params.domain.toLowerCase() },
    select: { id: true, slug: true, shopName: true, shopLogoUrl: true, bannerUrls: true, tagline: true, description: true, themeColor: true, theme: true, status: true },
  });
  if (!vendor || vendor.status !== VendorStatus.APPROVED) {
    return res.status(404).json({ error: 'Vendor not found' });
  }
  res.json(vendor);
});

// Public: vendor storefront by ID or slug
router.get('/:vendorId', async (req, res) => {
  const key = req.params.vendorId;
  const where = VENDOR_UUID_RE.test(key) ? { id: key } : { slug: key };
  const vendor = await prisma.vendor.findUnique({
    where,
    select: {
      id: true,
      slug: true,
      shopName: true,
      shopLogoUrl: true,
      bannerUrls: true,
      tagline: true,
      description: true,
      themeColor: true,
      theme: true,
      status: true,
      kycStatus: true,
      createdAt: true,
      pickupAddress: { select: { city: true, state: true, country: true } },
    },
  });
  if (!vendor || vendor.status !== VendorStatus.APPROVED) {
    return res.status(404).json({ error: 'Vendor not found' });
  }
  const products = await prisma.product.findMany({
    where: { vendorId: vendor.id, isActive: true, status: 'ACTIVE' },
    include: {
      category: { select: { name: true, slug: true } },
      shopSection: { select: { id: true, slug: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  const sections = await prisma.vendorSection.findMany({
    where: { vendorId: vendor.id },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, name: true, slug: true, position: true },
  });

  // Shop-level review aggregate (averaged across all visible products).
  const productIds = products.map((p) => p.id);
  let aggregate = { averageRating: 0, totalReviews: 0 };
  if (productIds.length > 0) {
    const reviewStats = await prisma.review.aggregate({
      where: { productId: { in: productIds }, isHidden: false },
      _avg: { rating: true },
      _count: { _all: true },
    });
    aggregate = {
      averageRating: reviewStats._avg.rating ? Math.round(reviewStats._avg.rating * 10) / 10 : 0,
      totalReviews: reviewStats._count._all,
    };
  }

  res.json({ vendor, products, sections, aggregate });
});

// ── SHOP SECTIONS ────────────────────────────────────────────────────────────

const sectionSchema = z.object({
  name: z.string().min(1).max(40),
  position: z.number().int().min(0).optional(),
});

function slugify(name: string) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'section';
}

router.get('/me/sections', requireAuth, requireRole(Role.VENDOR), async (req, res) => {
  const vendor = await prisma.vendor.findUnique({ where: { userId: req.user!.id } });
  if (!vendor) return res.status(404).json({ error: 'Vendor profile not created' });
  const rows = await prisma.vendorSection.findMany({
    where: { vendorId: vendor.id },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
  });
  res.json(rows);
});

router.post('/me/sections', requireAuth, requireRole(Role.VENDOR), async (req, res) => {
  const parsed = sectionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const vendor = await prisma.vendor.findUnique({ where: { userId: req.user!.id } });
  if (!vendor) return res.status(404).json({ error: 'Vendor profile not created' });
  let slug = slugify(parsed.data.name);
  // ensure unique within vendor
  let counter = 1;
  while (await prisma.vendorSection.findUnique({ where: { vendorId_slug: { vendorId: vendor.id, slug } } })) {
    slug = `${slugify(parsed.data.name)}-${++counter}`;
  }
  const created = await prisma.vendorSection.create({
    data: { vendorId: vendor.id, name: parsed.data.name, slug, position: parsed.data.position ?? 0 },
  });
  res.status(201).json(created);
});

router.patch('/me/sections/:id', requireAuth, requireRole(Role.VENDOR), async (req, res) => {
  const parsed = sectionSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const vendor = await prisma.vendor.findUnique({ where: { userId: req.user!.id } });
  if (!vendor) return res.status(404).json({ error: 'Vendor profile not created' });
  const existing = await prisma.vendorSection.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.vendorId !== vendor.id) return res.status(404).json({ error: 'Section not found' });
  const updated = await prisma.vendorSection.update({
    where: { id: existing.id },
    data: {
      name: parsed.data.name ?? existing.name,
      position: parsed.data.position ?? existing.position,
    },
  });
  res.json(updated);
});

router.delete('/me/sections/:id', requireAuth, requireRole(Role.VENDOR), async (req, res) => {
  const vendor = await prisma.vendor.findUnique({ where: { userId: req.user!.id } });
  if (!vendor) return res.status(404).json({ error: 'Vendor profile not created' });
  const existing = await prisma.vendorSection.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.vendorId !== vendor.id) return res.status(404).json({ error: 'Section not found' });
  await prisma.vendorSection.delete({ where: { id: existing.id } });
  res.status(204).end();
});

// Public: storefront category nav — categories the vendor actually has active
// products in, returned as a parent→children tree (capped at 2 levels by schema).
router.get('/:vendorId/categories', async (req, res) => {
  const vendorId = await resolveVendorId(req.params.vendorId);
  if (!vendorId) return res.json([]);

  // Distinct categoryIds across this vendor's active products.
  const rows = await prisma.product.findMany({
    where: { vendorId, isActive: true, status: 'ACTIVE' },
    select: { categoryId: true },
    distinct: ['categoryId'],
  });
  const leafIds = rows.map((r) => r.categoryId);
  if (leafIds.length === 0) return res.json([]);

  const leaves = await prisma.category.findMany({
    where: { id: { in: leafIds }, isActive: true },
    select: { id: true, name: true, slug: true, parentId: true, sortOrder: true },
  });
  const parentIds = Array.from(new Set(leaves.map((l) => l.parentId).filter(Boolean) as string[]));
  const parents = parentIds.length
    ? await prisma.category.findMany({
        where: { id: { in: parentIds }, isActive: true },
        select: { id: true, name: true, slug: true, sortOrder: true },
      })
    : [];

  // Roots: leaves with no parent + parents inferred from sub-leaves.
  const rootMap = new Map<string, { id: string; name: string; slug: string; sortOrder: number; children: { id: string; name: string; slug: string; sortOrder: number }[] }>();
  for (const p of parents) {
    rootMap.set(p.id, { ...p, children: [] });
  }
  for (const l of leaves) {
    if (l.parentId && rootMap.has(l.parentId)) {
      rootMap.get(l.parentId)!.children.push({ id: l.id, name: l.name, slug: l.slug, sortOrder: l.sortOrder });
    } else if (!l.parentId) {
      // Leaf is itself a root category
      rootMap.set(l.id, { id: l.id, name: l.name, slug: l.slug, sortOrder: l.sortOrder, children: [] });
    }
  }
  const tree = Array.from(rootMap.values())
    .map((r) => ({ ...r, children: r.children.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)) }))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  res.json(tree);
});

// Public: storefront section list (used to render filter chips)
router.get('/:vendorId/sections', async (req, res) => {
  const vendorId = await resolveVendorId(req.params.vendorId);
  if (!vendorId) return res.json([]);
  const rows = await prisma.vendorSection.findMany({
    where: { vendorId },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, name: true, slug: true, position: true },
  });
  res.json(rows);
});

// ── RETURN POLICIES ──────────────────────────────────────────────────────────

const returnPolicySchema = z.object({
  name:            z.string().min(1).max(60),
  accepted:        z.boolean().optional(),
  days:            z.number().int().min(0).max(365).optional(),
  buyerPaysReturn: z.boolean().optional(),
  notes:           z.string().max(500).optional(),
});

router.get('/me/return-policies', requireAuth, requireRole(Role.VENDOR), async (req, res) => {
  const vendor = await prisma.vendor.findUnique({ where: { userId: req.user!.id } });
  if (!vendor) return res.status(404).json({ error: 'Vendor profile not created' });
  const rows = await prisma.vendorReturnPolicy.findMany({
    where: { vendorId: vendor.id },
    orderBy: { createdAt: 'asc' },
  });
  res.json(rows);
});

router.post('/me/return-policies', requireAuth, requireRole(Role.VENDOR), async (req, res) => {
  const parsed = returnPolicySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const vendor = await prisma.vendor.findUnique({ where: { userId: req.user!.id } });
  if (!vendor) return res.status(404).json({ error: 'Vendor profile not created' });
  const created = await prisma.vendorReturnPolicy.create({
    data: { vendorId: vendor.id, ...parsed.data },
  });
  res.status(201).json(created);
});

router.patch('/me/return-policies/:id', requireAuth, requireRole(Role.VENDOR), async (req, res) => {
  const parsed = returnPolicySchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const vendor = await prisma.vendor.findUnique({ where: { userId: req.user!.id } });
  if (!vendor) return res.status(404).json({ error: 'Vendor profile not created' });
  const existing = await prisma.vendorReturnPolicy.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.vendorId !== vendor.id) return res.status(404).json({ error: 'Policy not found' });
  const updated = await prisma.vendorReturnPolicy.update({
    where: { id: existing.id },
    data: parsed.data,
  });
  res.json(updated);
});

router.delete('/me/return-policies/:id', requireAuth, requireRole(Role.VENDOR), async (req, res) => {
  const vendor = await prisma.vendor.findUnique({ where: { userId: req.user!.id } });
  if (!vendor) return res.status(404).json({ error: 'Vendor profile not created' });
  const existing = await prisma.vendorReturnPolicy.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.vendorId !== vendor.id) return res.status(404).json({ error: 'Policy not found' });
  await prisma.vendorReturnPolicy.delete({ where: { id: existing.id } });
  res.status(204).end();
});

// ── THEME PRESETS ────────────────────────────────────────────────────────────

router.get('/me/theme/presets', requireAuth, requireRole(Role.VENDOR), (_req, res) => {
  res.json(listPresets());
});

router.post('/me/theme/preset', requireAuth, requireRole(Role.VENDOR), async (req, res, next) => {
  try {
    const key = String(req.body?.key ?? '');
    const force = req.body?.force === true;
    const preset = getPreset(key);
    if (!preset) return res.status(400).json({ error: 'Unknown preset key' });

    const themeParsed = themeSchema.safeParse(preset.theme);
    if (!themeParsed.success) {
      return res.status(500).json({ error: 'Preset theme failed validation', detail: themeParsed.error.flatten() });
    }

    const vendor = await prisma.vendor.findUnique({ where: { userId: req.user!.id } });
    if (!vendor) return res.status(404).json({ error: 'Vendor profile not created' });

    // Apply theme + presetKey on the vendor record, then upsert each system page's draft blocks.
    await prisma.$transaction(async (tx) => {
      await tx.vendor.update({
        where: { id: vendor.id },
        data: {
          themeColor: preset.themeColor,
          theme: themeParsed.data as any,
          themePresetKey: preset.meta.key,
        },
      });

      const kinds: SystemPageKind[] = ['HOMEPAGE', 'PDP', 'CART', 'CHECKOUT'];
      for (const kind of kinds) {
        const blocks = preset.pages[kind];
        const existing = await tx.vendorPage.findFirst({
          where: { vendorId: vendor.id, pageKind: kind as any },
        });
        if (existing) {
          // Only overwrite blocks if `force` — preserve vendor edits otherwise.
          if (force) {
            await tx.vendorPage.update({
              where: { id: existing.id },
              data: { draftBlocks: blocks as any },
            });
          }
        } else {
          await tx.vendorPage.create({
            data: {
              vendorId: vendor.id,
              slug: SYSTEM_PAGE_SLUGS[kind],
              pageKind: kind as any,
              title: SYSTEM_TITLES[kind],
              isHomepage: kind === 'HOMEPAGE',
              draftBlocks: blocks as any,
            },
          });
        }
      }
    });

    const fresh = await prisma.vendor.findUnique({ where: { id: vendor.id } });
    res.json(vendorPublicView(fresh));
  } catch (e) { next(e); }
});

export default router;
