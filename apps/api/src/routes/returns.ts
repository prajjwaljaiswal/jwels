import { Router } from 'express';
import { z } from 'zod';
import {
  Role, Permission, OrderStatus, ReturnStatus, ReturnReason, RefundStatus, DisputeStatus,
} from '@prisma/client';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole, requirePermission } from '../middleware/auth';
import { razorpay, razorpayClient } from '../lib/razorpay';
import { decryptJson } from '../lib/crypto';
import { audit } from '../lib/audit';
import { sendRefundEmail, sendReturnRequestedEmail, sendReturnApprovedEmail, sendReturnRejectedEmail } from '../lib/email';

const router = Router();

async function getVendor(userId: string) {
  return prisma.vendor.findUnique({ where: { userId } });
}

async function returnWindowDays(): Promise<number> {
  const s = await prisma.setting.findUnique({ where: { key: 'return_window_days' } });
  const n = s ? parseInt(s.value, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 7;
}

// ─────────────────────────────────────────────────────────────────────────────
// Customer: request a return for a delivered order item
// ─────────────────────────────────────────────────────────────────────────────

const createSchema = z.object({
  orderItemId: z.string().uuid(),
  reason: z.nativeEnum(ReturnReason),
  description: z.string().max(1000).optional(),
  photoUrls: z.array(z.string().url()).max(6).optional(),
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const { orderItemId, reason, description, photoUrls } = parsed.data;

    const item = await prisma.orderItem.findUnique({
      where: { id: orderItemId },
      include: { order: { select: { customerId: true } }, returns: true },
    });
    if (!item || item.order.customerId !== req.user!.id) {
      return res.status(404).json({ error: 'Order item not found' });
    }
    if (item.status !== OrderStatus.DELIVERED) {
      return res.status(400).json({ error: 'Only delivered items can be returned' });
    }
    // Block duplicate open requests for the same item.
    const open = item.returns.find((r) => !['REJECTED', 'CANCELLED', 'REFUNDED'].includes(r.status));
    if (open) return res.status(409).json({ error: 'A return is already in progress for this item' });

    // Enforce the return window from delivery.
    const days = await returnWindowDays();
    if (item.deliveredAt) {
      const ageDays = (Date.now() - new Date(item.deliveredAt).getTime()) / (1000 * 60 * 60 * 24);
      if (ageDays > days) return res.status(400).json({ error: `Return window of ${days} days has passed` });
    }

    const created = await prisma.returnRequest.create({
      data: {
        orderId: item.orderId,
        orderItemId: item.id,
        customerId: req.user!.id,
        vendorId: item.vendorId,
        reason,
        description: description ?? null,
        photoUrls: photoUrls ?? [],
        status: ReturnStatus.REQUESTED,
      },
    });
    res.status(201).json(created);

    // Confirm the request to the customer (best-effort, post-response).
    void (async () => {
      try {
        const [user, prod] = await Promise.all([
          prisma.user.findUnique({ where: { id: req.user!.id }, select: { email: true, name: true } }),
          prisma.product.findUnique({ where: { id: item.productId }, select: { name: true } }),
        ]);
        if (user?.email) {
          await sendReturnRequestedEmail(user.email, {
            orderId: item.orderId,
            customerName: user.name || 'there',
            productName: prod?.name ?? 'your item',
            reason: String(reason),
          });
        }
      } catch (e: any) {
        console.warn('[email] return requested notification failed:', e?.message);
      }
    })();
  } catch (e) { next(e); }
});

// Customer: list own return requests
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const rows = await prisma.returnRequest.findMany({
      where: { customerId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      include: { orderItem: { include: { product: { select: { name: true, images: true } } } }, dispute: true },
    });
    res.json(rows);
  } catch (e) { next(e); }
});

