import { prisma } from '../lib/prisma';

const ABANDON_AFTER_MS = 60 * 60 * 1000; // 1 hour
const SCAN_INTERVAL_MS = 15 * 60 * 1000; // every 15 minutes

/**
 * Mark carts as abandoned when:
 *   - they have at least one item,
 *   - they haven't been touched for ABANDON_AFTER_MS,
 *   - abandonedAt is not already set.
 * Idempotent and safe to run repeatedly.
 */
export async function markAbandonedCarts(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - ABANDON_AFTER_MS);
  const result = await prisma.cart.updateMany({
    where: {
      abandonedAt: null,
      updatedAt: { lt: cutoff },
      items: { some: {} },
    },
    data: { abandonedAt: now },
  });
  return result.count;
}

let timer: ReturnType<typeof setInterval> | null = null;

export function startAbandonedCartJob() {
  if (timer) return;
  // Don't run during tests or when explicitly disabled.
  if (process.env.DISABLE_BACKGROUND_JOBS === 'true') return;

  const run = () => {
    markAbandonedCarts()
      .then((n) => { if (n > 0) console.log(`[abandoned-cart] marked ${n} cart(s)`); })
      .catch((e) => console.error('[abandoned-cart] failed:', e));
  };

  // Run once shortly after boot, then on interval.
  setTimeout(run, 30_000);
  timer = setInterval(run, SCAN_INTERVAL_MS);
}

export function stopAbandonedCartJob() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
