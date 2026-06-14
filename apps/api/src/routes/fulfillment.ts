import { Router } from 'express';
import { z } from 'zod';
import { Role, OrderStatus, ShipmentStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';
import { decryptJson } from '../lib/crypto';
import { getCarrier } from '../lib/carriers';
import { sendOrderShippedEmail, sendOrderDeliveredEmail } from '../lib/email';
import { sendWhatsApp } from '../lib/whatsapp';

const router = Router();

async function getVendor(userId: string) {
  return prisma.vendor.findUnique({ where: { userId } });
}

/** Best-effort "your order has shipped" email. Never throws. */
async function notifyShipped(shipmentId: string): Promise<void> {
  try {
    const s = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        orderItem: {
          include: {
            product: { select: { name: true } },
            order: { select: { id: true, customer: { select: { email: true, name: true, phone: true } } } },
          },
        },
      },
    });
    const customer = s?.orderItem?.order?.customer;
    if (!customer?.email) return;
    await sendOrderShippedEmail(customer.email, {
      orderId: s!.orderItem.order.id,
      customerName: customer.name || 'there',
      productName: s!.orderItem.product?.name ?? 'Your item',
      carrier: s!.carrierName,
      trackingNumber: s!.awb,
    });
    if (customer.phone) {
      void sendWhatsApp(customer.phone, `Your order #${s!.orderItem.order.id.slice(0, 8).toUpperCase()} has shipped via ${s!.carrierName}${s!.awb ? ` (AWB ${s!.awb})` : ''}. Track it in your account.`);
    }
  } catch (e: any) {
    console.warn('[email] shipped notification failed:', e?.message);
  }
}

