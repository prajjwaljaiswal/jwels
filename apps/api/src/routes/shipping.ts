import { Router } from 'express';
import { z } from 'zod';
import { Role, CarrierMode, RateMode, ShippingServiceType, OrderStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';
import { encryptJson, decryptJson, maskSecret } from '../lib/crypto';
import { getCarrier, listCarriers } from '../lib/carriers';
import { quoteVendorGroups } from '../lib/shipping';
import { markItemShipped } from '../lib/fulfillmentSync';

const router = Router();

// ──────────────────────────────────────────────────────────
// Carrier registry (public)
// ──────────────────────────────────────────────────────────
router.get('/carriers', (_req, res) => {
  res.json(listCarriers());
});

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────
async function getVendor(userId: string) {
  return prisma.vendor.findUnique({ where: { userId } });
}

function splitFieldsByKind(carrierKey: string, body: Record<string, unknown>) {
  const adapter = getCarrier(carrierKey);
  if (!adapter) return { secret: {}, defaults: {} };
  const secret: Record<string, unknown> = {};
  const defaults: Record<string, unknown> = {};
  for (const f of adapter.credentialFields) {
    const v = body[f.key];
    if (v === undefined || v === null || v === '') continue;
    if (f.isDefault) defaults[f.key] = v;
    else secret[f.key] = v;
  }
  return { secret, defaults };
}

function maskAccount(account: {
  id: string;
  carrier: string;
  accountLabel: string;
  mode: CarrierMode;
  defaultsJson: any;
  isActive: boolean;
  lastVerifiedAt: Date | null;
  verifyStatus: string | null;
  credentials: string;
}) {
  // Decrypt only to show which keys are set + masked tail of secrets — never the raw value.
  let credSummary: Record<string, { hasValue: boolean; preview: string }> = {};
  try {
    const decrypted = decryptJson<Record<string, string>>(account.credentials);
    for (const [k, v] of Object.entries(decrypted)) {
      credSummary[k] = { hasValue: !!v, preview: maskSecret(v) };
    }
  } catch {
    credSummary = {};
  }
  return {
    id: account.id,
    carrier: account.carrier,
    accountLabel: account.accountLabel,
    mode: account.mode,
    isActive: account.isActive,
    lastVerifiedAt: account.lastVerifiedAt,
    verifyStatus: account.verifyStatus,
    defaults: account.defaultsJson ?? {},
    credentials: credSummary,
  };
}

// ──────────────────────────────────────────────────────────
// Vendor pickup address
// ──────────────────────────────────────────────────────────
const addressSchema = z.object({
  contactName: z.string().min(2),
  phone: z.string().min(7),
  line1: z.string().min(2),
  line2: z.string().optional().nullable(),
  city: z.string().min(2),
  state: z.string().min(2),
  postalCode: z.string().min(3),
  country: z.string().min(2).max(2).default('IN'),
});

router.get('/vendor/address', requireAuth, requireRole(Role.VENDOR), async (req, res, next) => {
  try {
    const vendor = await getVendor(req.user!.id);
    if (!vendor) return res.status(404).json({ error: 'Vendor profile not created' });
    const addr = await prisma.vendorAddress.findUnique({ where: { vendorId: vendor.id } });
    res.json(addr);
  } catch (e) { next(e); }
});

router.put('/vendor/address', requireAuth, requireRole(Role.VENDOR), async (req, res, next) => {
  try {
    const vendor = await getVendor(req.user!.id);
    if (!vendor) return res.status(404).json({ error: 'Vendor profile not created' });
    const parsed = addressSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const addr = await prisma.vendorAddress.upsert({
      where: { vendorId: vendor.id },
      create: { ...parsed.data, vendorId: vendor.id },
      update: parsed.data,
    });
    res.json(addr);
  } catch (e) { next(e); }
});

// ──────────────────────────────────────────────────────────
// Vendor carrier accounts
// ──────────────────────────────────────────────────────────
const createAccountSchema = z.object({
  carrier: z.string().min(2),
  accountLabel: z.string().min(1).max(80),
  mode: z.nativeEnum(CarrierMode).default(CarrierMode.TEST),
  // Free-form bag of fields; the adapter dictates which keys are valid (validated below).
  fields: z.record(z.union([z.string(), z.number(), z.boolean()])).default({}),
});

const updateAccountSchema = z.object({
  accountLabel: z.string().min(1).max(80).optional(),
  mode: z.nativeEnum(CarrierMode).optional(),
  isActive: z.boolean().optional(),
  // Only fields the vendor actually retyped — omitted keys keep prior values.
  fields: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
});

router.get('/vendor/accounts', requireAuth, requireRole(Role.VENDOR), async (req, res, next) => {
  try {
    const vendor = await getVendor(req.user!.id);
    if (!vendor) return res.status(404).json({ error: 'Vendor profile not created' });
    const rows = await prisma.vendorCarrierAccount.findMany({
      where: { vendorId: vendor.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(rows.map(maskAccount));
  } catch (e) { next(e); }
});

router.post('/vendor/accounts', requireAuth, requireRole(Role.VENDOR), async (req, res, next) => {
  try {
    const vendor = await getVendor(req.user!.id);
    if (!vendor) return res.status(404).json({ error: 'Vendor profile not created' });
    const parsed = createAccountSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const adapter = getCarrier(parsed.data.carrier);
    if (!adapter) return res.status(400).json({ error: `Unknown carrier: ${parsed.data.carrier}` });

    // Required fields check
    const missing = adapter.credentialFields
      .filter((f) => f.required && !(f.key in parsed.data.fields))
      .map((f) => f.key);
    if (missing.length) {
      return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
    }

    const { secret, defaults } = splitFieldsByKind(adapter.key, parsed.data.fields);
    const created = await prisma.vendorCarrierAccount.create({
      data: {
        vendorId: vendor.id,
        carrier: adapter.key,
        accountLabel: parsed.data.accountLabel,
        mode: parsed.data.mode,
        credentials: encryptJson(secret),
        defaultsJson: defaults as any,
      },
    });
    res.status(201).json(maskAccount(created));
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return res.status(409).json({ error: 'An account with this label already exists for this carrier' });
    }
    next(e);
  }
});

router.patch('/vendor/accounts/:id', requireAuth, requireRole(Role.VENDOR), async (req, res, next) => {
  try {
    const vendor = await getVendor(req.user!.id);
    if (!vendor) return res.status(404).json({ error: 'Vendor profile not created' });
    const existing = await prisma.vendorCarrierAccount.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.vendorId !== vendor.id) {
      return res.status(404).json({ error: 'Account not found' });
    }
    const parsed = updateAccountSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const data: any = {};
    if (parsed.data.accountLabel) data.accountLabel = parsed.data.accountLabel;
    if (parsed.data.mode) data.mode = parsed.data.mode;
    if (parsed.data.isActive !== undefined) data.isActive = parsed.data.isActive;

    if (parsed.data.fields && Object.keys(parsed.data.fields).length) {
      const { secret: newSecret, defaults: newDefaults } = splitFieldsByKind(existing.carrier, parsed.data.fields);

      // Merge secrets: keep prior values for fields not retyped.
      let prevSecret: Record<string, unknown> = {};
      try { prevSecret = decryptJson<Record<string, unknown>>(existing.credentials); } catch {}
      const mergedSecret = { ...prevSecret, ...newSecret };
      data.credentials = encryptJson(mergedSecret);

      const prevDefaults = (existing.defaultsJson as Record<string, unknown> | null) ?? {};
      data.defaultsJson = { ...prevDefaults, ...newDefaults };

      // Reset verify state since creds changed
      data.lastVerifiedAt = null;
      data.verifyStatus = null;
    }

    const updated = await prisma.vendorCarrierAccount.update({
      where: { id: existing.id },
      data,
    });
    res.json(maskAccount(updated));
  } catch (e) { next(e); }
});

router.delete('/vendor/accounts/:id', requireAuth, requireRole(Role.VENDOR), async (req, res, next) => {
  try {
    const vendor = await getVendor(req.user!.id);
    if (!vendor) return res.status(404).json({ error: 'Vendor profile not created' });
    const existing = await prisma.vendorCarrierAccount.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.vendorId !== vendor.id) {
      return res.status(404).json({ error: 'Account not found' });
    }
    await prisma.vendorCarrierAccount.delete({ where: { id: existing.id } });
    res.status(204).end();
  } catch (e) { next(e); }
});

router.post('/vendor/accounts/:id/verify', requireAuth, requireRole(Role.VENDOR), async (req, res, next) => {
  try {
    const vendor = await getVendor(req.user!.id);
    if (!vendor) return res.status(404).json({ error: 'Vendor profile not created' });
    const existing = await prisma.vendorCarrierAccount.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.vendorId !== vendor.id) {
      return res.status(404).json({ error: 'Account not found' });
    }
    const adapter = getCarrier(existing.carrier);
    if (!adapter) return res.status(400).json({ error: `Carrier ${existing.carrier} no longer supported` });

    let credentials: Record<string, unknown> = {};
    try { credentials = decryptJson<Record<string, unknown>>(existing.credentials); } catch {
      return res.status(500).json({ error: 'Failed to decrypt credentials' });
    }

    const result = await adapter.verify({
      mode: existing.mode,
      credentials,
      defaults: (existing.defaultsJson as Record<string, unknown> | null) ?? null,
    });

    const updated = await prisma.vendorCarrierAccount.update({
      where: { id: existing.id },
      data: {
        lastVerifiedAt: result.ok ? new Date() : null,
        verifyStatus: result.ok ? 'OK' : `FAILED: ${result.message ?? 'Unknown error'}`,
      },
    });
    res.json({ ok: result.ok, message: result.message, account: maskAccount(updated) });
  } catch (e) { next(e); }
});

