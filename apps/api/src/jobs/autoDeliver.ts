import { OrderStatus, ShipmentStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { isDbConnectionError } from '../lib/prisma-errors';

// Delivery confirmation policy:
//   • Tracked shipments (a Shipment row exists) are closed ONLY on a real
//     carrier/vendor DELIVERED (or COMPLETED) status — never on a blind timer.
//     Faking "delivered" after N days generates disputes and bad payouts.
//   • Untracked items (no Shipment row — manual / flat-rate fulfilment) have no
//     tracking signal to consult, so a longer time-based fallback is the only
//     available close mechanism.
//   • Tracked-but-silent shipments (dispatched long ago, still not marked
//     delivered) are HELD for ops review, not auto-closed.
const UNTRACKED_AUTO_DELIVER_AFTER_MS = 10 * 24 * 60 * 60 * 1000; // 10 days
const SCAN_INTERVAL_MS = 60 * 60 * 1000;                          // every 1 hour

const DELIVERED_STATUSES = [ShipmentStatus.DELIVERED, ShipmentStatus.COMPLETED];

export async function autoDeliverShippedItems(now: Date = new Date()): Promise<number> {
  // 1) Reconcile: the carrier/vendor confirmed delivery but the OrderItem wasn't
  //    synced (e.g. a future tracking-sync updated the Shipment directly). Close
  //    these on the real signal, regardless of elapsed time.
  const confirmed = await prisma.orderItem.updateMany({
    where: {
      status: OrderStatus.SHIPPED,
      shipment: { status: { in: DELIVERED_STATUSES } },
    },
    data: { status: OrderStatus.DELIVERED, deliveredAt: now },
  });

  // 2) Untracked fallback: no carrier shipment exists, so a timer is the only
  //    available signal. Close after the (longer) grace window.
  const untrackedCutoff = new Date(now.getTime() - UNTRACKED_AUTO_DELIVER_AFTER_MS);
  const untracked = await prisma.orderItem.updateMany({
    where: {
      status: OrderStatus.SHIPPED,
      dispatchedAt: { lt: untrackedCutoff },
      shipment: { is: null },
    },
    data: { status: OrderStatus.DELIVERED, deliveredAt: now },
  });

  // 3) Visibility: tracked shipments dispatched long ago but still not marked
  //    delivered are HELD (not auto-closed) and need ops attention.
  const held = await prisma.orderItem.count({
    where: {
      status: OrderStatus.SHIPPED,
      dispatchedAt: { lt: untrackedCutoff },
      shipment: { status: { notIn: DELIVERED_STATUSES } },
    },
  });
  if (held > 0) {
    console.warn(
      `[auto-deliver] ${held} tracked item(s) shipped >10d ago but not yet marked delivered — held for review, NOT auto-closed.`
    );
  }

  return confirmed.count + untracked.count;
}

let timer: ReturnType<typeof setInterval> | null = null;

export function startAutoDeliverJob() {
  if (timer) return;
  if (process.env.DISABLE_BACKGROUND_JOBS === 'true') return;

  const run = () => {
    autoDeliverShippedItems()
      .then((n) => { if (n > 0) console.log(`[auto-deliver] confirmed ${n} item(s) as delivered`); })
      .catch((e) => {
        if (isDbConnectionError(e)) {
          console.warn('[auto-deliver] skipped — database unreachable, will retry next tick');
        } else {
          console.error('[auto-deliver] failed:', e);
        }
      });
  };

  setTimeout(run, 60_000);
  timer = setInterval(run, SCAN_INTERVAL_MS);
}

export function stopAutoDeliverJob() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