/** Best-effort "delivered" notification. Never throws. */
async function notifyDelivered(shipmentId: string): Promise<void> {
  try {
    const s = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        orderItem: {
          include: {
            product: { select: { name: true } },
            order: { select: { id: true, customer: { select: { email: true, name: true, phone: true } } } },
          },
        },
      },
    });
    const customer = s?.orderItem?.order?.customer;
    if (!customer?.email) return;
    await sendOrderDeliveredEmail(customer.email, {
      orderId: s!.orderItem.order.id,
      customerName: customer.name || 'there',
      productName: s!.orderItem.product?.name ?? 'Your item',
    });
  } catch (e: any) {
    console.warn('[email] delivered notification failed:', e?.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Status transition whitelist
// ─────────────────────────────────────────────────────────────────────────────

const TRANSITIONS: Record<string, ShipmentStatus[]> = {
  LABEL_GENERATED:    ['MANIFEST_GENERATED', 'PICKUP_SCHEDULED', 'CANCELLED'],
  MANIFEST_GENERATED: ['PICKUP_SCHEDULED', 'CANCELLED'],
  PICKUP_SCHEDULED:   ['PICKED_UP', 'CANCELLED'],
  PICKED_UP:          ['IN_TRANSIT'],
  IN_TRANSIT:         ['OUT_FOR_DELIVERY', 'RTO_INITIATED'],
  OUT_FOR_DELIVERY:   ['DELIVERED', 'RTO_INITIATED'],
  DELIVERED:          ['COMPLETED'],
  RTO_INITIATED:      ['RTO_DELIVERED'],
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/fulfillment/orders/items/:itemId/generate-label
// ─────────────────────────────────────────────────────────────────────────────

router.post(
  '/orders/items/:itemId/generate-label',
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
          product: { select: { name: true, weightGrams: true } },
          shipment: true,
        },
      });
      if (!item || item.vendorId !== vendor.id) {
        return res.status(404).json({ error: 'Order item not found' });
      }
      if (item.shipment) {
        return res.status(400).json({ error: 'Label already generated for this item' });
      }

      const manual = req.body?.manual === true;

      let awb: string | null = item.trackingNumber ?? null;
      let labelUrl: string | null = item.labelUrl ?? null;
      const carrierName = item.shippingCarrier ?? 'MANUAL';

      // Try carrier API if item has a LIVE shipping method (skip when manual=true)
      if (!manual && item.shippingMethodId) {
        const method = await prisma.shippingMethod.findUnique({
          where: { id: item.shippingMethodId },
          include: { carrierAccount: true },
        });

        if (method?.rateMode === 'LIVE' && method.carrierAccount) {
          const adapter = getCarrier(method.carrierAccount.carrier);
          if (adapter?.createShipment) {
            const pickup = await prisma.vendorAddress.findUnique({ where: { vendorId: vendor.id } });
            if (!pickup) {
              return res.status(400).json({ error: 'Add a pickup address before generating labels' });
            }

            let credentials: Record<string, unknown> = {};
            try {
              credentials = decryptJson<Record<string, unknown>>(method.carrierAccount.credentials);
            } catch {
              return res.status(500).json({ error: 'Failed to decrypt carrier credentials' });
            }

            const addr = item.order.shippingAddress as any;
            let result;
            try {
              result = await adapter.createShipment(
                {
                  mode: method.carrierAccount.mode,
                  credentials,
                  defaults: (method.carrierAccount.defaultsJson as Record<string, unknown> | null) ?? null,
                },
                {
                  fromPostalCode: pickup.postalCode,
                  toPostalCode: addr.pincode,
                  toCountry: 'IN',
                  weightGrams: (item.product as any).weightGrams ?? 200 * item.quantity,
                  declaredValue: Number(item.priceAtPurchase) * item.quantity,
                  itemCount: item.quantity,
                  paymentMode: item.order.paymentMethod === 'COD' ? 'COD' : 'PREPAID',
                  // serviceCode: carrier-specific. item.shippingService holds it if set.
                  // Fall back: map ShippingServiceType → Delhivery codes (S=Surface, E=Express).
                  serviceCode: item.shippingService
                    ?? (method.serviceType === 'EXPRESS' || method.serviceType === 'OVERNIGHT' ? 'E' : 'S'),
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
            } catch (e: any) {
              // Surface carrier errors directly — vendor needs to know why AWB was not issued
              return res.status(400).json({
                error: e?.message ?? `${method.carrierAccount.carrier} shipment creation failed`,
                carrier: method.carrierAccount.carrier,
              });
            }

            awb = result.awb;
            labelUrl = result.labelUrl ?? null;

            // Sync back onto OrderItem for legacy compatibility
            await prisma.orderItem.update({
              where: { id: item.id },
              data: { trackingNumber: awb, labelUrl },
            });
          }
        }
      }

      const shipment = await prisma.shipment.create({
        data: {
          orderItemId:  item.id,
          orderId:      item.orderId,
          vendorId:     vendor.id,
          carrierName,
          awb,
          labelUrl,
          status:       ShipmentStatus.LABEL_GENERATED,
          weightGrams:  (item.product as any).weightGrams ?? null,
          declaredValue: Number(item.priceAtPurchase) * item.quantity,
        },
      });

      res.status(201).json(shipment);
    } catch (e) { next(e); }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/fulfillment/orders/items/:itemId/manual-shipment
// Creates a blank shipment record with no carrier API call — used by manual AWB entry.
// ─────────────────────────────────────────────────────────────────────────────

router.post(
  '/orders/items/:itemId/manual-shipment',
  requireAuth,
  requireRole(Role.VENDOR),
  async (req, res, next) => {
    try {
      const vendor = await getVendor(req.user!.id);
      if (!vendor) return res.status(404).json({ error: 'Vendor profile not created' });

      const item = await prisma.orderItem.findUnique({
        where: { id: req.params.itemId },
        include: {
          product: { select: { weightGrams: true } },
          shipment: true,
        },
      });
      if (!item || item.vendorId !== vendor.id) {
        return res.status(404).json({ error: 'Order item not found' });
      }

      // If a shipment already exists return it — idempotent
      if (item.shipment) {
        return res.json(item.shipment);
      }

      const shipment = await prisma.shipment.create({
        data: {
          orderItemId:   item.id,
          orderId:       item.orderId,
          vendorId:      vendor.id,
          carrierName:   'MANUAL',
          awb:           null,
          labelUrl:      null,
          status:        ShipmentStatus.LABEL_GENERATED,
          weightGrams:   (item.product as any).weightGrams ?? null,
          declaredValue: Number(item.priceAtPurchase) * item.quantity,
        },
      });

      res.status(201).json(shipment);
    } catch (e) { next(e); }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/fulfillment/orders/items/:itemId/label
// ─────────────────────────────────────────────────────────────────────────────

router.get(
  '/orders/items/:itemId/label',
  requireAuth,
  requireRole(Role.VENDOR),
  async (req, res, next) => {
    try {
      const vendor = await getVendor(req.user!.id);
      if (!vendor) return res.status(404).json({ error: 'Vendor profile not created' });

      const shipment = await prisma.shipment.findFirst({
        where: { orderItemId: req.params.itemId, vendorId: vendor.id },
      });
      if (!shipment) return res.status(404).json({ error: 'No label found for this item' });

      res.json({ labelUrl: shipment.labelUrl, awb: shipment.awb, status: shipment.status });
    } catch (e) { next(e); }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/fulfillment/shipments/:shipmentId/awb  — manual AWB entry
// ─────────────────────────────────────────────────────────────────────────────

const patchAwbSchema = z.object({
  awb:         z.string().min(1),
  carrierName: z.string().min(1),
  labelUrl:    z.string().url().optional().nullable(),
  trackingUrl: z.string().url().optional().nullable(),
});

router.patch(
  '/shipments/:shipmentId/awb',
  requireAuth,
  requireRole(Role.VENDOR),
  async (req, res, next) => {
    try {
      const vendor = await getVendor(req.user!.id);
      if (!vendor) return res.status(404).json({ error: 'Vendor profile not created' });

      const parsed = patchAwbSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

      const shipment = await prisma.shipment.findUnique({ where: { id: req.params.shipmentId } });
      if (!shipment || shipment.vendorId !== vendor.id) {
        return res.status(404).json({ error: 'Shipment not found' });
      }

      const { awb, carrierName, labelUrl, trackingUrl } = parsed.data;

      const updated = await prisma.shipment.update({
        where: { id: shipment.id },
        data: { awb, carrierName, ...(labelUrl !== undefined && { labelUrl }) },
      });

      // Sync back to OrderItem
      await prisma.orderItem.update({
        where: { id: shipment.orderItemId },
        data: {
          trackingNumber: awb,
          shippingCarrier: carrierName,
          ...(trackingUrl && { trackingUrl }),
          ...(labelUrl && { labelUrl }),
        },
      });

      res.json(updated);
    } catch (e) { next(e); }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/fulfillment/shipments/:shipmentId/status
// ─────────────────────────────────────────────────────────────────────────────

const patchStatusSchema = z.object({ status: z.nativeEnum(ShipmentStatus) });

router.patch(
  '/shipments/:shipmentId/status',
  requireAuth,
  requireRole(Role.VENDOR),
  async (req, res, next) => {
    try {
      const vendor = await getVendor(req.user!.id);
      if (!vendor) return res.status(404).json({ error: 'Vendor profile not created' });

      const parsed = patchStatusSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

      const shipment = await prisma.shipment.findUnique({ where: { id: req.params.shipmentId } });
      if (!shipment || shipment.vendorId !== vendor.id) {
        return res.status(404).json({ error: 'Shipment not found' });
      }

      const allowed = TRANSITIONS[shipment.status] ?? [];
      if (!allowed.includes(parsed.data.status)) {
        return res.status(400).json({
          error: `Cannot transition from ${shipment.status} to ${parsed.data.status}`,
        });
      }

      const now = new Date();
      const newStatus = parsed.data.status;

      // Determine OrderItem sync
      let itemData: Record<string, unknown> | null = null;
      if (newStatus === 'IN_TRANSIT') {
        itemData = { status: OrderStatus.SHIPPED, dispatchedAt: now };
      } else if (newStatus === 'DELIVERED') {
        itemData = { status: OrderStatus.DELIVERED, deliveredAt: now };
      } else if (newStatus === 'RTO_DELIVERED' || (newStatus === 'CANCELLED' && !['IN_TRANSIT', 'OUT_FOR_DELIVERY', 'PICKED_UP'].includes(shipment.status))) {
        itemData = { status: OrderStatus.CANCELLED };
      }

      const [updated] = await prisma.$transaction([
        prisma.shipment.update({
          where: { id: shipment.id },
          data: { status: newStatus },
          include: { trackingEvents: { orderBy: { eventTime: 'desc' } } },
        }),
        ...(itemData
          ? [prisma.orderItem.update({ where: { id: shipment.orderItemId }, data: itemData })]
          : []),
      ]);

      // Notify the customer on dispatch and delivery (best-effort).
      if (newStatus === 'IN_TRANSIT') void notifyShipped(shipment.id);
      else if (newStatus === 'DELIVERED') void notifyDelivered(shipment.id);

      res.json(updated);
    } catch (e) { next(e); }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/fulfillment/shipments
// ─────────────────────────────────────────────────────────────────────────────

router.get('/shipments', requireAuth, requireRole(Role.VENDOR), async (req, res, next) => {
  try {
    const vendor = await getVendor(req.user!.id);
    if (!vendor) return res.status(404).json({ error: 'Vendor profile not created' });

    const { status, page = '1', limit = '20', search } = req.query as Record<string, string>;
    const take = Math.min(parseInt(limit) || 20, 100);
    const skip = (Math.max(parseInt(page) || 1, 1) - 1) * take;

    const statuses = status ? (status.split(',') as ShipmentStatus[]) : undefined;

    const shipments = await prisma.shipment.findMany({
      where: {
        vendorId: vendor.id,
        ...(statuses ? { status: { in: statuses } } : {}),
        ...(search ? { awb: { contains: search, mode: 'insensitive' } } : {}),
      },
      include: {
        orderItem: {
          include: {
            product: { select: { name: true, images: true } },
            order: { select: { id: true, shippingAddress: true, createdAt: true, customer: { select: { name: true, phone: true } } } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    });

    const total = await prisma.shipment.count({
      where: {
        vendorId: vendor.id,
        ...(statuses ? { status: { in: statuses } } : {}),
        ...(search ? { awb: { contains: search, mode: 'insensitive' } } : {}),
      },
    });

    res.json({ shipments, total, page: parseInt(page) || 1, limit: take });
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/fulfillment/manifest
// ─────────────────────────────────────────────────────────────────────────────

const createManifestSchema = z.object({
  carrierName: z.string().min(1),
  shipmentIds: z.array(z.string().uuid()).min(1).max(200),
});

router.post('/manifest', requireAuth, requireRole(Role.VENDOR), async (req, res, next) => {
  try {
    const vendor = await getVendor(req.user!.id);
    if (!vendor) return res.status(404).json({ error: 'Vendor profile not created' });

    const parsed = createManifestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    // Verify all shipments belong to vendor
    const shipments = await prisma.shipment.findMany({
      where: { id: { in: parsed.data.shipmentIds }, vendorId: vendor.id },
    });
    if (shipments.length !== parsed.data.shipmentIds.length) {
      return res.status(400).json({ error: 'One or more shipment IDs not found' });
    }

    const manifest = await prisma.$transaction(async (tx) => {
      const m = await tx.manifest.create({
        data: {
          vendorId:      vendor.id,
          carrierName:   parsed.data.carrierName,
          shipmentCount: shipments.length,
          shipments: {
            create: shipments.map((s) => ({ shipmentId: s.id })),
          },
        },
        include: { shipments: { include: { shipment: true } } },
      });

      // Advance eligible shipments to MANIFEST_GENERATED
      await tx.shipment.updateMany({
        where: {
          id: { in: shipments.filter((s) => s.status === 'LABEL_GENERATED').map((s) => s.id) },
        },
        data: { status: ShipmentStatus.MANIFEST_GENERATED },
      });

      return m;
    });

    res.status(201).json(manifest);
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/fulfillment/manifest
// ─────────────────────────────────────────────────────────────────────────────

router.get('/manifest', requireAuth, requireRole(Role.VENDOR), async (req, res, next) => {
  try {
    const vendor = await getVendor(req.user!.id);
    if (!vendor) return res.status(404).json({ error: 'Vendor profile not created' });

    const { page = '1', limit = '20' } = req.query as Record<string, string>;
    const take = Math.min(parseInt(limit) || 20, 100);
    const skip = (Math.max(parseInt(page) || 1, 1) - 1) * take;

    const [manifests, total] = await Promise.all([
      prisma.manifest.findMany({
        where: { vendorId: vendor.id },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      prisma.manifest.count({ where: { vendorId: vendor.id } }),
    ]);

    res.json({ manifests, total, page: parseInt(page) || 1, limit: take });
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/fulfillment/manifest/:id
// ─────────────────────────────────────────────────────────────────────────────

router.get('/manifest/:id', requireAuth, requireRole(Role.VENDOR), async (req, res, next) => {
  try {
    const vendor = await getVendor(req.user!.id);
    if (!vendor) return res.status(404).json({ error: 'Vendor profile not created' });

    const manifest = await prisma.manifest.findUnique({
      where: { id: req.params.id },
      include: {
        shipments: {
          include: {
            shipment: {
              include: {
                orderItem: {
                  include: {
                    product: { select: { name: true } },
                    order: {
                      select: {
                        id: true,
                        shippingAddress: true,
                        customer: { select: { name: true, phone: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!manifest || manifest.vendorId !== vendor.id) {
      return res.status(404).json({ error: 'Manifest not found' });
    }

    res.json(manifest);
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/fulfillment/manifest/:id
// ─────────────────────────────────────────────────────────────────────────────

const patchManifestSchema = z.object({
  status: z.enum(['DRAFT', 'SUBMITTED', 'CLOSED']),
});

router.patch('/manifest/:id', requireAuth, requireRole(Role.VENDOR), async (req, res, next) => {
  try {
    const vendor = await getVendor(req.user!.id);
    if (!vendor) return res.status(404).json({ error: 'Vendor profile not created' });

    const parsed = patchManifestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const existing = await prisma.manifest.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.vendorId !== vendor.id) {
      return res.status(404).json({ error: 'Manifest not found' });
    }

    const updated = await prisma.manifest.update({
      where: { id: req.params.id },
      data: { status: parsed.data.status as any },
    });
    res.json(updated);
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/fulfillment/pickup/schedule
// ─────────────────────────────────────────────────────────────────────────────

const schedulePickupSchema = z.object({
  carrierName: z.string().min(1),
  pickupDate:  z.string().datetime(),
  notes:       z.string().max(500).optional(),
});

router.post('/pickup/schedule', requireAuth, requireRole(Role.VENDOR), async (req, res, next) => {
  try {
    const vendor = await getVendor(req.user!.id);
    if (!vendor) return res.status(404).json({ error: 'Vendor profile not created' });

    const parsed = schedulePickupSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const pickupAddress = await prisma.vendorAddress.findUnique({ where: { vendorId: vendor.id } });
    if (!pickupAddress) {
      return res.status(400).json({ error: 'Add a pickup address before scheduling pickup' });
    }

    const pickup = await prisma.carrierPickup.create({
      data: {
        vendorId:      vendor.id,
        carrierName:   parsed.data.carrierName,
        pickupDate:    new Date(parsed.data.pickupDate),
        notes:         parsed.data.notes,
        pickupAddress: pickupAddress as any,
        carrierRef:    null,
      },
    });

    res.status(201).json({
      ...pickup,
      note: 'Carrier notification pending — confirm with your carrier directly.',
    });
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/fulfillment/pickup
// ─────────────────────────────────────────────────────────────────────────────

router.get('/pickup', requireAuth, requireRole(Role.VENDOR), async (req, res, next) => {
  try {
    const vendor = await getVendor(req.user!.id);
    if (!vendor) return res.status(404).json({ error: 'Vendor profile not created' });

    const { status } = req.query as Record<string, string>;
    const pickups = await prisma.carrierPickup.findMany({
      where: {
        vendorId: vendor.id,
        ...(status ? { status: status as any } : {}),
      },
      orderBy: { pickupDate: 'desc' },
      take: 50,
    });
    res.json(pickups);
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/fulfillment/tracking/:awb
// ─────────────────────────────────────────────────────────────────────────────

const CARRIER_TRACKING_URLS: Record<string, string> = {
  DELHIVERY:    'https://www.delhivery.com/track/package/',
  BLUEDART:     'https://www.bluedart.com/web/guest/trackdartresult?trackFor=0&trackNo=',
  DTDC:         'https://www.dtdc.in/tracking/shipment-detail.asp?awbno=',
  FEDEX:        'https://www.fedex.com/apps/fedextrack/?tracknumbers=',
  SHIPROCKET:   'https://shiprocket.co/tracking/',
  INDIA_POST:   'https://www.indiapost.gov.in/VAS/Pages/trackconsignment.aspx?ConsignmentNo=',
  ECOM_EXPRESS: 'https://ecomexpress.in/tracking/?awb_field=',
  XPRESSBEES:   'https://xpressbees.com/shipment/tracking?awb=',
  SHADOWFAX:    'https://shadowfax.in/track/',
  USPS:         'https://tools.usps.com/go/TrackConfirmAction?qtc_tLabels1=',
};

router.get('/tracking/:awb', requireAuth, requireRole(Role.VENDOR), async (req, res, next) => {
  try {
    const vendor = await getVendor(req.user!.id);
    if (!vendor) return res.status(404).json({ error: 'Vendor profile not created' });

    const awb = req.params.awb;
    const shipment = await prisma.shipment.findFirst({
      where: { awb, vendorId: vendor.id },
      include: {
        trackingEvents: { orderBy: { eventTime: 'desc' } },
        orderItem: {
          include: {
            order: { select: { shippingAddress: true } },
          },
        },
      },
    });

    if (!shipment) return res.status(404).json({ error: 'Shipment not found' });

    // Try live tracking from adapter
    let liveEvents: Array<{ eventName: string; eventDescription?: string; eventTime: string; eventLocation?: string }> = [];
    if (shipment.carrierName && shipment.carrierName !== 'MANUAL') {
      try {
        const account = await prisma.vendorCarrierAccount.findFirst({
          where: { vendorId: vendor.id, carrier: shipment.carrierName, isActive: true },
        });
        if (account) {
          const adapter = getCarrier(account.carrier);
          if (adapter?.track) {
            let credentials: Record<string, unknown> = {};
            try { credentials = decryptJson<Record<string, unknown>>(account.credentials); } catch { /**/ }
            const events = await adapter.track({ mode: account.mode, credentials, defaults: account.defaultsJson as any }, awb);
            liveEvents = events.map((e) => ({
              eventName:        e.status,
              eventDescription: e.description,
              eventTime:        e.timestamp,
              eventLocation:    e.location,
            }));
          }
        }
      } catch {
        // Fall back to DB events only
      }
    }

    const carrierKey = (shipment.carrierName ?? '').toUpperCase();
    const trackingUrlBase = CARRIER_TRACKING_URLS[carrierKey];
    const trackingUrl = trackingUrlBase ? `${trackingUrlBase}${awb}` : null;

    res.json({
      awb,
      carrier:     shipment.carrierName,
      status:      shipment.status,
      labelUrl:    shipment.labelUrl,
      trackingUrl,
      dbEvents:    shipment.trackingEvents,
      liveEvents,
    });
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/fulfillment/carrier/webhook  (carrier push events)
// ─────────────────────────────────────────────────────────────────────────────

router.post('/carrier/webhook', async (req, res, next) => {
  try {
    const carrierName = (req.headers['x-carrier-name'] as string | undefined)?.toUpperCase();
    const { awb, events } = req.body as {
      awb: string;
      events: Array<{ name: string; description?: string; time: string; location?: string }>;
    };

    if (!awb || !Array.isArray(events)) {
      return res.status(400).json({ error: 'awb and events[] required' });
    }

    const shipment = await prisma.shipment.findFirst({ where: { awb } });
    if (!shipment) return res.status(404).json({ error: 'Shipment not found' });

    const created = await prisma.trackingEvent.createMany({
      data: events.map((e) => ({
        shipmentId:       shipment.id,
        eventName:        e.name,
        eventDescription: e.description,
        eventTime:        new Date(e.time),
        eventLocation:    e.location,
        rawPayload:       req.body,
      })),
      skipDuplicates: true,
    });

    res.json({ received: created.count });
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/fulfillment/reports/shipping
// ─────────────────────────────────────────────────────────────────────────────

router.get('/reports/shipping', requireAuth, requireRole(Role.VENDOR), async (req, res, next) => {
  try {
    const vendor = await getVendor(req.user!.id);
    if (!vendor) return res.status(404).json({ error: 'Vendor profile not created' });

    const { from, to } = req.query as Record<string, string>;
    const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate   = to   ? new Date(to)   : new Date();

    const [total, inTransit, delivered, rto] = await Promise.all([
      prisma.shipment.count({ where: { vendorId: vendor.id, createdAt: { gte: fromDate, lte: toDate } } }),
      prisma.shipment.count({ where: { vendorId: vendor.id, status: { in: ['IN_TRANSIT', 'OUT_FOR_DELIVERY'] } } }),
      prisma.shipment.count({ where: { vendorId: vendor.id, status: { in: ['DELIVERED', 'COMPLETED'] }, createdAt: { gte: fromDate, lte: toDate } } }),
      prisma.shipment.count({ where: { vendorId: vendor.id, status: { in: ['RTO_INITIATED', 'RTO_DELIVERED'] }, createdAt: { gte: fromDate, lte: toDate } } }),
    ]);

    const deliveredItems = await prisma.orderItem.findMany({
      where: { vendorId: vendor.id, status: 'DELIVERED', dispatchedAt: { not: null }, deliveredAt: { not: null, gte: fromDate, lte: toDate } },
      select: { dispatchedAt: true, deliveredAt: true },
    });

    let avgTransitDays = 0;
    if (deliveredItems.length > 0) {
      const totalDays = deliveredItems.reduce((sum, i) => {
        const days = (new Date(i.deliveredAt!).getTime() - new Date(i.dispatchedAt!).getTime()) / (1000 * 60 * 60 * 24);
        return sum + days;
      }, 0);
      avgTransitDays = Math.round(totalDays / deliveredItems.length);
    }

    res.json({ total, inTransit, delivered, rto, avgTransitDays, deliveryRate: total > 0 ? Math.round((delivered / total) * 100) : 0 });
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/fulfillment/reports/transit
// ─────────────────────────────────────────────────────────────────────────────

router.get('/reports/transit', requireAuth, requireRole(Role.VENDOR), async (req, res, next) => {
  try {
    const vendor = await getVendor(req.user!.id);
    if (!vendor) return res.status(404).json({ error: 'Vendor profile not created' });

    const { page = '1', limit = '20', format } = req.query as Record<string, string>;
    const take = format === 'csv' ? 1000 : Math.min(parseInt(limit) || 20, 100);
    const skip = format === 'csv' ? 0 : (Math.max(parseInt(page) || 1, 1) - 1) * take;

    const shipments = await prisma.shipment.findMany({
      where: { vendorId: vendor.id, status: { in: ['IN_TRANSIT', 'OUT_FOR_DELIVERY', 'PICKED_UP'] } },
      include: {
        orderItem: {
          include: {
            product: { select: { name: true } },
            order: { select: { id: true, shippingAddress: true, createdAt: true, customer: { select: { name: true } } } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take,
      skip,
    });

    if (format === 'csv') {
      const rows = shipments.map((s) => {
        const addr = s.orderItem.order.shippingAddress as any;
        return [
          s.awb ?? '',
          s.carrierName,
          s.status,
          s.orderItem.order.customer.name,
          `${addr.city}, ${addr.state}`,
          s.orderItem.order.id,
          new Date(s.createdAt).toLocaleDateString('en-IN'),
        ].join(',');
      });
      const csv = ['AWB,Carrier,Status,Customer,Destination,Order ID,Dispatched', ...rows].join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="transit-report.csv"');
      return res.send(csv);
    }

    const total = await prisma.shipment.count({ where: { vendorId: vendor.id, status: { in: ['IN_TRANSIT', 'OUT_FOR_DELIVERY', 'PICKED_UP'] } } });
    res.json({ shipments, total, page: parseInt(page) || 1, limit: take });
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/fulfillment/reports/rto
// ─────────────────────────────────────────────────────────────────────────────

router.get('/reports/rto', requireAuth, requireRole(Role.VENDOR), async (req, res, next) => {
  try {
    const vendor = await getVendor(req.user!.id);
    if (!vendor) return res.status(404).json({ error: 'Vendor profile not created' });

    const { page = '1', limit = '20', format } = req.query as Record<string, string>;
    const take = format === 'csv' ? 1000 : Math.min(parseInt(limit) || 20, 100);
    const skip = format === 'csv' ? 0 : (Math.max(parseInt(page) || 1, 1) - 1) * take;

    const shipments = await prisma.shipment.findMany({
      where: { vendorId: vendor.id, status: { in: ['RTO_INITIATED', 'RTO_DELIVERED'] } },
      include: {
        orderItem: {
          include: {
            product: { select: { name: true } },
            order: { select: { id: true, shippingAddress: true, createdAt: true, customer: { select: { name: true } } } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take,
      skip,
    });

    if (format === 'csv') {
      const rows = shipments.map((s) => {
        const addr = s.orderItem.order.shippingAddress as any;
        return [
          s.awb ?? '',
          s.carrierName,
          s.status,
          s.orderItem.order.customer.name,
          `${addr.city}, ${addr.state}`,
          s.orderItem.order.id,
          new Date(s.updatedAt).toLocaleDateString('en-IN'),
        ].join(',');
      });
      const csv = ['AWB,Carrier,Status,Customer,Destination,Order ID,RTO Date', ...rows].join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="rto-report.csv"');
      return res.send(csv);
    }

    const total = await prisma.shipment.count({ where: { vendorId: vendor.id, status: { in: ['RTO_INITIATED', 'RTO_DELIVERED'] } } });
    res.json({ shipments, total, page: parseInt(page) || 1, limit: take });
  } catch (e) { next(e); }
});

export default router;
