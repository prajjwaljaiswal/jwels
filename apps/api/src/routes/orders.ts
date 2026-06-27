import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { OrderStatus, PaymentProvider, Role, VendorPaymentMethod } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';
import { checkoutLimiter } from '../middleware/rateLimit';
import { razorpay, razorpayClient, verifyPaymentSignature } from '../lib/razorpay';
import { decryptJson } from '../lib/crypto';
import { priceSelection, isSystemDefaultMethodId, priceSystemDefault } from '../lib/shipping';
import { markItemShipped, markItemDelivered } from '../lib/fulfillmentSync';
import { resolveCoupon, couponRedemptionOps } from '../lib/coupon';
import { uploadBuffer } from '../lib/cloudinary';
import { confirmOrderPaid, notifyOrderConfirmation, notifyVendorsOfNewOrder } from '../lib/orderConfirm';
import { sendOrderCancelledEmail } from '../lib/email';
import { createInvoiceForOrder, generateInvoicePdf } from '../lib/invoice';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } });

/**
 * Resolve the authoritative gift-wrap fee from the vendor's published CHECKOUT
 * page block settings. Never trust a client-sent amount.
 */
async function resolveGiftWrapFee(vendorId: string): Promise<number> {
  try {
    const page = await prisma.vendorPage.findFirst({
      where: { vendorId, pageKind: 'CHECKOUT' as any, isPublished: true },
    });
    if (!page) return 0;
    const latest = await prisma.vendorPageVersion.findFirst({
      where: { pageId: page.id },
      orderBy: { versionNum: 'desc' },
    });
    const blocks = (latest?.blocks ?? []) as Array<{ type?: string; settings?: { price?: number } }>;
    const gw = blocks.find((b) => b?.type === 'checkoutGiftWrap');
    const price = Number(gw?.settings?.price ?? 0);
    return Number.isFinite(price) && price > 0 ? Math.min(price, 100000) : 0;
  } catch {
    return 0;
  }
}

interface RazorpayCreds { keyId: string; keySecret: string; webhookSecret?: string }

/**
 * Load and validate the vendor payment method referenced by `paymentMethodId`.
 * Verifies it belongs to `cartVendorId` (single-vendor cart enforced upstream)
 * and is active. Returns the row or throws with a user-safe error.
 */
async function loadVendorPaymentMethod(paymentMethodId: string, cartVendorId: string) {
  const method = await prisma.vendorPaymentMethod.findUnique({ where: { id: paymentMethodId } });
  if (!method) throw new Error('Payment method not found');
  if (method.vendorId !== cartVendorId) throw new Error('Payment method does not belong to this shop');
  if (!method.isActive) throw new Error('This payment method is no longer available');
  return method;
}

function razorpayCredsFor(method: VendorPaymentMethod): RazorpayCreds {
  if (!method.credentials) throw new Error('Vendor Razorpay credentials are missing');
  return decryptJson<RazorpayCreds>(method.credentials);
}

const router = Router();

const cartItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
  variationComboId: z.string().uuid().optional(),
});

/**
 * Look up & validate the variation combo for each line item.
 * Returns a Map keyed by productId+comboId with `{ price, label, stock }` when a
 * combo is selected, plus does the basic invariants (combo belongs to product,
 * stock >= quantity).
 */
async function resolveVariationCombos(
  items: { productId: string; quantity: number; variationComboId?: string }[]
) {
  const comboIds = items.map((i) => i.variationComboId).filter(Boolean) as string[];
  if (comboIds.length === 0) return new Map<string, { price: number | null; label: string; stock: number }>();

  const combos = await prisma.productVariationCombo.findMany({
    where: { id: { in: comboIds } },
    include: { product: { include: {
      variations: { include: { options: { orderBy: { position: 'asc' } } }, orderBy: { position: 'asc' } },
    }}},
  });

  const result = new Map<string, { price: number | null; label: string; stock: number }>();
  for (const item of items) {
    if (!item.variationComboId) continue;
    const combo = combos.find((c) => c.id === item.variationComboId);
    if (!combo) throw new Error('Selected variation no longer available');
    if (combo.productId !== item.productId) throw new Error('Variation does not belong to product');
    if (combo.stock < item.quantity) {
      throw new Error(`Only ${combo.stock} left of the selected variation`);
    }
    // Build label "Size: M · Metal: Gold" by walking variations in their saved order
    const labelParts: string[] = [];
    for (const v of combo.product.variations) {
      const matchedOpt = v.options.find((o) => combo.optionIds.includes(o.id));
      if (matchedOpt) labelParts.push(`${v.name}: ${matchedOpt.value}`);
    }
    result.set(`${item.productId}::${item.variationComboId}`, {
      price: combo.price !== null ? Number(combo.price) : null,
      label: labelParts.join(' · '),
      stock: combo.stock,
    });
  }
  return result;
}

