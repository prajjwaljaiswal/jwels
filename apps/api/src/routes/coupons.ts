import { Router } from 'express';
import { z } from 'zod';
import { CouponDiscountType, CouponScope, Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';
import { normalizeCode, resolveCoupon } from '../lib/coupon';

const router = Router();

const baseCouponSchema = z.object({
  code: z.string().min(2).max(40).regex(/^[A-Za-z0-9_-]+$/, 'Use letters, numbers, _ or - only'),
  scope: z.nativeEnum(CouponScope),
  discountType: z.nativeEnum(CouponDiscountType),
  value: z.number().positive(),
  minOrderAmount: z.number().nonnegative().nullable().optional(),
  maxDiscount: z.number().positive().nullable().optional(),
  productIds: z.array(z.string().uuid()).optional(),
  usageLimit: z.number().int().positive().nullable().optional(),
  perUserLimit: z.number().int().positive().nullable().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  isActive: z.boolean().optional(),
});

const updateCouponSchema = baseCouponSchema.partial();

async function getVendorOrThrow(userId: string) {
  const vendor = await prisma.vendor.findUnique({ where: { userId } });
  if (!vendor) throw new Error('Vendor profile not created');
  return vendor;
}

router.post('/vendor', requireAuth, requireRole(Role.VENDOR), async (req, res) => {
  const parsed = baseCouponSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const data = parsed.data;

  let vendor;
  try { vendor = await getVendorOrThrow(req.user!.id); }
  catch (e: any) { return res.status(400).json({ error: e.message }); }

  const code = normalizeCode(data.code);
  const existing = await prisma.coupon.findUnique({ where: { code } });
  if (existing) return res.status(409).json({ error: 'Coupon code already in use' });

  if (data.discountType === 'PERCENT' && data.value > 100) {
    return res.status(400).json({ error: 'Percent discount cannot exceed 100' });
  }

  let productIds: string[] = [];
  if (data.scope === 'PRODUCT') {
    productIds = data.productIds ?? [];
    if (productIds.length === 0) {
      return res.status(400).json({ error: 'Select at least one product for a product-scoped coupon' });
    }
    const owned = await prisma.product.findMany({
      where: { id: { in: productIds }, vendorId: vendor.id },
      select: { id: true },
    });
    if (owned.length !== productIds.length) {
      return res.status(400).json({ error: 'One or more products do not belong to your shop' });
    }
  }

  const coupon = await prisma.coupon.create({
    data: {
      code,
      scope: data.scope,
      discountType: data.discountType,
      value: data.value,
      minOrderAmount: data.minOrderAmount ?? null,
      maxDiscount: data.maxDiscount ?? null,
      usageLimit: data.usageLimit ?? null,
      perUserLimit: data.perUserLimit ?? null,
      startsAt: data.startsAt ? new Date(data.startsAt) : null,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      isActive: data.isActive ?? true,
      vendorId: vendor.id,
      products: productIds.length ? { connect: productIds.map((id) => ({ id })) } : undefined,
    },
    include: { products: { select: { id: true, name: true } } },
  });

  res.status(201).json(coupon);
});

router.get('/vendor', requireAuth, requireRole(Role.VENDOR), async (req, res) => {
  let vendor;
  try { vendor = await getVendorOrThrow(req.user!.id); }
  catch (e: any) { return res.status(400).json({ error: e.message }); }

  const coupons = await prisma.coupon.findMany({
    where: { vendorId: vendor.id },
    include: { products: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(coupons);
});

router.get('/vendor/:id', requireAuth, requireRole(Role.VENDOR), async (req, res) => {
  let vendor;
  try { vendor = await getVendorOrThrow(req.user!.id); }
  catch (e: any) { return res.status(400).json({ error: e.message }); }

  const coupon = await prisma.coupon.findUnique({
    where: { id: req.params.id },
    include: { products: { select: { id: true, name: true } } },
  });
  if (!coupon || coupon.vendorId !== vendor.id) {
    return res.status(404).json({ error: 'Coupon not found' });
  }
  res.json(coupon);
});

router.patch('/vendor/:id', requireAuth, requireRole(Role.VENDOR), async (req, res) => {
  const parsed = updateCouponSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const data = parsed.data;

  let vendor;
  try { vendor = await getVendorOrThrow(req.user!.id); }
  catch (e: any) { return res.status(400).json({ error: e.message }); }

  const existing = await prisma.coupon.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.vendorId !== vendor.id) {
    return res.status(404).json({ error: 'Coupon not found' });
  }

  if (data.code) {
    const newCode = normalizeCode(data.code);
    if (newCode !== existing.code) {
      const clash = await prisma.coupon.findUnique({ where: { code: newCode } });
      if (clash) return res.status(409).json({ error: 'Coupon code already in use' });
    }
  }

  const finalDiscountType = data.discountType ?? existing.discountType;
  const finalValue = data.value ?? Number(existing.value);
  if (finalDiscountType === 'PERCENT' && finalValue > 100) {
    return res.status(400).json({ error: 'Percent discount cannot exceed 100' });
  }

  const finalScope = data.scope ?? existing.scope;
  let productsUpdate: { set: { id: string }[] } | undefined;
  if (data.productIds !== undefined || data.scope !== undefined) {
    if (finalScope === 'PRODUCT') {
      const ids = data.productIds ?? [];
      if (ids.length === 0) {
        return res.status(400).json({ error: 'Select at least one product for a product-scoped coupon' });
      }
      const owned = await prisma.product.findMany({
        where: { id: { in: ids }, vendorId: vendor.id },
        select: { id: true },
      });
      if (owned.length !== ids.length) {
        return res.status(400).json({ error: 'One or more products do not belong to your shop' });
      }
      productsUpdate = { set: ids.map((id) => ({ id })) };
    } else {
      // Clear product list when scope flips to VENDOR
      productsUpdate = { set: [] };
    }
  }

  const updated = await prisma.coupon.update({
    where: { id: existing.id },
    data: {
      code: data.code ? normalizeCode(data.code) : undefined,
      scope: data.scope,
      discountType: data.discountType,
      value: data.value,
      minOrderAmount: data.minOrderAmount === undefined ? undefined : data.minOrderAmount,
      maxDiscount: data.maxDiscount === undefined ? undefined : data.maxDiscount,
      usageLimit: data.usageLimit === undefined ? undefined : data.usageLimit,
      perUserLimit: data.perUserLimit === undefined ? undefined : data.perUserLimit,
      startsAt: data.startsAt === undefined ? undefined : data.startsAt ? new Date(data.startsAt) : null,
      expiresAt: data.expiresAt === undefined ? undefined : data.expiresAt ? new Date(data.expiresAt) : null,
      isActive: data.isActive,
      products: productsUpdate,
    },
    include: { products: { select: { id: true, name: true } } },
  });

  res.json(updated);
});

router.delete('/vendor/:id', requireAuth, requireRole(Role.VENDOR), async (req, res) => {
  let vendor;
  try { vendor = await getVendorOrThrow(req.user!.id); }
  catch (e: any) { return res.status(400).json({ error: e.message }); }

  const coupon = await prisma.coupon.findUnique({ where: { id: req.params.id } });
  if (!coupon || coupon.vendorId !== vendor.id) {
    return res.status(404).json({ error: 'Coupon not found' });
  }

  if (coupon.usedCount > 0) {
    // Soft-disable so historical orders keep their snapshot meaningful.
    const updated = await prisma.coupon.update({
      where: { id: coupon.id },
      data: { isActive: false },
    });
    return res.json({ softDeleted: true, coupon: updated });
  }

  await prisma.coupon.delete({ where: { id: coupon.id } });
  res.json({ deleted: true });
});

// Customer preview — re-fetches products and runs the same resolver the
// checkout endpoints use. Persists nothing.
const previewSchema = z.object({
  code: z.string().min(1),
  vendorId: z.string().uuid(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().positive(),
    variationComboId: z.string().uuid().optional(),
  })).min(1),
});

router.post('/preview', requireAuth, async (req, res) => {
  const parsed = previewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { code, vendorId, items } = parsed.data;

  const products = await prisma.product.findMany({
    where: { id: { in: items.map((i) => i.productId) }, isActive: true },
    select: { id: true, vendorId: true, price: true },
  });
  if (products.length !== items.length) {
    return res.status(400).json({ error: 'One or more products are unavailable' });
  }

  // All items must belong to the same vendor (matches checkout constraint)
  const vendorIds = new Set(products.map((p) => p.vendorId));
  if (vendorIds.size > 1 || !vendorIds.has(vendorId)) {
    return res.status(400).json({ error: 'Cart contains items from a different shop' });
  }

  // For combo pricing, look up combos
  const comboIds = items.map((i) => i.variationComboId).filter(Boolean) as string[];
  const combos = comboIds.length
    ? await prisma.productVariationCombo.findMany({
        where: { id: { in: comboIds } },
        select: { id: true, productId: true, price: true },
      })
    : [];

  const cartItems = items.map((i) => {
    const p = products.find((pp) => pp.id === i.productId)!;
    const combo = i.variationComboId ? combos.find((c) => c.id === i.variationComboId) : null;
    const unitPrice = combo?.price != null ? Number(combo.price) : Number(p.price);
    return { productId: p.id, quantity: i.quantity, unitPrice };
  });
  const subtotal = cartItems.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

  try {
    const resolved = await resolveCoupon({
      code, vendorId, cartItems, subtotal, userId: req.user!.id,
    });
    res.json({ ...resolved, subtotal });
  } catch (e: any) {
    res.status(400).json({ error: e?.message || 'Coupon could not be applied' });
  }
});

// Public storefront listing — safe fields only, currently-redeemable coupons.
router.get('/public/vendor/:vendorId', async (req, res) => {
  const { resolveVendorId } = await import('../lib/vendor-slug');
  const vendorId = await resolveVendorId(req.params.vendorId);
  if (!vendorId) return res.json([]);
  const now = new Date();
  const coupons = await prisma.coupon.findMany({
    where: {
      vendorId,
      isActive: true,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] },
      ],
    },
    select: {
      id: true,
      code: true,
      scope: true,
      discountType: true,
      value: true,
      minOrderAmount: true,
      maxDiscount: true,
      expiresAt: true,
      usageLimit: true,
      usedCount: true,
      products: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Drop coupons that have hit their total usage cap.
  const available = coupons.filter(
    (c) => c.usageLimit == null || c.usedCount < c.usageLimit,
  );

  res.json(available.map(({ usageLimit, usedCount, ...rest }) => rest));
});

export default router;
