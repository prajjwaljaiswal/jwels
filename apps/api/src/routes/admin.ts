import { Router } from 'express';
import { z } from 'zod';
import { Permission, Role, VendorStatus, OrderStatus, KycStatus, CategoryApprovalStatus } from '@prisma/client';
import { decryptString, maskSecret } from '../lib/crypto';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole, requirePermission, requireAnyPermission } from '../middleware/auth';
import { audit } from '../lib/audit';
import { uniqueVendorSlug } from '../lib/vendor-slug';

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

export default router;