const shippingSelectionSchema = z.object({
  vendorId: z.string().uuid(),
  // Either a real ShippingMethod UUID or a system-default sentinel (system-standard / system-express)
  methodId: z.string().min(1),
  serviceCode: z.string().optional().nullable(),
});

const checkoutSchema = z.object({
  items: z.array(cartItemSchema).min(1),
  shippingAddress: z.object({
    name: z.string().min(2),
    line1: z.string().min(2),
    line2: z.string().optional(),
    city: z.string().min(2),
    state: z.string().min(2),
    pincode: z.string().regex(/^\d{6}$/),
    phone: z.string().min(10),
  }),
  shippingSelections: z.array(shippingSelectionSchema).default([]),
  paymentMethodId: z.string().uuid().optional(),
  couponCode: z.string().min(1).optional(),
  giftWrap: z.boolean().default(false),
  giftMessage: z.string().max(500).optional(),
});

/**
 * Resolve & price every per-vendor shipping selection. Returns:
 *   - itemShipping: methodId/carrier/service/cost keyed by vendorId
 *   - shippingTotal: sum across all vendor groups
 *
 * Throws on any unselected vendor, unknown method, or live-rate failure.
 */
async function resolveShipping(
  vendorIds: string[],
  cartItems: { productId: string; quantity: number; unitPrice: number; vendorId: string }[],
  selections: z.infer<typeof shippingSelectionSchema>[],
  destination: { postalCode: string; state: string; country: string },
  paymentMode: 'PREPAID' | 'COD',
) {
  // Every vendor must have a selection
  const selectedFor = new Set(selections.map((s) => s.vendorId));
  const missing = vendorIds.filter((v) => !selectedFor.has(v));
  if (missing.length) {
    throw new Error(`Shipping option not selected for ${missing.length} vendor(s)`);
  }

  const realMethodIds = selections
    .filter((s) => !isSystemDefaultMethodId(s.methodId))
    .map((s) => s.methodId);
  const methods = realMethodIds.length
    ? await prisma.shippingMethod.findMany({
        where: { id: { in: realMethodIds }, isActive: true },
        include: { carrierAccount: true },
      })
    : [];
  const addresses = await prisma.vendorAddress.findMany({
    where: { vendorId: { in: vendorIds } },
    select: { vendorId: true, postalCode: true },
  });
  const addrMap = new Map(addresses.map((a) => [a.vendorId, { postalCode: a.postalCode }]));

  const byVendor = new Map<string, { methodId: string; carrier: string; service: string; cost: number }>();
  let total = 0;

  for (const sel of selections) {
    // System-default shipping (vendor has no methods configured)
    if (isSystemDefaultMethodId(sel.methodId)) {
      const sd = priceSystemDefault(sel.methodId);
      if (!sd) throw new Error('Unknown system shipping method');
      byVendor.set(sel.vendorId, {
        methodId: sel.methodId,
        carrier: sd.carrier,
        service: sd.service,
        cost: sd.amount,
      });
      total += sd.amount;
      continue;
    }

    const m = methods.find((mm) => mm.id === sel.methodId);
    if (!m || m.vendorId !== sel.vendorId) {
      throw new Error('Selected shipping method is not valid for vendor');
    }
    const groupItems = cartItems.filter((ci) => ci.vendorId === sel.vendorId);
    const priced = await priceSelection({
      method: m,
      vendorPickup: addrMap.get(sel.vendorId) ?? null,
      destination,
      items: groupItems,
      serviceCode: sel.serviceCode ?? null,
      paymentMode,
    });
    byVendor.set(sel.vendorId, {
      methodId: m.id,
      carrier: priced.carrier,
      service: priced.service,
      cost: priced.amount,
    });
    total += priced.amount;
  }

  return { byVendor, total };
}

/**
 * Step 1 of checkout — server-side: validate cart, lock prices, create DB order + Razorpay order.
 * Returns the Razorpay order id and key for the client to open Checkout.
 */