// Customer: raise a dispute on a return (e.g. vendor rejected unfairly)
const disputeSchema = z.object({ subject: z.string().min(3).max(160), detail: z.string().max(2000).optional() });
router.post('/:id/dispute', requireAuth, async (req, res, next) => {
  try {
    const parsed = disputeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const rr = await prisma.returnRequest.findUnique({ where: { id: req.params.id }, include: { dispute: true } });
    if (!rr || rr.customerId !== req.user!.id) return res.status(404).json({ error: 'Return not found' });
    if (rr.dispute) return res.status(409).json({ error: 'A dispute already exists for this return' });
    const d = await prisma.dispute.create({
      data: {
        returnRequestId: rr.id,
        orderId: rr.orderId,
        raisedById: req.user!.id,
        subject: parsed.data.subject,
        detail: parsed.data.detail ?? null,
        status: DisputeStatus.OPEN,
      },
    });
    res.status(201).json(d);
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────────────────
// Vendor: manage returns for own items
// ─────────────────────────────────────────────────────────────────────────────

router.get('/vendor', requireAuth, requireRole(Role.VENDOR), async (req, res, next) => {
  try {
    const vendor = await getVendor(req.user!.id);
    if (!vendor) return res.status(404).json({ error: 'Vendor profile not created' });
    const status = (req.query.status as string | undefined)?.split(',') as ReturnStatus[] | undefined;
    const rows = await prisma.returnRequest.findMany({
      where: { vendorId: vendor.id, ...(status ? { status: { in: status } } : {}) },
      orderBy: { createdAt: 'desc' },
      include: {
        orderItem: { include: { product: { select: { name: true, images: true } } } },
        customer: { select: { name: true } },
        dispute: true,
      },
    });
    res.json(rows);
  } catch (e) { next(e); }
});

const vendorActionSchema = z.object({
  action: z.enum(['approve', 'reject', 'received']),
  note: z.string().max(1000).optional(),
});

router.patch('/:id/vendor', requireAuth, requireRole(Role.VENDOR), async (req, res, next) => {
  try {
    const vendor = await getVendor(req.user!.id);
    if (!vendor) return res.status(404).json({ error: 'Vendor profile not created' });
    const parsed = vendorActionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const rr = await prisma.returnRequest.findUnique({ where: { id: req.params.id } });
    if (!rr || rr.vendorId !== vendor.id) return res.status(404).json({ error: 'Return not found' });

    const next2: ReturnStatus =
      parsed.data.action === 'approve' ? ReturnStatus.APPROVED
        : parsed.data.action === 'reject' ? ReturnStatus.REJECTED
          : ReturnStatus.RECEIVED;

    // Guard valid transitions.
    const allowed: Record<string, ReturnStatus[]> = {
      [ReturnStatus.REQUESTED]: [ReturnStatus.APPROVED, ReturnStatus.REJECTED],
      [ReturnStatus.APPROVED]: [ReturnStatus.RECEIVED, ReturnStatus.REJECTED],
      [ReturnStatus.PICKUP_SCHEDULED]: [ReturnStatus.RECEIVED, ReturnStatus.REJECTED],
    };
    if (!(allowed[rr.status] ?? []).includes(next2)) {
      return res.status(400).json({ error: `Cannot ${parsed.data.action} a return that is ${rr.status}` });
    }

    const updated = await prisma.returnRequest.update({
      where: { id: rr.id },
      data: { status: next2, vendorNote: parsed.data.note ?? rr.vendorNote, resolvedBy: req.user!.id },
    });
    res.json(updated);

    // Notify the customer of the vendor's decision (best-effort, post-response).
    if (next2 === ReturnStatus.APPROVED || next2 === ReturnStatus.REJECTED) {
      void (async () => {
        try {
          const [customer, item] = await Promise.all([
            prisma.user.findUnique({ where: { id: rr.customerId }, select: { email: true, name: true } }),
            prisma.orderItem.findUnique({ where: { id: rr.orderItemId }, select: { product: { select: { name: true } } } }),
          ]);
          if (customer?.email) {
            const productName = item?.product?.name ?? 'your item';
            const customerName = customer.name || 'there';
            if (next2 === ReturnStatus.APPROVED) {
              await sendReturnApprovedEmail(customer.email, { orderId: rr.orderId, customerName, productName });
            } else {
              await sendReturnRejectedEmail(customer.email, { orderId: rr.orderId, customerName, productName, reason: updated.vendorNote });
            }
          }
        } catch (e: any) {
          console.warn('[email] return decision notification failed:', e?.message);
        }
      })();
    }
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────────────────
// Admin: list all returns + issue refunds
// ─────────────────────────────────────────────────────────────────────────────

router.get('/admin', requireAuth, requirePermission(Permission.RETURN_MANAGE), async (req, res, next) => {
  try {
    const status = (req.query.status as string | undefined)?.split(',') as ReturnStatus[] | undefined;
    const rows = await prisma.returnRequest.findMany({
      where: { ...(status ? { status: { in: status } } : {}) },
      orderBy: { createdAt: 'desc' },
      include: {
        orderItem: { select: { id: true, priceAtPurchase: true, quantity: true, product: { select: { name: true, images: true } } } },
        customer: { select: { name: true, email: true } },
        vendor: { select: { shopName: true } },
        order: { select: { id: true, status: true, paymentMethod: true, razorpayPaymentId: true } },
        dispute: true,
      },
    });
    res.json(rows);
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────────────────
// Admin: issue refund (Razorpay refund for prepaid; ledger-only for COD)
// ─────────────────────────────────────────────────────────────────────────────

const refundSchema = z.object({ amount: z.number().nonnegative().optional() });

router.post('/:id/refund', requireAuth, requirePermission(Permission.ORDER_REFUND), async (req, res, next) => {
  try {
    const parsed = refundSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const rr = await prisma.returnRequest.findUnique({
      where: { id: req.params.id },
      include: {
        orderItem: { include: { product: { select: { name: true } } } },
        customer: { select: { email: true, name: true } },
        order: { include: { paymentMethodRef: true, items: { select: { id: true, status: true, priceAtPurchase: true, quantity: true } } } },
      },
    });
    if (!rr) return res.status(404).json({ error: 'Return not found' });
    if (rr.refundStatus === RefundStatus.COMPLETED) {
      return res.status(409).json({ error: 'This return is already refunded' });
    }

    // Default refund = the item's paid line value; admin may override (clamped).
    const lineValue = Number(rr.orderItem.priceAtPurchase) * rr.orderItem.quantity;
    const amount = Math.min(parsed.data.amount ?? lineValue, lineValue);
    const amountPaise = Math.round(amount * 100);

    // Issue the gateway refund when the order was paid online (has a payment id).
    let razorpayRefundId: string | null = null;
    const order = rr.order;
    if (order.razorpayPaymentId && order.status !== OrderStatus.PENDING) {
      try {
        let client = razorpay;
        if (order.paymentMethodRef?.credentials) {
          const creds = decryptJson<{ keyId: string; keySecret: string }>(order.paymentMethodRef.credentials);
          client = razorpayClient(creds);
        }
        const refund = await (client.payments as any).refund(order.razorpayPaymentId, { amount: amountPaise, speed: 'normal' });
        razorpayRefundId = refund?.id ?? null;
      } catch (e: any) {
        return res.status(502).json({ error: `Gateway refund failed: ${e?.message ?? 'unknown error'}` });
      }
    }
    // COD / manual orders: no gateway call — recorded as a manual refund obligation.

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.returnRequest.update({
        where: { id: rr.id },
        data: {
          status: ReturnStatus.REFUNDED,
          refundStatus: RefundStatus.COMPLETED,
          refundAmount: amount,
          razorpayRefundId,
          refundedAt: new Date(),
          resolvedBy: req.user!.id,
        },
      });
      // Mark the returned item REFUNDED.
      await tx.orderItem.update({ where: { id: rr.orderItemId }, data: { status: OrderStatus.REFUNDED } });

      // If every item in the order is now REFUNDED/CANCELLED, refund the whole
      // order and reverse the coupon redemption.
      const others = order.items.filter((i) => i.id !== rr.orderItemId);
      const allClosed = others.every((i) => i.status === OrderStatus.REFUNDED || i.status === OrderStatus.CANCELLED);
      if (allClosed) {
        await tx.order.update({ where: { id: order.id }, data: { status: OrderStatus.REFUNDED } });
        if (order.couponId) {
          await tx.couponRedemption.deleteMany({ where: { orderId: order.id } });
          await tx.coupon.update({ where: { id: order.couponId }, data: { usedCount: { decrement: 1 } } });
        }
      }
      return updated;
    });

    await audit(req.user!.id, 'ORDER_REFUND', rr.id, { amount, razorpayRefundId, orderId: order.id });

    // Notify the customer (best-effort).
    if (rr.customer?.email) {
      sendRefundEmail(rr.customer.email, {
        orderId: order.id,
        customerName: rr.customer.name || 'there',
        productName: rr.orderItem.product?.name ?? 'your item',
        amountLabel: `₹${amount.toLocaleString('en-IN')}`,
        gateway: !!razorpayRefundId,
      }).catch((e) => console.warn('[email] refund notification failed:', e?.message));
    }
    res.json(result);
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────────────────
// Admin: disputes
// ─────────────────────────────────────────────────────────────────────────────

router.get('/disputes', requireAuth, requirePermission(Permission.DISPUTE_MANAGE), async (req, res, next) => {
  try {
    const status = (req.query.status as string | undefined) as DisputeStatus | undefined;
    const rows = await prisma.dispute.findMany({
      where: { ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
      include: {
        raisedBy: { select: { name: true, email: true } },
        returnRequest: { include: { orderItem: { include: { product: { select: { name: true } } } } } },
      },
    });
    res.json(rows);
  } catch (e) { next(e); }
});

const resolveDisputeSchema = z.object({
  status: z.enum(['UNDER_REVIEW', 'RESOLVED', 'REJECTED', 'ESCALATED']),
  resolution: z.string().max(2000).optional(),
});

router.patch('/disputes/:id', requireAuth, requirePermission(Permission.DISPUTE_MANAGE), async (req, res, next) => {
  try {
    const parsed = resolveDisputeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const d = await prisma.dispute.findUnique({ where: { id: req.params.id } });
    if (!d) return res.status(404).json({ error: 'Dispute not found' });
    const terminal = ['RESOLVED', 'REJECTED'].includes(parsed.data.status);
    const updated = await prisma.dispute.update({
      where: { id: d.id },
      data: {
        status: parsed.data.status as DisputeStatus,
        resolution: parsed.data.resolution ?? d.resolution,
        ...(terminal ? { resolvedBy: req.user!.id, resolvedAt: new Date() } : {}),
      },
    });
    await audit(req.user!.id, 'DISPUTE_UPDATE', d.id, { status: parsed.data.status });
    res.json(updated);
  } catch (e) { next(e); }
});

export default router;