// ──────────────────────────────────────────────────────────
// Vendor shipping methods (CRUD)
// ──────────────────────────────────────────────────────────
const methodSchema = z.object({
  name: z.string().min(1).max(80),
  carrier: z.string().min(2),
  serviceType: z.nativeEnum(ShippingServiceType).default(ShippingServiceType.STANDARD),
  rateMode: z.nativeEnum(RateMode).default(RateMode.FLAT),
  carrierAccountId: z.string().uuid().optional().nullable(),
  baseRate: z.number().nonnegative().default(0),
  perItemRate: z.number().nonnegative().optional().nullable(),
  freeAbove: z.number().nonnegative().optional().nullable(),
  etaMinDays: z.number().int().min(0).default(3),
  etaMaxDays: z.number().int().min(0).default(7),
  zones: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
});

router.get('/vendor/methods', requireAuth, requireRole(Role.VENDOR), async (req, res, next) => {
  try {
    const vendor = await getVendor(req.user!.id);
    if (!vendor) return res.status(404).json({ error: 'Vendor profile not created' });
    const rows = await prisma.shippingMethod.findMany({
      where: { vendorId: vendor.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(rows);
  } catch (e) { next(e); }
});

async function validateMethodConsistency(vendorId: string, data: z.infer<typeof methodSchema>) {
  if (data.rateMode === 'LIVE') {
    if (!data.carrierAccountId) {
      return 'LIVE methods must reference a verified carrier account';
    }
    const acct = await prisma.vendorCarrierAccount.findUnique({ where: { id: data.carrierAccountId } });
    if (!acct || acct.vendorId !== vendorId) return 'Carrier account not found';
    if (!acct.lastVerifiedAt) return 'Carrier account is not verified';
    if (acct.carrier !== data.carrier) return 'Carrier mismatch with selected account';
  }
  if (data.etaMaxDays < data.etaMinDays) return 'etaMaxDays must be ≥ etaMinDays';
  return null;
}

router.post('/vendor/methods', requireAuth, requireRole(Role.VENDOR), async (req, res, next) => {
  try {
    const vendor = await getVendor(req.user!.id);
    if (!vendor) return res.status(404).json({ error: 'Vendor profile not created' });
    const parsed = methodSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const err = await validateMethodConsistency(vendor.id, parsed.data);
    if (err) return res.status(400).json({ error: err });

    const created = await prisma.shippingMethod.create({
      data: {
        vendorId: vendor.id,
        name: parsed.data.name,
        carrier: parsed.data.carrier,
        serviceType: parsed.data.serviceType,
        rateMode: parsed.data.rateMode,
        carrierAccountId: parsed.data.carrierAccountId ?? null,
        baseRate: parsed.data.baseRate,
        perItemRate: parsed.data.perItemRate ?? null,
        freeAbove: parsed.data.freeAbove ?? null,
        etaMinDays: parsed.data.etaMinDays,
        etaMaxDays: parsed.data.etaMaxDays,
        zones: parsed.data.zones,
        isActive: parsed.data.isActive,
      },
    });
    res.status(201).json(created);
  } catch (e) { next(e); }
});

router.patch('/vendor/methods/:id', requireAuth, requireRole(Role.VENDOR), async (req, res, next) => {
  try {
    const vendor = await getVendor(req.user!.id);
    if (!vendor) return res.status(404).json({ error: 'Vendor profile not created' });
    const existing = await prisma.shippingMethod.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.vendorId !== vendor.id) {
      return res.status(404).json({ error: 'Method not found' });
    }
    const parsed = methodSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const merged = { ...existing, ...parsed.data } as any;
    // Coerce decimals for the consistency checker
    const checkData: z.infer<typeof methodSchema> = {
      name: merged.name,
      carrier: merged.carrier,
      serviceType: merged.serviceType,
      rateMode: merged.rateMode,
      carrierAccountId: merged.carrierAccountId,
      baseRate: Number(merged.baseRate),
      perItemRate: merged.perItemRate != null ? Number(merged.perItemRate) : null,
      freeAbove: merged.freeAbove != null ? Number(merged.freeAbove) : null,
      etaMinDays: merged.etaMinDays,
      etaMaxDays: merged.etaMaxDays,
      zones: merged.zones,
      isActive: merged.isActive,
    };
    const err = await validateMethodConsistency(vendor.id, checkData);
    if (err) return res.status(400).json({ error: err });

    const updated = await prisma.shippingMethod.update({
      where: { id: existing.id },
      data: parsed.data,
    });
    res.json(updated);
  } catch (e) { next(e); }
});

router.delete('/vendor/methods/:id', requireAuth, requireRole(Role.VENDOR), async (req, res, next) => {
  try {
    const vendor = await getVendor(req.user!.id);
    if (!vendor) return res.status(404).json({ error: 'Vendor profile not created' });
    const existing = await prisma.shippingMethod.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.vendorId !== vendor.id) {
      return res.status(404).json({ error: 'Method not found' });
    }
    await prisma.shippingMethod.delete({ where: { id: existing.id } });
    res.status(204).end();
  } catch (e) { next(e); }
});

// ──────────────────────────────────────────────────────────
// Public quote — used by the cart/checkout to show options + amounts
// ──────────────────────────────────────────────────────────
const quoteSchema = z.object({
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().positive(),
  })).min(1),
  destination: z.object({
    postalCode: z.string().min(3),
    state: z.string().min(2),
    country: z.string().min(2).max(2).default('IN'),
  }),
  paymentMode: z.enum(['PREPAID', 'COD']).default('PREPAID'),
});