router.post('/checkout', checkoutLimiter, requireAuth, async (req, res) => {
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { items, shippingAddress, shippingSelections, paymentMethodId, couponCode, giftWrap, giftMessage } = parsed.data;

  // Re-fetch products to lock the price server-side (never trust client-sent prices)
  const products = await prisma.product.findMany({
    where: { id: { in: items.map((i) => i.productId) }, isActive: true },
    include: { vendor: true },
  });
  if (products.length !== items.length) {
    return res.status(400).json({ error: 'One or more products are unavailable' });
  }

  // Stock check
  for (const item of items) {
    const product = products.find((p) => p.id === item.productId)!;
    if (product.stockQuantity < item.quantity) {
      return res.status(400).json({ error: `Insufficient stock for "${product.name}"` });
    }
  }

  // Single-vendor cart constraint (Option A): all items must come from one vendor
  const vendorIds = Array.from(new Set(products.map((p) => p.vendorId)));
  if (vendorIds.length > 1) {
    return res.status(400).json({ error: 'Each checkout must contain items from a single shop only.' });
  }
  const cartVendorId = vendorIds[0];

  // Resolve variation combos (validates ownership + stock, returns price/label)
  let combosByKey: Awaited<ReturnType<typeof resolveVariationCombos>>;
  try {
    combosByKey = await resolveVariationCombos(items);
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }

  // Goods subtotal — combo price overrides product price when set
  const priceFor = (i: { productId: string; quantity: number; variationComboId?: string }) => {
    const product = products.find((p) => p.id === i.productId)!;
    const combo = i.variationComboId ? combosByKey.get(`${i.productId}::${i.variationComboId}`) : null;
    return combo?.price ?? Number(product.price);
  };
  const goodsRupees = items.reduce((sum, item) => sum + priceFor(item) * item.quantity, 0);

  // Coupon (optional) — re-resolve server-side using locked prices
  let coupon: Awaited<ReturnType<typeof resolveCoupon>> | null = null;
  if (couponCode) {
    try {
      coupon = await resolveCoupon({
        code: couponCode,
        vendorId: cartVendorId,
        cartItems: items.map((i) => ({ productId: i.productId, quantity: i.quantity, unitPrice: priceFor(i) })),
        subtotal: goodsRupees,
        userId: req.user!.id,
      });
    } catch (e: any) {
      return res.status(400).json({ error: e?.message || 'Coupon could not be applied' });
    }
  }

  // Resolve shipping (server-side recompute) per vendor
  const cartForShipping = items.map((i) => {
    const p = products.find((pp) => pp.id === i.productId)!;
    return { productId: p.id, vendorId: p.vendorId, quantity: i.quantity, unitPrice: Number(p.price) };
  });
  let shipping;
  try {
    shipping = await resolveShipping(
      vendorIds,
      cartForShipping,
      shippingSelections,
      { postalCode: shippingAddress.pincode, state: shippingAddress.state, country: 'IN' },
      'PREPAID',
    );
  } catch (e: any) {
    return res.status(400).json({ error: e?.message || 'Shipping selection invalid' });
  }

  const discount = coupon?.discount ?? 0;
  // Gift wrap (optional) — fee is resolved server-side from the vendor's block settings.
  const giftWrapFee = giftWrap ? await resolveGiftWrapFee(cartVendorId) : 0;
  const totalRupees = Math.max(0, goodsRupees + shipping.total - discount + giftWrapFee);
  const amountPaise = Math.round(totalRupees * 100);

  // Resolve payment method: vendor-specific if provided, else fall back to platform creds.
  let rzpClient = razorpay;
  let rzpKeyId = process.env.RAZORPAY_KEY_ID || '';
  let methodId: string | null = null;
  let methodSnapshot = 'RAZORPAY';

  if (paymentMethodId) {
    let method;
    try {
      method = await loadVendorPaymentMethod(paymentMethodId, cartVendorId);
    } catch (e: any) {
      return res.status(400).json({ error: e?.message || 'Invalid payment method' });
    }
    if (method.provider !== PaymentProvider.RAZORPAY) {
      return res.status(400).json({ error: 'This endpoint only handles Razorpay. Use /api/orders/manual for UPI/bank/COD.' });
    }
    let creds;
    try { creds = razorpayCredsFor(method); }
    catch (e: any) { return res.status(400).json({ error: e?.message ?? 'Vendor Razorpay not configured' }); }
    rzpClient = razorpayClient(creds);
    rzpKeyId = creds.keyId;
    methodId = method.id;
    methodSnapshot = `RAZORPAY:${method.label}`;
  }

  // Idempotency: if the client retries with the same key, return the existing
  // order instead of creating a duplicate Razorpay order + DB order.
  const idempotencyKey = req.header('Idempotency-Key') || null;
  if (idempotencyKey) {
    const existing = await prisma.order.findUnique({ where: { idempotencyKey } });
    if (existing) {
      if (existing.customerId !== req.user!.id) {
        return res.status(409).json({ error: 'Idempotency key already in use' });
      }
      return res.status(200).json({
        orderId: existing.id,
        razorpayOrderId: existing.razorpayOrderId,
        amount: Math.round(Number(existing.totalAmount) * 100),
        currency: 'INR',
        razorpayKeyId: rzpKeyId,
        shippingTotal: Number(existing.shippingTotal),
        goodsTotal: goodsRupees,
        discount: Number(existing.discountAmount),
        couponCode: existing.couponCode,
        idempotent: true,
      });
    }
  }

  // Create Razorpay order against the resolved client (vendor's account or platform fallback).
  let rzpOrder;
  try {
    rzpOrder = await rzpClient.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: `rcpt_${Date.now()}`,
    });
  } catch (err) {
    console.error('Razorpay order creation failed', err);
    return res.status(502).json({ error: 'Payment gateway error' });
  }

  // For each vendor, attach the full shipping cost to the FIRST item of that group
  // so SUM(OrderItem.shippingCost) === Order.shippingTotal without double-counting.
  const seenVendor = new Set<string>();

  // Create order in DB (PENDING until payment is verified)
  const order = await prisma.order.create({
    data: {
      customerId: req.user!.id,
      totalAmount: totalRupees,
      shippingTotal: shipping.total,
      shippingAddress,
      razorpayOrderId: rzpOrder.id,
      paymentMethod: methodSnapshot,
      paymentMethodId: methodId ?? undefined,
      couponId: coupon?.couponId ?? null,
      couponCode: coupon?.code ?? null,
      discountAmount: discount,
      giftWrap,
      giftMessage: giftMessage ?? null,
      giftWrapFee,
      idempotencyKey,
      status: OrderStatus.PENDING,
      items: {
        create: items.map((i) => {
          const product = products.find((p) => p.id === i.productId)!;
          const ship = shipping.byVendor.get(product.vendorId)!;
          const isFirstForVendor = !seenVendor.has(product.vendorId);
          if (isFirstForVendor) seenVendor.add(product.vendorId);
          const combo = i.variationComboId ? combosByKey.get(`${i.productId}::${i.variationComboId}`) : null;
          return {
            productId: product.id,
            vendorId: product.vendorId,
            quantity: i.quantity,
            priceAtPurchase: combo?.price ?? product.price,
            status: OrderStatus.PENDING,
            shippingMethodId: ship.methodId,
            shippingCarrier: ship.carrier,
            shippingService: ship.service,
            shippingCost: isFirstForVendor ? ship.cost : 0,
            variationComboId: i.variationComboId,
            variationLabel:   combo?.label,
          };
        }),
      },
    },
    include: { items: true },
  });

  res.status(201).json({
    orderId: order.id,
    razorpayOrderId: rzpOrder.id,
    amount: amountPaise,
    currency: 'INR',
    razorpayKeyId: rzpKeyId,
    shippingTotal: shipping.total,
    goodsTotal: goodsRupees,
    discount,
    couponCode: coupon?.code ?? null,
  });
});

