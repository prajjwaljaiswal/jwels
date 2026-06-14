import { Router } from 'express';
import { z } from 'zod';
import { Permission, Role, VendorStatus, OrderStatus, KycStatus, CategoryApprovalStatus, ProductStatus } from '@prisma/client';
import { decryptString, maskSecret } from '../lib/crypto';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole, requirePermission, requireAnyPermission } from '../middleware/auth';
import { audit } from '../lib/audit';
import { uniqueVendorSlug } from '../lib/vendor-slug';
import { indexProduct, removeProductFromIndex } from '../lib/algolia';
import { runSettlement, markPayoutPaid } from '../lib/payouts';

const router = Router();
// All admin routes require an authenticated ADMIN user; per-route permission
// checks below provide fine-grained authorization.
router.use(requireAuth, requireRole(Role.ADMIN));

router.get('/vendors', requirePermission(Permission.VENDOR_VIEW), async (req, res) => {
  const { status } = req.query as Record<string, string>;
  const vendors = await prisma.vendor.findMany({
    where: status ? { status: status as VendorStatus } : undefined,
    include: { user: { select: { name: true, email: true, phone: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(vendors);
});

const vendorStatusSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED', 'SUSPENDED', 'PENDING']),
});

// SUSPEND requires VENDOR_SUSPEND; other transitions require VENDOR_APPROVE.
router.patch(
  '/vendors/:id/status',
  requireAnyPermission(Permission.VENDOR_APPROVE, Permission.VENDOR_SUSPEND),
  async (req, res) => {
    const parsed = vendorStatusSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const perms = req.user!.permissions ?? [];
    const isSuspend = parsed.data.status === 'SUSPENDED';
    const needed = isSuspend ? Permission.VENDOR_SUSPEND : Permission.VENDOR_APPROVE;
    if (!perms.includes(needed)) {
      return res.status(403).json({ error: 'Forbidden', missingPermissions: [needed] });
    }

    const existingVendor = await prisma.vendor.findUnique({ where: { id: req.params.id } });
    if (!existingVendor) return res.status(404).json({ error: 'Vendor not found' });

    const data: any = { status: parsed.data.status as VendorStatus };
    // Auto-assign a slug on first approval so the storefront has a clean URL.
    if (parsed.data.status === 'APPROVED' && !existingVendor.slug) {
      data.slug = await uniqueVendorSlug(existingVendor.shopName);
    }
    const vendor = await prisma.vendor.update({ where: { id: req.params.id }, data });
    await audit(req.user!.id, `vendor.status.${parsed.data.status.toLowerCase()}`, vendor.id, {
      shopName: vendor.shopName,
      status: parsed.data.status,
    });
    res.json(vendor);
  },
);

// ── KYC REVIEW ───────────────────────────────────────────────────────────────

router.get('/vendors/kyc-queue', requirePermission(Permission.VENDOR_APPROVE), async (req, res) => {
  const status = (req.query.status as KycStatus | undefined) ?? KycStatus.UNDER_REVIEW;
  const vendors = await prisma.vendor.findMany({
    where: { kycStatus: status },
    include: {
      user: { select: { name: true, email: true, phone: true } },
      pickupAddress: true,
    },
    orderBy: { updatedAt: 'desc' },
  });
  const safe = vendors.map((v) => ({
    ...v,
    panNumber:         v.panNumber ? maskSecret(decryptString(v.panNumber) || '') : null,
    bankAccountNumber: v.bankAccountNumber ? maskSecret(decryptString(v.bankAccountNumber) || '') : null,
  }));
  res.json(safe);
});

const kycDecisionSchema = z.object({
  decision: z.enum(['VERIFIED', 'REJECTED']),
  note:     z.string().max(500).optional(),
});

router.patch('/vendors/:id/kyc', requirePermission(Permission.VENDOR_APPROVE), async (req, res) => {
  const parsed = kycDecisionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = await prisma.vendor.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Vendor not found' });

  const data: any = {
    kycStatus: parsed.data.decision as KycStatus,
    kycRejectionNote: parsed.data.decision === 'REJECTED' ? (parsed.data.note ?? null) : null,
    kycReviewedAt: new Date(),
    kycReviewedBy: req.user!.id,
  };
  // On verify, also promote the shop to APPROVED if it was still PENDING.
  if (parsed.data.decision === 'VERIFIED' && existing.status === VendorStatus.PENDING) {
    data.status = VendorStatus.APPROVED;
    if (!existing.slug) data.slug = await uniqueVendorSlug(existing.shopName);
  }
  const vendor = await prisma.vendor.update({ where: { id: existing.id }, data });
  await audit(req.user!.id, `vendor.kyc.${parsed.data.decision.toLowerCase()}`, vendor.id, {
    shopName: vendor.shopName,
    note: parsed.data.note,
  });
  res.json(vendor);
});

// ── CATEGORY PROPOSAL REVIEW ─────────────────────────────────────────────────

// GET /admin/categories/proposed?status=PROPOSED — vendor-suggested categories queue
router.get('/categories/proposed', requirePermission(Permission.CATEGORY_MANAGE), async (req, res) => {
  const status = (req.query.status as CategoryApprovalStatus | undefined) ?? CategoryApprovalStatus.PROPOSED;
  const rows = await prisma.category.findMany({
    where: { approvalStatus: status, proposedByVendorId: { not: null } },
    orderBy: { createdAt: 'desc' },
    include: {
      parent: { select: { id: true, name: true, slug: true } },
    },
  });
  // Resolve vendor display info in one extra query (avoid N+1).
  const vendorIds = Array.from(new Set(rows.map((r) => r.proposedByVendorId).filter(Boolean) as string[]));
  const vendors = await prisma.vendor.findMany({
    where: { id: { in: vendorIds } },
    select: { id: true, shopName: true, user: { select: { name: true, email: true } } },
  });
  const vMap = new Map(vendors.map((v) => [v.id, v]));
  res.json(rows.map((r) => ({ ...r, proposer: r.proposedByVendorId ? vMap.get(r.proposedByVendorId) ?? null : null })));
});

const categoryApprovalSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  note:     z.string().max(500).optional(),
});

router.patch('/categories/:id/approval', requirePermission(Permission.CATEGORY_MANAGE), async (req, res) => {
  const parsed = categoryApprovalSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = await prisma.category.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Category not found' });
  if (!existing.proposedByVendorId) {
    return res.status(400).json({ error: 'This category was not proposed by a vendor' });
  }

  const updated = await prisma.category.update({
    where: { id: existing.id },
    data: {
      approvalStatus:  parsed.data.decision as CategoryApprovalStatus,
      isActive:        parsed.data.decision === 'APPROVED',
      rejectionNote:   parsed.data.decision === 'REJECTED' ? (parsed.data.note ?? null) : null,
      reviewedAt:      new Date(),
      reviewedBy:      req.user!.id,
    },
  });
  await audit(req.user!.id, `category.${parsed.data.decision.toLowerCase()}`, updated.id, {
    name: updated.name,
    slug: updated.slug,
    note: parsed.data.note,
  });
  res.json(updated);
});

// Settings management
router.get('/settings', requirePermission(Permission.SETTINGS_MANAGE), async (_req, res, next) => {
  try {
    const settings = await prisma.setting.findMany();
    const map: Record<string, string> = {};
    for (const s of settings) map[s.key] = s.value;
    res.json(map);
  } catch (e) { next(e); }
});

router.patch('/settings/cod', requirePermission(Permission.SETTINGS_MANAGE), async (req, res, next) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') return res.status(400).json({ error: 'enabled must be a boolean' });
    const setting = await prisma.setting.upsert({
      where: { key: 'cod_enabled' },
      update: { value: String(enabled) },
      create: { key: 'cod_enabled', value: String(enabled) },
    });
    await audit(req.user!.id, 'settings.cod.update', 'cod_enabled', { enabled });
    res.json({ enabled: setting.value === 'true' });
  } catch (e) { next(e); }
});