router.post('/quote', async (req, res, next) => {
  try {
    const parsed = quoteSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    // Lock prices server-side (never trust the client)
    const products = await prisma.product.findMany({
      where: { id: { in: parsed.data.items.map((i) => i.productId) }, isActive: true },
      select: { id: true, vendorId: true, price: true },
    });
    if (products.length !== parsed.data.items.length) {
      return res.status(400).json({ error: 'One or more products are unavailable' });
    }

    // Group by vendor
    const byVendor = new Map<string, { vendorId: string; items: any[] }>();
    for (const cartItem of parsed.data.items) {
      const p = products.find((pp) => pp.id === cartItem.productId)!;
      const list = byVendor.get(p.vendorId) ?? { vendorId: p.vendorId, items: [] };
      list.items.push({
        productId: p.id,
        vendorId: p.vendorId,
        quantity: cartItem.quantity,
        unitPrice: Number(p.price),
      });
      byVendor.set(p.vendorId, list);
    }

    const groups = await quoteVendorGroups({
      groups: Array.from(byVendor.values()),
      destination: parsed.data.destination,
      paymentMode: parsed.data.paymentMode,
      fetchVendorMethods: (ids) =>
        prisma.shippingMethod.findMany({
          where: { vendorId: { in: ids }, isActive: true },
          include: { carrierAccount: true },
        }),
      fetchVendorAddresses: async (ids) => {
        const rows = await prisma.vendorAddress.findMany({
          where: { vendorId: { in: ids } },
          select: { vendorId: true, postalCode: true },
        });
        return new Map(rows.map((r) => [r.vendorId, { postalCode: r.postalCode }]));
      },
    });

    res.json({ groups });
  } catch (e) { next(e); }
});

