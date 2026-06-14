import { OrderStatus, PayoutStatus } from '@prisma/client';
import { prisma } from './prisma';

// Vendor payout settlement.
//
// Model: every DELIVERED OrderItem that has not yet been attached to a
// PayoutItem is "settleable". A settlement run groups those items by vendor and
// creates one PENDING Payout per vendor (gross − platform commission = net).
// Refunds before settlement are excluded automatically (a refunded item is no
// longer DELIVERED). Payment is then recorded via markPayoutPaid — manually
// (admin enters the bank UTR) now, or via an automated rail later.
//
// The provider is pluggable: MANUAL records a UTR; RAZORPAYX is a stub that
// throws until RazorpayX credentials are configured, so automation is a config
// flip with no rework.

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function commissionRate(): number {
  return Number(process.env.PLATFORM_COMMISSION_PERCENT || 10) / 100;
}

export interface PayoutProvider {
  name: string;
  pay(input: { payoutId: string; vendorId: string; amount: number }): Promise<{ providerRef?: string; utr?: string }>;
}

const manualProvider: PayoutProvider = {
  name: 'MANUAL',
  async pay() {
    // Manual NEFT/UPI/bank transfer performed outside the system; the admin
    // records the UTR. No money movement happens here.
    return {};
  },
};

const razorpayXProvider: PayoutProvider = {
  name: 'RAZORPAYX',
  async pay() {
    if (!process.env.RAZORPAYX_KEY_ID || !process.env.RAZORPAYX_KEY_SECRET) {
      throw new Error('RazorpayX is not configured (set RAZORPAYX_KEY_ID / RAZORPAYX_KEY_SECRET). Use manual settlement for now.');
    }
    // TODO: integrate RazorpayX Payouts (fund account + payout). Stubbed until enabled.
    throw new Error('RazorpayX automated payouts are not implemented yet — use manual settlement.');
  },
};

export function getPayoutProvider(name?: string | null): PayoutProvider {
  return name === 'RAZORPAYX' ? razorpayXProvider : manualProvider;
}

/**
 * Settle all DELIVERED items not yet included in a payout. Creates one PENDING
 * Payout per vendor with its PayoutItems. Idempotent w.r.t. already-settled
 * items (they carry a PayoutItem and are skipped).
 */
export async function runSettlement(now: Date = new Date()) {
  const rate = commissionRate();
  const items = await prisma.orderItem.findMany({
    where: { status: OrderStatus.DELIVERED, payoutItem: { is: null } },
    select: { id: true, vendorId: true, priceAtPurchase: true, quantity: true, deliveredAt: true },
  });

  const byVendor = new Map<string, typeof items>();
  for (const it of items) {
    const arr = byVendor.get(it.vendorId);
    if (arr) arr.push(it);
    else byVendor.set(it.vendorId, [it]);
  }

  const created = [];
  for (const [vendorId, vItems] of byVendor) {
    let gross = 0;
    let periodStart = now;
    const payoutItems = vItems.map((it) => {
      const g = Number(it.priceAtPurchase) * it.quantity;
      gross += g;
      if (it.deliveredAt && it.deliveredAt < periodStart) periodStart = it.deliveredAt;
      return { orderItemId: it.id, gross: round2(g), commission: round2(g * rate), net: round2(g * (1 - rate)) };
    });
    const commission = round2(gross * rate);
    const net = round2(gross - commission);
    const payout = await prisma.payout.create({
      data: {
        vendorId,
        periodStart,
        periodEnd: now,
        grossAmount: round2(gross),
        commissionAmount: commission,
        refundAmount: 0,
        netAmount: net,
        status: PayoutStatus.PENDING,
        provider: 'MANUAL',
        items: { create: payoutItems },
      },
      include: { items: true },
    });
    created.push(payout);
  }
  return created;
}

/**
 * Record a payout as paid. With the MANUAL provider the admin supplies the bank
 * UTR; an automated provider would return its own reference.
 */
export async function markPayoutPaid(
  payoutId: string,
  opts: { processedBy: string; utr?: string; provider?: string; notes?: string }
) {
  const payout = await prisma.payout.findUnique({ where: { id: payoutId } });
  if (!payout) throw new Error('Payout not found');
  if (payout.status === PayoutStatus.PAID) return payout;

  const provider = getPayoutProvider(opts.provider ?? payout.provider);
  const result = await provider.pay({ payoutId: payout.id, vendorId: payout.vendorId, amount: Number(payout.netAmount) });

  return prisma.payout.update({
    where: { id: payout.id },
    data: {
      status: PayoutStatus.PAID,
      provider: provider.name,
      providerRef: result.providerRef ?? null,
      utr: opts.utr ?? result.utr ?? null,
      notes: opts.notes ?? payout.notes,
      processedAt: new Date(),
      processedBy: opts.processedBy,
    },
  });
}
