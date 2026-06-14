import { Router } from 'express';
import { z } from 'zod';
import Razorpay from 'razorpay';
import { Role, Permission, PaymentProvider, PaymentMethodMode } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole, requirePermission } from '../middleware/auth';
import { encryptJson, decryptJson } from '../lib/crypto';
import { audit } from '../lib/audit';
import { verifyWebhookSignature } from '../lib/razorpay';
import { confirmOrderPaid } from '../lib/orderConfirm';

const router = Router();

// ─── Provider-specific credential and public-config shapes ──────────────────

const razorpayCredsSchema = z.object({
  keyId: z.string().min(8),
  keySecret: z.string().min(8),
  webhookSecret: z.string().optional(),
});
type RazorpayCreds = z.infer<typeof razorpayCredsSchema>;

/**
 * Razorpay webhook — the SOURCE OF TRUTH for payment confirmation. The client
 * verify endpoint is only a fast-path hint; this guarantees an order reaches
 * PAID even if the client never returns (closed tab, dropped network). Public
 * route: authenticity comes from the HMAC signature, not a session.
 *
 * The signature is verified against the per-vendor webhook secret when the order
 * used a vendor Razorpay account, otherwise the platform RAZORPAY_WEBHOOK_SECRET.
 */
router.post('/webhook', async (req, res, next) => {
  try {
    const signature = req.header('x-razorpay-signature') || '';
    const rawBody = (req as any).rawBody as Buffer | undefined;
    if (!rawBody) return res.status(400).json({ error: 'Missing body' });

    const event = req.body ?? {};
    // Extract the Razorpay order id from the (still-untrusted) payload.
    const rzpOrderId: string | undefined =
      event?.payload?.payment?.entity?.order_id || event?.payload?.order?.entity?.id;
    if (!rzpOrderId) return res.status(200).json({ ok: true, ignored: true });

    const order = await prisma.order.findUnique({
      where: { razorpayOrderId: rzpOrderId },
      include: { paymentMethodRef: true },
    });

    // Resolve the verifying secret: vendor account secret if applicable, else platform.
    let secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (order?.paymentMethodRef?.credentials) {
      try {
        const creds = decryptJson<RazorpayCreds>(order.paymentMethodRef.credentials);
        if (creds.webhookSecret) secret = creds.webhookSecret;
      } catch { /* fall back to platform secret */ }
    }
    if (!verifyWebhookSignature(rawBody, signature, secret)) {
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }

    if ((event.event === 'payment.captured' || event.event === 'order.paid') && order) {
      const paymentId: string | null = event?.payload?.payment?.entity?.id ?? null;
      await confirmOrderPaid({ orderId: order.id, razorpayPaymentId: paymentId });
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});

const upiPublicSchema = z.object({
  vpa: z.string().regex(/^[\w.\-]+@[\w.\-]+$/, 'Invalid UPI VPA'),
  displayName: z.string().min(1).max(80),
});

const bankPublicSchema = z.object({
  accountHolder: z.string().min(2).max(120),
  accountLast4: z.string().regex(/^\d{4}$/, 'Enter the last 4 digits only'),
  ifsc: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC').optional(),
  bankName: z.string().min(2).max(80).optional(),
});

const codPublicSchema = z.object({
  notes: z.string().max(200).optional(),
});

// Each provider has different shape; we validate inside the handler based on `provider`.
const baseSchema = z.object({
  provider: z.nativeEnum(PaymentProvider),
  label: z.string().min(1).max(80),
  mode: z.nativeEnum(PaymentMethodMode).default(PaymentMethodMode.TEST),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
});

const createSchema = baseSchema.extend({
  // Provider-specific bits — validated below, not by zod, since shape varies.
  credentials: z.record(z.any()).optional(),
  publicConfig: z.record(z.any()).optional(),
});

const updateSchema = baseSchema.partial().extend({
  credentials: z.record(z.any()).optional(),
  publicConfig: z.record(z.any()).optional(),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getVendor(userId: string) {
  return prisma.vendor.findUnique({ where: { userId } });
}

/**
 * Sanitize a row for client use. NEVER includes the encrypted credentials blob.
 * `publicConfig` is safe (UPI VPA, key_id, account last4 — no secrets).
 */
function toClient(row: {
  id: string; vendorId: string; provider: PaymentProvider; label: string;
  mode: PaymentMethodMode; isActive: boolean; isDefault: boolean;
  publicConfig: any; lastVerifiedAt: Date | null; verifyStatus: string | null;
  credentials: string | null; createdAt: Date; updatedAt: Date;
}) {
  return {
    id: row.id,
    vendorId: row.vendorId,
    provider: row.provider,
    label: row.label,
    mode: row.mode,
    isActive: row.isActive,
    isDefault: row.isDefault,
    publicConfig: row.publicConfig,
    hasCredentials: !!row.credentials,
    lastVerifiedAt: row.lastVerifiedAt,
    verifyStatus: row.verifyStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function validateProviderShape(
  provider: PaymentProvider,
  credentials: Record<string, any> | undefined,
  publicConfig: Record<string, any> | undefined,
): { error?: string; creds?: Record<string, any>; publicConfig?: Record<string, any> } {
  switch (provider) {
    case PaymentProvider.RAZORPAY: {
      if (!credentials) return { error: 'Razorpay requires credentials (keyId, keySecret)' };
      const parsed = razorpayCredsSchema.safeParse(credentials);
      if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid Razorpay credentials' };
      return {
        creds: parsed.data,
        publicConfig: { keyId: parsed.data.keyId }, // safe to expose to client
      };
    }
    case PaymentProvider.UPI_MANUAL: {
      const parsed = upiPublicSchema.safeParse(publicConfig);
      if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid UPI config' };
      return { publicConfig: parsed.data };
    }
    case PaymentProvider.BANK_TRANSFER: {
      const parsed = bankPublicSchema.safeParse(publicConfig);
      if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid bank config' };
      return { publicConfig: parsed.data };
    }
    case PaymentProvider.COD: {
      const parsed = codPublicSchema.safeParse(publicConfig ?? {});
      if (!parsed.success) return { error: 'Invalid COD config' };
      return { publicConfig: parsed.data };
    }
  }
}

// ─── Public ──────────────────────────────────────────────────────────────────

/** Storefront: list a vendor's active payment methods. Strips internal fields. */
router.get('/public/vendors/:vendorId/methods', async (req, res, next) => {
  try {
    const { resolveVendorId } = await import('../lib/vendor-slug');
    const vendorId = await resolveVendorId(req.params.vendorId);
    if (!vendorId) return res.json([]);
    const rows = await prisma.vendorPaymentMethod.findMany({
      where: { vendorId, isActive: true },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        provider: true,
        label: true,
        isDefault: true,
        publicConfig: true,
      },
    });
    res.json(rows);
  } catch (e) { next(e); }
});

// ─── Routes ──────────────────────────────────────────────────────────────────

router.get('/vendor/methods', requireAuth, requireRole(Role.VENDOR), async (req, res, next) => {
  try {
    const vendor = await getVendor(req.user!.id);
    if (!vendor) return res.status(404).json({ error: 'Vendor profile not created' });

    const rows = await prisma.vendorPaymentMethod.findMany({
      where: { vendorId: vendor.id },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    res.json(rows.map(toClient));
  } catch (e) { next(e); }
});

router.post('/vendor/methods', requireAuth, requireRole(Role.VENDOR), async (req, res, next) => {
  try {
    const vendor = await getVendor(req.user!.id);
    if (!vendor) return res.status(404).json({ error: 'Vendor profile not created' });

    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const shape = validateProviderShape(parsed.data.provider, parsed.data.credentials, parsed.data.publicConfig);
    if (shape.error) return res.status(400).json({ error: shape.error });

    // Enforce single default per vendor
    if (parsed.data.isDefault) {
      await prisma.vendorPaymentMethod.updateMany({
        where: { vendorId: vendor.id, isDefault: true },
        data: { isDefault: false },
      });
    }

    const row = await prisma.vendorPaymentMethod.create({
      data: {
        vendorId: vendor.id,
        provider: parsed.data.provider,
        label: parsed.data.label,
        mode: parsed.data.mode,
        isActive: parsed.data.isActive,
        isDefault: parsed.data.isDefault,
        credentials: shape.creds ? encryptJson(shape.creds) : null,
        publicConfig: shape.publicConfig ?? undefined,
      },
    });
    res.status(201).json(toClient(row));
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return res.status(409).json({ error: 'A method with this provider and label already exists.' });
    }
    next(e);
  }
});

router.patch('/vendor/methods/:id', requireAuth, requireRole(Role.VENDOR), async (req, res, next) => {
  try {
    const vendor = await getVendor(req.user!.id);
    if (!vendor) return res.status(404).json({ error: 'Vendor profile not created' });

    const existing = await prisma.vendorPaymentMethod.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.vendorId !== vendor.id) {
      return res.status(404).json({ error: 'Payment method not found' });
    }

    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const data: Record<string, unknown> = {};
    if (parsed.data.label !== undefined) data.label = parsed.data.label;
    if (parsed.data.mode !== undefined) data.mode = parsed.data.mode;
    if (parsed.data.isActive !== undefined) data.isActive = parsed.data.isActive;

    // Re-validate only if credentials or publicConfig is being changed
    if (parsed.data.credentials || parsed.data.publicConfig) {
      const shape = validateProviderShape(
        existing.provider,
        parsed.data.credentials,
        parsed.data.publicConfig ?? (existing.publicConfig as Record<string, unknown>),
      );
      if (shape.error) return res.status(400).json({ error: shape.error });
      if (shape.creds) data.credentials = encryptJson(shape.creds);
      if (shape.publicConfig) data.publicConfig = shape.publicConfig;
      // Changing creds invalidates last verification
      data.lastVerifiedAt = null;
      data.verifyStatus = null;
    }

    if (parsed.data.isDefault === true) {
      await prisma.vendorPaymentMethod.updateMany({
        where: { vendorId: vendor.id, isDefault: true, NOT: { id: existing.id } },
        data: { isDefault: false },
      });
      data.isDefault = true;
    } else if (parsed.data.isDefault === false) {
      data.isDefault = false;
    }

    const row = await prisma.vendorPaymentMethod.update({ where: { id: existing.id }, data });
    res.json(toClient(row));
  } catch (e) { next(e); }
});

router.delete('/vendor/methods/:id', requireAuth, requireRole(Role.VENDOR), async (req, res, next) => {
  try {
    const vendor = await getVendor(req.user!.id);
    if (!vendor) return res.status(404).json({ error: 'Vendor profile not created' });

    const existing = await prisma.vendorPaymentMethod.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.vendorId !== vendor.id) {
      return res.status(404).json({ error: 'Payment method not found' });
    }

    // Block delete if any orders that aren't terminal still reference it.
    const inUse = await prisma.order.count({
      where: { paymentMethodId: existing.id, status: { in: ['PENDING', 'PAID', 'SHIPPED'] } },
    });
    if (inUse > 0) {
      return res.status(409).json({
        error: `Cannot delete: ${inUse} active order(s) still reference this method. Deactivate it instead.`,
      });
    }

    await prisma.vendorPaymentMethod.delete({ where: { id: existing.id } });
    res.status(204).end();
  } catch (e) { next(e); }
});

/**
 * Server-side connectivity test against the stored credentials. Never returns the secrets.
 * For RAZORPAY, hits `orders.all` with a 1-item limit (cheap, read-only).
 * For non-key providers, just confirms the public config is usable.
 */
router.post('/vendor/methods/:id/test', requireAuth, requireRole(Role.VENDOR), async (req, res, next) => {
  try {
    const vendor = await getVendor(req.user!.id);
    if (!vendor) return res.status(404).json({ error: 'Vendor profile not created' });

    const row = await prisma.vendorPaymentMethod.findUnique({ where: { id: req.params.id } });
    if (!row || row.vendorId !== vendor.id) return res.status(404).json({ error: 'Payment method not found' });

    let status = 'ok';
    let message = '';

    try {
      if (row.provider === PaymentProvider.RAZORPAY) {
        if (!row.credentials) throw new Error('Missing credentials');
        const creds = decryptJson<RazorpayCreds>(row.credentials);
        const rzp = new Razorpay({ key_id: creds.keyId, key_secret: creds.keySecret });
        await rzp.orders.all({ count: 1 });
        message = 'Razorpay credentials authenticated.';
      } else if (row.provider === PaymentProvider.UPI_MANUAL || row.provider === PaymentProvider.BANK_TRANSFER) {
        if (!row.publicConfig) throw new Error('Missing public config');
        message = 'Static configuration is valid.';
      } else if (row.provider === PaymentProvider.COD) {
        message = 'COD does not require external verification.';
      }
    } catch (e: any) {
      status = `error: ${e?.error?.description ?? e?.message ?? 'verification failed'}`;
    }

    const updated = await prisma.vendorPaymentMethod.update({
      where: { id: row.id },
      data: { lastVerifiedAt: new Date(), verifyStatus: status },
    });
    res.json({ ok: status === 'ok', status, message, method: toClient(updated) });
  } catch (e) { next(e); }
});

// ─── Admin (cross-vendor) ────────────────────────────────────────────────────

const adminListSchema = z.object({
  provider: z.nativeEnum(PaymentProvider).optional(),
  active: z.enum(['true', 'false']).optional(),
  vendorId: z.string().uuid().optional(),
  q: z.string().trim().min(1).max(120).optional(),
});

router.get(
  '/admin/methods',
  requireAuth,
  requireRole(Role.ADMIN),
  requirePermission(Permission.PAYMENT_METHOD_VIEW),
  async (req, res, next) => {
    try {
      const parsed = adminListSchema.safeParse(req.query);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

      const { provider, active, vendorId, q } = parsed.data;
      const rows = await prisma.vendorPaymentMethod.findMany({
        where: {
          ...(provider ? { provider } : {}),
          ...(active === 'true' ? { isActive: true } : active === 'false' ? { isActive: false } : {}),
          ...(vendorId ? { vendorId } : {}),
          ...(q
            ? {
                OR: [
                  { label: { contains: q, mode: 'insensitive' } },
                  { vendor: { shopName: { contains: q, mode: 'insensitive' } } },
                  { vendor: { user: { email: { contains: q, mode: 'insensitive' } } } },
                ],
              }
            : {}),
        },
        include: {
          vendor: {
            select: {
              id: true,
              shopName: true,
              user: { select: { name: true, email: true } },
            },
          },
          _count: { select: { orders: true } },
        },
        orderBy: [{ vendor: { shopName: 'asc' } }, { createdAt: 'asc' }],
        take: 500,
      });

      // Strip credentials ciphertext; admin gets metadata + publicConfig only.
      res.json(
        rows.map((r) => ({
          id: r.id,
          provider: r.provider,
          label: r.label,
          mode: r.mode,
          isActive: r.isActive,
          isDefault: r.isDefault,
          publicConfig: r.publicConfig,
          hasCredentials: !!r.credentials,
          lastVerifiedAt: r.lastVerifiedAt,
          verifyStatus: r.verifyStatus,
          orderCount: r._count.orders,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
          vendor: r.vendor,
        })),
      );
    } catch (e) { next(e); }
  },
);

const adminPatchSchema = z.object({
  isActive: z.boolean().optional(),
});

/**
 * Admin override: deactivate a vendor's method (e.g. leaked keys, suspected fraud).
 * Cannot read decrypted credentials. Re-activation also allowed.
 */
router.patch(
  '/admin/methods/:id',
  requireAuth,
  requireRole(Role.ADMIN),
  requirePermission(Permission.PAYMENT_METHOD_MANAGE),
  async (req, res, next) => {
    try {
      const parsed = adminPatchSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
      if (parsed.data.isActive === undefined) {
        return res.status(400).json({ error: 'Provide at least one field to update' });
      }

      const existing = await prisma.vendorPaymentMethod.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'Payment method not found' });

      const updated = await prisma.vendorPaymentMethod.update({
        where: { id: existing.id },
        data: { isActive: parsed.data.isActive },
      });
      await audit(
        req.user!.id,
        parsed.data.isActive ? 'payment_method.admin.activate' : 'payment_method.admin.deactivate',
        existing.id,
        { vendorId: existing.vendorId, provider: existing.provider, label: existing.label },
      );
      res.json({ id: updated.id, isActive: updated.isActive });
    } catch (e) { next(e); }
  },
);

export default router;