/**
 * Off-gateway checkout: COD, UPI manual, or bank transfer. Payment isn't captured
 * through Razorpay; the order is created PENDING and the customer settles later
 * (cash on delivery, UPI to vendor's VPA, or wire transfer).
 */
router.post('/cod', checkoutLimiter, requireAuth, async (req, res) => {
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { items, shippingAddress, shippingSelections, paymentMethodId, couponCode, giftWrap, giftMessage } = parsed.data;

  const products = await prisma.product.findMany({
    where: { id: { in: items.map((i) => i.productId) }, isActive: true },
    include: { vendor: true },
  });
  if (products.length !== items.length) {
    return res.status(400).json({ error: 'One or more products are unavailable' });
  }

  for (const item of items) {
    const product = products.find((p) => p.id === item.productId)!;
    if (product.stockQuantity < item.quantity) {
      return res.status(400).json({ error: `Insufficient stock for "${product.name}"` });
    }
  }

  // Single-vendor cart enforced
  const vendorIds = Array.from(new Set(products.map((p) => p.vendorId)));
  if (vendorIds.length > 1) {
    return res.status(400).json({ error: 'Each checkout must contain items from a single shop only.' });
  }
  const cartVendorId = vendorIds[0];

  // Resolve the chosen off-gateway payment method.
  let methodSnapshot = 'COD';
  let methodId: string | null = null;
  let publicConfig: unknown = null;

  if (paymentMethodId) {
    let method;
    try {
      method = await loadVendorPaymentMethod(paymentMethodId, cartVendorId);
    } catch (e: any) {
      return res.status(400).json({ error: e?.message || 'Invalid payment method' });
    }
    if (method.provider === PaymentProvider.RAZORPAY) {
      return res.status(400).json({ error: 'Use /api/orders/checkout for Razorpay payments.' });
    }
    methodId = method.id;
    methodSnapshot = `${method.provider}:${method.label}`;
    publicConfig = method.publicConfig;
  } else {
    // Legacy fallback: platform-wide COD toggle (no per-vendor method selected).
    const codSetting = await prisma.setting.findUnique({ where: { key: 'cod_enabled' } });
    if (codSetting?.value !== 'true') {
      return res.status(400).json({ error: 'Cash on Delivery is not available at the moment.' });
    }
  }

  let codCombosByKey: Awaited<ReturnType<typeof resolveVariationCombos>>;
  try {
    codCombosByKey = await resolveVariationCombos(items);
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }
  const codPriceFor = (i: { productId: string; quantity: number; variationComboId?: string }) => {
    const product = products.find((p) => p.id === i.productId)!;
    const combo = i.variationComboId ? codCombosByKey.get(`${i.productId}::${i.variationComboId}`) : null;
    return combo?.price ?? Number(product.price);
  };
  const goodsRupees = items.reduce((sum, item) => sum + codPriceFor(item) * item.quantity, 0);

  // Coupon (optional)
  let codCoupon: Awaited<ReturnType<typeof resolveCoupon>> | null = null;
  if (couponCode) {
    try {
      codCoupon = await resolveCoupon({
        code: couponCode,
        vendorId: cartVendorId,
        cartItems: items.map((i) => ({ productId: i.productId, quantity: i.quantity, unitPrice: codPriceFor(i) })),
        subtotal: goodsRupees,
        userId: req.user!.id,
      });
    } catch (e: any) {
      return res.status(400).json({ error: e?.message || 'Coupon could not be applied' });
    }
  }

  const cartForShipping = items.map((i) => {
    const p = products.find((pp) => pp.id === i.productId)!;
    return { productId: p.id, vendorId: p.vendorId, quantity: i.quantity, unitPrice: Number(p.price) };
  });
  let shipping;
  try {
    shipping = await resolveShipping(
      vendorIds,
      cartForShipping,
      shippingSelections,
      { postalCode: shippingAddress.pincode, state: shippingAddress.state, country: 'IN' },
      'COD',
    );
  } catch (e: any) {
    return res.status(400).json({ error: e?.message || 'Shipping selection invalid' });
  }

  const codDiscount = codCoupon?.discount ?? 0;
  const codGiftWrapFee = giftWrap ? await resolveGiftWrapFee(cartVendorId) : 0;
  const totalRupees = Math.max(0, goodsRupees + shipping.total - codDiscount + codGiftWrapFee);
  const seenVendor = new Set<string>();

  const order = await prisma.order.create({
    data: {
      customerId: req.user!.id,
      totalAmount: totalRupees,
      shippingTotal: shipping.total,
      paymentMethod: methodSnapshot,
      paymentMethodId: methodId ?? undefined,
      couponId: codCoupon?.couponId ?? null,
      couponCode: codCoupon?.code ?? null,
      discountAmount: codDiscount,
      giftWrap,
      giftMessage: giftMessage ?? null,
      giftWrapFee: codGiftWrapFee,
      shippingAddress,
      status: OrderStatus.PENDING,
      items: {
        create: items.map((i) => {
          const product = products.find((p) => p.id === i.productId)!;
          const ship = shipping.byVendor.get(product.vendorId)!;
          const isFirstForVendor = !seenVendor.has(product.vendorId);
          if (isFirstForVendor) seenVendor.add(product.vendorId);
          const combo = i.variationComboId ? codCombosByKey.get(`${i.productId}::${i.variationComboId}`) : null;
          return {
            productId: product.id,
            vendorId: product.vendorId,
            quantity: i.quantity,
            priceAtPurchase: combo?.price ?? product.price,
            status: OrderStatus.PENDING,
            shippingMethodId: ship.methodId,
            shippingCarrier: ship.carrier,
            shippingService: ship.service,
            shippingCost: isFirstForVendor ? ship.cost : 0,
            variationComboId: i.variationComboId,
            variationLabel:   combo?.label,
          };
        }),
      },
    },
  });

  // Decrement combo stock when applicable; falls back to product stock
  await Promise.all(
    items
      .filter((i) => i.variationComboId)
      .map((i) =>
        prisma.productVariationCombo.update({
          where: { id: i.variationComboId! },
          data: { stock: { decrement: i.quantity } },
        })
      )
  );

  // Coupon redemption — for COD we record at order creation (no separate verify step)
  if (codCoupon) {
    await prisma.$transaction(
      couponRedemptionOps({
        couponId: codCoupon.couponId,
        orderId: order.id,
        customerId: req.user!.id,
        amount: codDiscount,
      })
    );
  }

  // Decrement stock
  await Promise.all(
    items.map((i) =>
      prisma.product.update({
        where: { id: i.productId },
        data: { stockQuantity: { decrement: i.quantity } },
      })
    )
  );

  // Generate the tax invoice + send confirmation (best-effort, non-blocking).
  createInvoiceForOrder(order.id).catch((e) => console.warn('[invoice] COD generation failed:', e?.message));
  void notifyOrderConfirmation(order.id);
  void notifyVendorsOfNewOrder(order.id);

  // For UPI/bank, return the public payout details so the customer can pay manually.
  res.status(201).json({ orderId: order.id, paymentInstructions: publicConfig });
});

