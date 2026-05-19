import { CouponScope, OrderStatus, Prisma } from '@prisma/client';
import { prisma } from './prisma';

export function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

export interface CouponCartItem {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export interface ResolveCouponInput {
  code: string;
  vendorId: string;
  cartItems: CouponCartItem[];
  subtotal: number;
  userId: string;
}

export interface ResolvedCoupon {
  couponId: string;
  code: string;
  scope: CouponScope;
  discount: number;
  eligibleSubtotal: number;
}

const SETTLED_STATUSES: OrderStatus[] = [
  OrderStatus.PAID,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
];

export async function resolveCoupon(input: ResolveCouponInput): Promise<ResolvedCoupon> {
  const code = normalizeCode(input.code);
  const coupon = await prisma.coupon.findUnique({
    where: { code },
    include: { products: { select: { id: true } } },
  });
  if (!coupon) throw new Error('Coupon code is invalid');
  if (!coupon.isActive) throw new Error('This coupon is no longer active');

  const now = new Date();
  if (coupon.startsAt && now < coupon.startsAt) throw new Error('Coupon is not yet active');
  if (coupon.expiresAt && now > coupon.expiresAt) throw new Error('Coupon has expired');

  if (coupon.vendorId !== input.vendorId) {
    throw new Error('Coupon is not valid for this shop');
  }

  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
    throw new Error('Coupon has reached its usage limit');
  }

  if (coupon.perUserLimit != null) {
    const used = await prisma.couponRedemption.count({
      where: {
        couponId: coupon.id,
        customerId: input.userId,
        order: { status: { in: SETTLED_STATUSES } },
      },
    });
    if (used >= coupon.perUserLimit) {
      throw new Error('You have already used this coupon');
    }
  }

  if (coupon.minOrderAmount != null && input.subtotal < Number(coupon.minOrderAmount)) {
    throw new Error(`Minimum order amount of ₹${Number(coupon.minOrderAmount).toLocaleString('en-IN')} required`);
  }

  let eligibleSubtotal: number;
  if (coupon.scope === CouponScope.PRODUCT) {
    const eligibleIds = new Set(coupon.products.map((p) => p.id));
    const matching = input.cartItems.filter((i) => eligibleIds.has(i.productId));
    if (matching.length === 0) throw new Error('Coupon does not apply to any items in your cart');
    eligibleSubtotal = matching.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  } else {
    eligibleSubtotal = input.subtotal;
  }

  const value = Number(coupon.value);
  let discount: number;
  if (coupon.discountType === 'PERCENT') {
    discount = (eligibleSubtotal * value) / 100;
    if (coupon.maxDiscount != null) {
      discount = Math.min(discount, Number(coupon.maxDiscount));
    }
  } else {
    discount = Math.min(value, eligibleSubtotal);
  }

  // Round to 2 decimal places (paise precision)
  discount = Math.round(discount * 100) / 100;

  return {
    couponId: coupon.id,
    code: coupon.code,
    scope: coupon.scope,
    discount,
    eligibleSubtotal,
  };
}

/**
 * Build prisma ops that record a coupon redemption and increment usedCount.
 * Callers should include these in the same transaction that finalizes the
 * order (e.g. /cod creation or /verify-payment success).
 */
export function couponRedemptionOps(args: {
  couponId: string;
  orderId: string;
  customerId: string;
  amount: number;
}) {
  return [
    prisma.couponRedemption.create({
      data: {
        couponId: args.couponId,
        orderId: args.orderId,
        customerId: args.customerId,
        amount: new Prisma.Decimal(args.amount),
      },
    }),
    prisma.coupon.update({
      where: { id: args.couponId },
      data: { usedCount: { increment: 1 } },
    }),
  ];
}
