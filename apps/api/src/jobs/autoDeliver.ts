import { OrderStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';

const AUTO_DELIVER_AFTER_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const SCAN_INTERVAL_MS = 60 * 60 * 1000;               // every 1 hour

export async function autoDeliverShippedItems(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - AUTO_DELIVER_AFTER_MS);
  const result = await prisma.orderItem.updateMany({
    where: {
      status: OrderStatus.SHIPPED,
      dispatchedAt: { lt: cutoff },
    },
    data: {
      status: OrderStatus.DELIVERED,
      deliveredAt: now,
    },
  });

  // Also advance any Shipment records that are still in-transit past the cutoff
  if (result.count > 0) {
    await prisma.shipment.updateMany({
      where: {
        status: { in: ['IN_TRANSIT', 'OUT_FOR_DELIVERY', 'PICKED_UP'] as any },
        updatedAt: { lt: cutoff },
        orderItem: { dispatchedAt: { lt: cutoff } },
      },
      data: { status: 'DELIVERED' as any },
    });
  }

  return result.count;
}

let timer: ReturnType<typeof setInterval> | null = null;

export function startAutoDeliverJob() {
  if (timer) return;
  if (process.env.DISABLE_BACKGROUND_JOBS === 'true') return;

  const run = () => {
    autoDeliverShippedItems()
      .then((n) => { if (n > 0) console.log(`[auto-deliver] marked ${n} item(s) as delivered`); })
      .catch((e) => console.error('[auto-deliver] failed:', e));
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
