import { OrderStatus } from '@prisma/client';
import { prisma } from './prisma';
import { createInvoiceForOrder } from './invoice';
import { sendOrderConfirmationEmail } from './email';

/**
 * Best-effort order-confirmation email. Never throws.
 */
export async function notifyOrderConfirmation(orderId: string): Promise<void> {
  try {
    const o = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: { select: { email: true, name: true } },
        items: { include: { product: { select: { name: true } }, vendor: { select: { shopName: true } } } },
      },
    });
    if (!o?.customer?.email) return;
    await sendOrderConfirmationEmail(o.customer.email, {
      orderId: o.id,
      customerName: o.customer.name || 'there',
      totalLabel: `₹${Number(o.totalAmount).toLocaleString('en-IN')}`,
      items: o.items.map((it) => ({
        name: it.product?.name ?? 'Item',
        quantity: it.quantity,
        priceLabel: `₹${Number(it.priceAtPurchase).toLocaleString('en-IN')}`,
      })),
      shopName: o.items[0]?.vendor?.shopName,
    });
  } catch (e: any) {
    console.warn('[email] order confirmation failed:', e?.message);
  }
}

/**
 * Atomically confirm an order as PAID exactly once, then run post-payment side
 * effects (stock decrement, coupon redemption), generate the GST invoice, and
 * email the customer. Idempotent — safe to call from both the client verify
 * endpoint and the Razorpay webhook (whichever arrives first wins; the other
 * returns alreadyProcessed).
 */
export async function confirmOrderPaid(opts: {
  orderId: string;
  razorpayPaymentId?: string | null;
}): Promise<{ ok: boolean; alreadyProcessed: boolean }> {
  const order = await prisma.order.findUnique({ where: { id: opts.orderId }, include: { items: true } });
  if (!order) return { ok: false, alreadyProcessed: false };

  const oversold: string[] = [];
  const claimed = await prisma.$transaction(async (tx) => {
    const claim = await tx.order.updateMany({
      where: { id: order.id, status: OrderStatus.PENDING },
      data: { status: OrderStatus.PAID, razorpayPaymentId: opts.razorpayPaymentId ?? order.razorpayPaymentId },
    });
    if (claim.count === 0) return false; // already processed by a concurrent/duplicate call
    // Conditional decrement guards against oversell: only decrement when enough
    // stock remains, so concurrent buyers of the last unit can't drive it negative.
    for (const it of order.items) {
      const r = await tx.product.updateMany({
        where: { id: it.productId, stockQuantity: { gte: it.quantity } },
        data: { stockQuantity: { decrement: it.quantity } },
      });
      if (r.count === 0) oversold.push(it.productId);
    }
    await tx.orderItem.updateMany({ where: { orderId: order.id }, data: { status: OrderStatus.PAID } });
    if (order.couponId) {
      await tx.couponRedemption.create({
        data: { couponId: order.couponId, orderId: order.id, customerId: order.customerId, amount: Number(order.discountAmount) },
      });
      await tx.coupon.update({ where: { id: order.couponId }, data: { usedCount: { increment: 1 } } });
    }
    return true;
  });

  if (!claimed) return { ok: true, alreadyProcessed: true };

  if (oversold.length) {
    console.warn(`[order ${order.id}] oversold (stock left untouched to avoid negative) for product(s): ${oversold.join(', ')} — needs ops review.`);
  }

  // Post-commit, best-effort: generate the tax invoice and email the customer.
  try { await createInvoiceForOrder(order.id); } catch (e: any) { console.warn('[invoice] generation failed:', e?.message); }
  void notifyOrderConfirmation(order.id);
  return { ok: true, alreadyProcessed: false };
}