const verifySchema = z.object({
  orderId: z.string().uuid(),
  razorpayOrderId: z.string(),
  razorpayPaymentId: z.string(),
  razorpaySignature: z.string(),
});

/**
 * Step 2 — client posts the Razorpay response here. Verify signature, mark order PAID,
 * decrement stock, and set per-item status to PAID.
 */
router.post('/verify-payment', checkoutLimiter, requireAuth, async (req, res) => {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = parsed.data;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, paymentMethodRef: true },
  });
  if (!order || order.customerId !== req.user!.id) {
    return res.status(404).json({ error: 'Order not found' });
  }
  if (order.razorpayOrderId !== razorpayOrderId) {
    return res.status(400).json({ error: 'Order mismatch' });
  }

  // Verify against the right secret: vendor's key_secret if the order used a vendor method,
  // otherwise the platform RAZORPAY_KEY_SECRET fallback.
  let secret: string | undefined;
  if (order.paymentMethodRef?.credentials) {
    try {
      const creds = decryptJson<RazorpayCreds>(order.paymentMethodRef.credentials);
      secret = creds.keySecret;
    } catch {
      return res.status(500).json({ error: 'Failed to load vendor payment credentials' });
    }
  }
  const ok = verifyPaymentSignature({ razorpayOrderId, razorpayPaymentId, razorpaySignature, secret });
  if (!ok) return res.status(400).json({ error: 'Invalid payment signature' });

  // Atomically confirm PAID exactly once (shared with the Razorpay webhook) —
  // decrements stock, redeems coupon, generates the invoice, and emails the buyer.
  const result = await confirmOrderPaid({ orderId: order.id, razorpayPaymentId });
  res.json({ success: true, orderId: order.id, alreadyProcessed: result.alreadyProcessed });
});