// ──────────────────────────────────────────────────────────
// Fulfillment: create shipment + tracking
// ──────────────────────────────────────────────────────────

const shipBodySchema = z.object({
  // Manual override for FLAT methods or as a fallback when LIVE shipment creation is skipped
  trackingNumber: z.string().optional(),
  trackingUrl: z.string().url().optional(),
  // Set true to skip the carrier API call even if the method is LIVE (manual fulfillment)
  manual: z.boolean().optional(),
}).default({});

router.post(
  '/orders/items/:itemId/ship',
  requireAuth,
  requireRole(Role.VENDOR),
  async (req, res, next) => {
    try {
      const vendor = await getVendor(req.user!.id);
      if (!vendor) return res.status(404).json({ error: 'Vendor profile not created' });

      const item = await prisma.orderItem.findUnique({
        where: { id: req.params.itemId },
        include: {
          order: { select: { id: true, shippingAddress: true, paymentMethod: true } },
          product: { select: { name: true } },
        },
      });
      if (!item || item.vendorId !== vendor.id) {
        return res.status(404).json({ error: 'Order item not found' });
      }
      if (item.status === OrderStatus.SHIPPED || item.status === OrderStatus.DELIVERED) {
        return res.status(400).json({ error: 'Item is already shipped' });
      }

      const parsed = shipBodySchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

      let trackingNumber = parsed.data.trackingNumber ?? null;
      let trackingUrl    = parsed.data.trackingUrl    ?? null;
      let labelUrl: string | null = null;

      // Try carrier API only if the item has a LIVE method and the caller didn't opt out
      const method = item.shippingMethodId
        ? await prisma.shippingMethod.findUnique({
            where: { id: item.shippingMethodId },
            include: { carrierAccount: true },
          })
        : null;

      const goLive = method?.rateMode === 'LIVE' && method.carrierAccount && !parsed.data.manual;
      if (goLive && method?.carrierAccount) {
        const adapter = getCarrier(method.carrierAccount.carrier);
        if (adapter?.createShipment) {
          const pickup = await prisma.vendorAddress.findUnique({ where: { vendorId: vendor.id } });
          if (!pickup) return res.status(400).json({ error: 'Add a pickup address before creating shipments' });

          let credentials: Record<string, unknown> = {};
          try { credentials = decryptJson<Record<string, unknown>>(method.carrierAccount.credentials); } catch {
            return res.status(500).json({ error: 'Failed to decrypt carrier credentials' });
          }

          const addr = item.order.shippingAddress as any;
          try {
            const result = await adapter.createShipment(
              {
                mode: method.carrierAccount.mode,
                credentials,
                defaults: (method.carrierAccount.defaultsJson as Record<string, unknown> | null) ?? null,
              },
              {
                fromPostalCode: pickup.postalCode,
                toPostalCode: addr.pincode,
                toCountry: 'IN',
                weightGrams: 200 * item.quantity,
                declaredValue: Number(item.priceAtPurchase) * item.quantity,
                itemCount: item.quantity,
                paymentMode: item.order.paymentMethod === 'COD' ? 'COD' : 'PREPAID',
                serviceCode: item.shippingService ?? 'S',
                fromAddress: {
                  name: pickup.contactName,
                  phone: pickup.phone,
                  line1: pickup.line1,
                  line2: pickup.line2 ?? undefined,
                  city: pickup.city,
                  state: pickup.state,
                  postalCode: pickup.postalCode,
                  country: pickup.country,
                },
                toAddress: {
                  name: addr.name,
                  phone: addr.phone,
                  line1: addr.line1,
                  line2: addr.line2 ?? undefined,
                  city: addr.city,
                  state: addr.state,
                  postalCode: addr.pincode,
                  country: 'IN',
                },
                orderRef: `${item.order.id}-${item.id.slice(0, 8)}`,
              },
            );
            trackingNumber = result.awb;
            trackingUrl    = result.trackingUrl ?? null;
            labelUrl       = result.labelUrl ?? null;
          } catch (e: any) {
            return res.status(502).json({ error: e?.message || 'Carrier shipment creation failed' });
          }
        }
      }

      // Route through the shared transition: stamps dispatchedAt (so the
      // auto-deliver / payout pipeline can later close the item), records the
      // tracking fields, and fires the shipped notification. Previously this path
      // set status=SHIPPED but no dispatchedAt and created no Shipment, so such
      // items fell through every auto-deliver branch and never got paid out.
      await markItemShipped(item.id, {
        trackingNumber: trackingNumber ?? undefined,
        trackingUrl: trackingUrl ?? undefined,
        labelUrl: labelUrl ?? undefined,
      });
      const updated = await prisma.orderItem.findUnique({ where: { id: item.id } });
      res.json(updated);
    } catch (e) { next(e); }
  },
);