// Generic allowlisted settings setter (invoice identity, return window, …)
const ALLOWED_SETTINGS = new Set([
  'platform_legal_name', 'platform_gstin', 'platform_address', 'return_window_days',
]);
router.patch('/settings', requirePermission(Permission.SETTINGS_MANAGE), async (req, res, next) => {
  try {
    const updates = req.body?.updates;
    if (!updates || typeof updates !== 'object') return res.status(400).json({ error: 'updates object required' });
    const entries = Object.entries(updates).filter(([k]) => ALLOWED_SETTINGS.has(k));
    if (entries.length === 0) return res.status(400).json({ error: 'No allowed settings provided' });
    await prisma.$transaction(entries.map(([key, value]) =>
      prisma.setting.upsert({ where: { key }, update: { value: String(value) }, create: { key, value: String(value) } })
    ));
    await audit(req.user!.id, 'settings.update', null, { keys: entries.map(([k]) => k) });
    const settings = await prisma.setting.findMany();
    const map: Record<string, string> = {};
    for (const s of settings) map[s.key] = s.value;
    res.json(map);
  } catch (e) { next(e); }
});

/**
 * Payout summary per vendor: total owed (sum of delivered items minus platform commission).
 */
router.get('/payouts', requirePermission(Permission.PAYOUT_VIEW), async (req, res) => {
  const commissionRate = Number(process.env.PLATFORM_COMMISSION_PERCENT || 10) / 100;

  const items = await prisma.orderItem.findMany({
    where: { status: OrderStatus.DELIVERED },
    include: {
      vendor: { include: { user: { select: { name: true, email: true } } } },
    },
  });

  const byVendor = new Map<string, { vendorId: string; shopName: string; email: string; itemCount: number; gross: number; commission: number; payable: number }>();
  for (const it of items) {
    const itemGross = Number(it.priceAtPurchase) * it.quantity;
    const cur = byVendor.get(it.vendorId) ?? {
      vendorId: it.vendorId,
      shopName: it.vendor.shopName,
      email: it.vendor.user.email,
      itemCount: 0,
      gross: 0,
      commission: 0,
      payable: 0,
    };
    cur.itemCount += it.quantity;
    cur.gross += itemGross;
    cur.commission += itemGross * commissionRate;
    cur.payable += itemGross * (1 - commissionRate);
    byVendor.set(it.vendorId, cur);
  }

  res.json({
    commissionRate,
    vendors: Array.from(byVendor.values()).sort((a, b) => b.payable - a.payable),
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Payout execution (M1.2) — settlement runs, history, mark-paid
// ─────────────────────────────────────────────────────────────────────────────

// List settlement payout records (the real ledger, distinct from the live
// "owed" summary above).
router.get('/payouts/runs', requirePermission(Permission.PAYOUT_VIEW), async (req, res, next) => {
  try {
    const status = (req.query.status as string | undefined) as any;
    const rows = await prisma.payout.findMany({
      where: { ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
      include: { vendor: { select: { shopName: true, user: { select: { email: true } } } }, _count: { select: { items: true } } },
    });
    res.json(rows);
  } catch (e) { next(e); }
});

// Trigger a settlement run now (sweeps all unsettled delivered items).
router.post('/payouts/settle', requirePermission(Permission.PAYOUT_PROCESS), async (req, res, next) => {
  try {
    const created = await runSettlement();
    await audit(req.user!.id, 'PAYOUT_SETTLE', null, { created: created.length });
    res.json({ created: created.length, payouts: created });
  } catch (e) { next(e); }
});

const payPayoutSchema = z.object({ utr: z.string().max(64).optional(), provider: z.string().max(32).optional(), notes: z.string().max(500).optional() });

// Mark a payout as paid (records the bank UTR for manual settlement).
router.post('/payouts/:id/pay', requirePermission(Permission.PAYOUT_PROCESS), async (req, res, next) => {
  try {
    const parsed = payPayoutSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const updated = await markPayoutPaid(req.params.id, { processedBy: req.user!.id, ...parsed.data });
    await audit(req.user!.id, 'PAYOUT_PAID', req.params.id, { utr: parsed.data.utr });
    res.json(updated);
  } catch (e: any) {
    if (/not configured|not implemented/i.test(e?.message || '')) return res.status(400).json({ error: e.message });
    next(e);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Product moderation (A1.4 + M1.5)
// ─────────────────────────────────────────────────────────────────────────────

router.get('/products', requirePermission(Permission.PRODUCT_VIEW), async (req, res, next) => {
  try {
    const status = (req.query.status as string | undefined) as ProductStatus | undefined;
    const search = (req.query.search as string | undefined)?.trim();
    const page = Math.max(parseInt((req.query.page as string) || '1', 10), 1);
    const take = Math.min(parseInt((req.query.limit as string) || '20', 10) || 20, 100);
    const where: any = {
      ...(status ? { status } : { status: ProductStatus.PENDING_REVIEW }),
      ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * take,
        take,
        select: {
          id: true, name: true, price: true, images: true, status: true, isActive: true, createdAt: true,
          category: { select: { name: true } },
          vendor: { select: { id: true, shopName: true } },
        },
      }),
      prisma.product.count({ where }),
    ]);
    res.json({ items, total, page, limit: take });
  } catch (e) { next(e); }
});

const moderateSchema = z.object({ action: z.enum(['approve', 'reject']), note: z.string().max(500).optional() });

router.patch('/products/:id/moderate', requirePermission(Permission.PRODUCT_MODERATE), async (req, res, next) => {
  try {
    const parsed = moderateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const product = await prisma.product.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const approve = parsed.data.action === 'approve';
    const updated = await prisma.product.update({
      where: { id: product.id },
      data: approve
        ? { status: ProductStatus.ACTIVE, isActive: true }
        : { status: ProductStatus.REJECTED, isActive: false },
    });
    // Sync the search index to match the new visibility.
    try { approve ? await indexProduct(product.id) : await removeProductFromIndex(product.id); }
    catch (e: any) { console.warn('[algolia] moderation sync failed:', e?.message); }

    await audit(req.user!.id, approve ? 'PRODUCT_APPROVE' : 'PRODUCT_REJECT', product.id, { note: parsed.data.note });
    res.json(updated);
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────────────────
// Order oversight (A1.3) — closes the unused ORDER_VIEW permission
// ─────────────────────────────────────────────────────────────────────────────

router.get('/orders', requirePermission(Permission.ORDER_VIEW), async (req, res, next) => {
  try {
    const status = (req.query.status as string | undefined) as OrderStatus | undefined;
    const search = (req.query.search as string | undefined)?.trim();
    const page = Math.max(parseInt((req.query.page as string) || '1', 10), 1);
    const take = Math.min(parseInt((req.query.limit as string) || '20', 10) || 20, 100);
    const where: any = {
      ...(status ? { status } : {}),
      ...(search ? { OR: [{ id: { contains: search } }, { customer: { email: { contains: search, mode: 'insensitive' } } }] } : {}),
    };
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * take,
        take,
        include: {
          customer: { select: { name: true, email: true } },
          items: { select: { id: true, quantity: true, priceAtPurchase: true, status: true, vendor: { select: { shopName: true } } } },
        },
      }),
      prisma.order.count({ where }),
    ]);
    res.json({ orders, total, page, limit: take });
  } catch (e) { next(e); }
});

router.get('/orders/:id', requirePermission(Permission.ORDER_VIEW), async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        customer: { select: { name: true, email: true, phone: true } },
        items: { include: { product: { select: { name: true, images: true } }, vendor: { select: { shopName: true } }, shipment: true, returns: true } },
        invoice: true,
        returns: true,
        disputes: true,
      },
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────────────────
// Analytics (A2.1) — replaces the hardcoded GMV "—" on the dashboard
// ─────────────────────────────────────────────────────────────────────────────

router.get('/analytics', requirePermission(Permission.ANALYTICS_VIEW), async (req, res, next) => {
  try {
    const commissionRate = Number(process.env.PLATFORM_COMMISSION_PERCENT || 10) / 100;
    const days = Math.min(Math.max(parseInt((req.query.days as string) || '30', 10) || 30, 1), 365);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const PAID_STATES: OrderStatus[] = [OrderStatus.PAID, OrderStatus.SHIPPED, OrderStatus.DELIVERED];

    const [paidOrders, refundedCount, newVendors, newCustomers, totalOrders] = await Promise.all([
      prisma.order.findMany({
        where: { status: { in: PAID_STATES }, createdAt: { gte: since } },
        select: { id: true, totalAmount: true, createdAt: true },
      }),
      prisma.order.count({ where: { status: OrderStatus.REFUNDED, createdAt: { gte: since } } }),
      prisma.vendor.count({ where: { createdAt: { gte: since } } }),
      prisma.user.count({ where: { role: Role.CUSTOMER, createdAt: { gte: since } } }),
      prisma.order.count({ where: { createdAt: { gte: since } } }),
    ]);

    const gmv = paidOrders.reduce((s, o) => s + Number(o.totalAmount), 0);
    const orderCount = paidOrders.length;
    const aov = orderCount > 0 ? gmv / orderCount : 0;
    const commissionEarned = gmv * commissionRate;
    const conversion = totalOrders > 0 ? orderCount / totalOrders : 0;
    const refundRate = orderCount + refundedCount > 0 ? refundedCount / (orderCount + refundedCount) : 0;

    // Daily GMV time-series.
    const seriesMap = new Map<string, { gmv: number; orders: number }>();
    for (const o of paidOrders) {
      const d = new Date(o.createdAt).toISOString().slice(0, 10);
      const cur = seriesMap.get(d) ?? { gmv: 0, orders: 0 };
      cur.gmv += Number(o.totalAmount); cur.orders += 1;
      seriesMap.set(d, cur);
    }
    const series = Array.from(seriesMap.entries()).map(([date, v]) => ({ date, ...v })).sort((a, b) => a.date.localeCompare(b.date));

    // Top vendors by delivered revenue.
    const deliveredItems = await prisma.orderItem.findMany({
      where: { status: OrderStatus.DELIVERED, order: { createdAt: { gte: since } } },
      select: { priceAtPurchase: true, quantity: true, productId: true, vendor: { select: { id: true, shopName: true } }, product: { select: { name: true } } },
    });
    const vendorAgg = new Map<string, { vendorId: string; shopName: string; revenue: number }>();
    const productAgg = new Map<string, { productId: string; name: string; revenue: number; units: number }>();
    for (const it of deliveredItems) {
      const rev = Number(it.priceAtPurchase) * it.quantity;
      const v = vendorAgg.get(it.vendor.id) ?? { vendorId: it.vendor.id, shopName: it.vendor.shopName, revenue: 0 };
      v.revenue += rev; vendorAgg.set(it.vendor.id, v);
      const p = productAgg.get(it.productId) ?? { productId: it.productId, name: it.product?.name ?? 'Item', revenue: 0, units: 0 };
      p.revenue += rev; p.units += it.quantity; productAgg.set(it.productId, p);
    }
    const topVendors = Array.from(vendorAgg.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
    const topProducts = Array.from(productAgg.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    res.json({
      rangeDays: days,
      gmv, orderCount, aov, commissionEarned, conversion, refundRate,
      newVendors, newCustomers, totalOrders,
      series, topVendors, topProducts,
    });
  } catch (e) { next(e); }
});

export default router;