// Customer: single order detail
router.get('/me/:id', requireAuth, async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: {
      items: {
        include: {
          product: { select: { id: true, name: true, images: true } },
          vendor: { select: { id: true, shopName: true } },
        },
      },
    },
  });
  if (!order || order.customerId !== req.user!.id) {
    return res.status(404).json({ error: 'Order not found' });
  }
  res.json(order);
});

// Customer: download the GST invoice PDF for an own order
router.get('/me/:id/invoice', requireAuth, async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      select: { id: true, customerId: true, status: true },
    });
    if (!order || order.customerId !== req.user!.id) {
      return res.status(404).json({ error: 'Order not found' });
    }
    let invoice = await prisma.invoice.findUnique({ where: { orderId: order.id } });
    if (!invoice) {
      // Only invoice orders that have actually been paid/fulfilled.
      if (!['PAID', 'SHIPPED', 'DELIVERED'].includes(order.status)) {
        return res.status(404).json({ error: 'Invoice not yet available for this order' });
      }
      invoice = await createInvoiceForOrder(order.id);
    }
    if (!invoice) return res.status(404).json({ error: 'Invoice not available' });
    const pdf = await generateInvoicePdf(invoice);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="invoice-${invoice.invoiceNumber.replace(/\//g, '-')}.pdf"`);
    res.send(pdf);
  } catch (e) { next(e); }
});

// Customer: list own orders
router.get('/me', requireAuth, async (req, res) => {
  const orders = await prisma.order.findMany({
    where: { customerId: req.user!.id },
    orderBy: { createdAt: 'desc' },
    include: {
      items: {
        include: {
          product: { select: { name: true, images: true } },
          vendor: { select: { shopName: true } },
        },
      },
    },
  });
  res.json(orders);
});

// Vendor updates per-item status (e.g. SHIPPED, DELIVERED)
const itemStatusSchema = z.object({
  status: z.enum(['SHIPPED', 'DELIVERED', 'CANCELLED']),
  // Dispatch details — accepted when status = SHIPPED
  trackingNumber: z.string().min(1).optional(),
  courierName: z.string().min(1).optional(),
  trackingUrl: z.string().url().optional(),
  waybillUrl: z.string().url().optional(),
});

router.patch(
  '/items/:itemId/status',
  requireAuth,
  requireRole(Role.VENDOR),
  async (req, res) => {
    const parsed = itemStatusSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const vendor = await prisma.vendor.findUnique({ where: { userId: req.user!.id } });
    if (!vendor) return res.status(404).json({ error: 'Vendor profile not created' });

    const item = await prisma.orderItem.findUnique({ where: { id: req.params.itemId } });
    if (!item || item.vendorId !== vendor.id) {
      return res.status(404).json({ error: 'Order item not found' });
    }

    const { status, trackingNumber, courierName, trackingUrl, waybillUrl } = parsed.data;

    // Funnel SHIPPED/DELIVERED through the shared transition helpers so the
    // customer notification fires and any linked Shipment stays in sync —
    // regardless of which dispatch entry point the vendor used.
    if (status === 'SHIPPED') {
      await markItemShipped(item.id, { trackingNumber, courierName, trackingUrl, waybillUrl });
    } else if (status === 'DELIVERED') {
      await markItemDelivered(item.id);
    } else {
      await prisma.orderItem.update({ where: { id: item.id }, data: { status: status as OrderStatus } });
    }

    const updated = await prisma.orderItem.findUnique({ where: { id: item.id } });
    res.json(updated);

    // Customer notice when a vendor cancels an item (best-effort, post-response).
    if (status === 'CANCELLED') {
      void (async () => {
        try {
          const full = await prisma.orderItem.findUnique({
            where: { id: item.id },
            select: { order: { select: { id: true, customer: { select: { email: true, name: true } } } } },
          });
          const email = full?.order.customer?.email;
          if (email) {
            await sendOrderCancelledEmail(email, {
              orderId: full.order.id,
              customerName: full.order.customer?.name || 'there',
            });
          }
        } catch (e: any) {
          console.warn('[email] cancellation notification failed:', e?.message);
        }
      })();
    }
  }
);

// Vendor uploads a waybill document for an order item
router.post(
  '/items/:itemId/waybill',
  requireAuth,
  requireRole(Role.VENDOR),
  upload.single('waybill'),
  async (req, res) => {
    const vendor = await prisma.vendor.findUnique({ where: { userId: req.user!.id } });
    if (!vendor) return res.status(404).json({ error: 'Vendor profile not created' });

    const item = await prisma.orderItem.findUnique({ where: { id: req.params.itemId } });
    if (!item || item.vendorId !== vendor.id) {
      return res.status(404).json({ error: 'Order item not found' });
    }

    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    const url = await uploadBuffer(file.buffer, 'waybills');
    res.json({ url });
  }
);

export default router;