router.get('/orders/items/:itemId/track', requireAuth, async (req, res, next) => {
  try {
    const item = await prisma.orderItem.findUnique({
      where: { id: req.params.itemId },
      include: { order: { select: { customerId: true } } },
    });
    if (!item) return res.status(404).json({ error: 'Order item not found' });

    // Authorize: customer who owns the order, or the vendor who fulfills it
    const isCustomer = item.order.customerId === req.user!.id;
    let isVendor = false;
    if (!isCustomer && req.user!.role === Role.VENDOR) {
      const vendor = await prisma.vendor.findUnique({ where: { userId: req.user!.id } });
      isVendor = !!vendor && vendor.id === item.vendorId;
    }
    if (!isCustomer && !isVendor) return res.status(403).json({ error: 'Forbidden' });

    if (!item.trackingNumber) {
      return res.json({ awb: null, trackingUrl: null, events: [] });
    }

    let events: any[] = [];
    if (item.shippingMethodId) {
      const method = await prisma.shippingMethod.findUnique({
        where: { id: item.shippingMethodId },
        include: { carrierAccount: true },
      });
      if (method?.carrierAccount) {
        const adapter = getCarrier(method.carrierAccount.carrier);
        if (adapter?.track) {
          try {
            let credentials: Record<string, unknown> = {};
            try { credentials = decryptJson<Record<string, unknown>>(method.carrierAccount.credentials); } catch {}
            events = await adapter.track(
              {
                mode: method.carrierAccount.mode,
                credentials,
                defaults: (method.carrierAccount.defaultsJson as Record<string, unknown> | null) ?? null,
              },
              item.trackingNumber,
            );
          } catch {
            events = [];
          }
        }
      }
    }

    res.json({
      awb: item.trackingNumber,
      carrier: item.shippingCarrier,
      trackingUrl: item.trackingUrl,
      labelUrl: item.labelUrl,
      events,
    });
  } catch (e) { next(e); }
});

export default router;
