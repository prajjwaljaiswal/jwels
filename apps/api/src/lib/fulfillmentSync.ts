import { OrderStatus, ShipmentStatus } from '@prisma/client';
import { prisma } from './prisma';
import { sendOrderShippedEmail, sendOrderDeliveredEmail } from './email';
import { sendWhatsApp } from './whatsapp';

// Single source of truth for moving an order item through SHIPPED → DELIVERED.
//
// Why this exists: dispatch can be triggered three ways (the order-status
// dropdown, /shipping/.../ship, and /fulfillment/.../generate-label). Before
// this module each set OrderItem.status differently — some forgot dispatchedAt,
// none fired the "shipped" notification, and Shipment.status drifted out of sync.
// Every dispatch path now funnels through these two helpers so the behaviour is
// identical and the customer is notified exactly once per real transition.
//
// Model:
//   • OrderItem.status is the customer-facing source of truth.
//   • Shipping does NOT touch Shipment.status — generating a label leaves the
//     shipment at LABEL_GENERATED so the manifest/pickup workflow still picks it
//     up. The shipment advances through its own lifecycle (manifest → pickup →
//     status PATCH / carrier webhook).
//   • Delivery IS terminal, so it drives any linked Shipment to DELIVERED too,
//     keeping fulfillment reports and payouts correct.

const SHIPMENT_TERMINAL: ShipmentStatus[] = [
  ShipmentStatus.DELIVERED,
  ShipmentStatus.COMPLETED,
  ShipmentStatus.CANCELLED,
  ShipmentStatus.RTO_INITIATED,
  ShipmentStatus.RTO_DELIVERED,
];

type ItemForNotify = {
  shippingCarrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  product: { name: string } | null;
  order: { id: string; customer: { email: string | null; name: string | null; phone: string | null } | null };
};

/** Best-effort "your order has shipped" email + WhatsApp. Never throws. */
async function notifyShipped(item: ItemForNotify): Promise<void> {
  try {
    const customer = item.order?.customer;
    if (!customer?.email) return;
    await sendOrderShippedEmail(customer.email, {
      orderId: item.order.id,
      customerName: customer.name || 'there',
      productName: item.product?.name ?? 'Your item',
      carrier: item.shippingCarrier,
      trackingNumber: item.trackingNumber,
      trackingUrl: item.trackingUrl,
    });
    if (customer.phone) {
      void sendWhatsApp(
        customer.phone,
        `Your order #${item.order.id.slice(0, 8).toUpperCase()} has shipped` +
          `${item.shippingCarrier ? ` via ${item.shippingCarrier}` : ''}` +
          `${item.trackingNumber ? ` (AWB ${item.trackingNumber})` : ''}. Track it in your account.`,
      );
    }
  } catch (e: any) {
    console.warn('[fulfillment] shipped notification failed:', e?.message);
  }
}

/** Best-effort "delivered" email. Never throws. */
async function notifyDelivered(item: ItemForNotify): Promise<void> {
  try {
    const customer = item.order?.customer;
    if (!customer?.email) return;
    await sendOrderDeliveredEmail(customer.email, {
      orderId: item.order.id,
      customerName: customer.name || 'there',
      productName: item.product?.name ?? 'Your item',
    });
  } catch (e: any) {
    console.warn('[fulfillment] delivered notification failed:', e?.message);
  }
}

const NOTIFY_INCLUDE = {
  shipment: true,
  product: { select: { name: true } },
  order: { select: { id: true, customer: { select: { email: true, name: true, phone: true } } } },
} as const;

export interface DispatchFields {
  trackingNumber?: string | null;
  courierName?: string | null;
  trackingUrl?: string | null;
  waybillUrl?: string | null;
  labelUrl?: string | null;
  dispatchedAt?: Date;
}

/**
 * Canonical "this item has shipped" transition.
 *
 * Sets OrderItem.status = SHIPPED + dispatchedAt, applies any supplied tracking
 * fields, and fires the shipped notification — exactly once. Idempotent: calling
 * it again on an already SHIPPED/DELIVERED item only patches supplied tracking
 * fields and never re-notifies. Deliberately does NOT advance Shipment.status,
 * so a freshly generated label stays manifest-eligible. Best-effort
 * notifications never block (or fail) the DB transition.
 */
export async function markItemShipped(orderItemId: string, fields: DispatchFields = {}): Promise<{ changed: boolean }> {
  const item = await prisma.orderItem.findUnique({
    where: { id: orderItemId },
    include: NOTIFY_INCLUDE,
  });
  if (!item) return { changed: false };

  const isNewlyShipped = item.status !== OrderStatus.SHIPPED && item.status !== OrderStatus.DELIVERED;

  const data: Record<string, unknown> = {};
  if (isNewlyShipped) {
    data.status = OrderStatus.SHIPPED;
    data.dispatchedAt = item.dispatchedAt ?? fields.dispatchedAt ?? new Date();
  }
  if (fields.trackingNumber) data.trackingNumber = fields.trackingNumber;
  if (fields.courierName)    data.shippingCarrier = fields.courierName;
  if (fields.trackingUrl)    data.trackingUrl = fields.trackingUrl;
  if (fields.waybillUrl)     data.waybillUrl = fields.waybillUrl;
  if (fields.labelUrl)       data.labelUrl = fields.labelUrl;

  if (Object.keys(data).length === 0) return { changed: false };

  await prisma.orderItem.update({ where: { id: item.id }, data });

  if (isNewlyShipped) {
    void notifyShipped({ ...item, ...data } as unknown as ItemForNotify);
  }
  return { changed: isNewlyShipped };
}

/**
 * Canonical "this item was delivered" transition.
 *
 * Sets OrderItem.status = DELIVERED + deliveredAt, drives any linked Shipment to
 * its terminal DELIVERED state (unless it is already terminal / RTO / cancelled),
 * and fires the delivered notification — exactly once. Idempotent on an
 * already-delivered item.
 */
export async function markItemDelivered(orderItemId: string): Promise<{ changed: boolean }> {
  const item = await prisma.orderItem.findUnique({
    where: { id: orderItemId },
    include: NOTIFY_INCLUDE,
  });
  if (!item) return { changed: false };

  const isNewlyDelivered = item.status !== OrderStatus.DELIVERED;
  const advanceShipment = !!item.shipment && !SHIPMENT_TERMINAL.includes(item.shipment.status);

  if (!isNewlyDelivered && !advanceShipment) return { changed: false };

  await prisma.$transaction([
    ...(isNewlyDelivered
      ? [prisma.orderItem.update({
          where: { id: item.id },
          data: { status: OrderStatus.DELIVERED, deliveredAt: item.deliveredAt ?? new Date() },
        })]
      : []),
    ...(advanceShipment
      ? [prisma.shipment.update({ where: { id: item.shipment!.id }, data: { status: ShipmentStatus.DELIVERED } })]
      : []),
  ]);

  if (isNewlyDelivered) void notifyDelivered(item as unknown as ItemForNotify);
  return { changed: isNewlyDelivered };
}
