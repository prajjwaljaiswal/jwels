import { prisma } from '../lib/prisma';
import { isDbConnectionError } from '../lib/prisma-errors';
import { sendAbandonedCartEmail } from '../lib/email';
import { sendWhatsApp } from '../lib/whatsapp';

const ABANDON_AFTER_MS = 60 * 60 * 1000; // 1 hour
const SCAN_INTERVAL_MS = 15 * 60 * 1000; // every 15 minutes

/**
 * Mark carts as abandoned when:
 *   - they have at least one item,
 *   - they haven't been touched for ABANDON_AFTER_MS,
 *   - abandonedAt is not already set.
 * For each newly-abandoned cart, send a one-time recovery email + WhatsApp nudge.
 * Idempotent: a cart is only processed once (abandonedAt gates re-sends).
 */
export async function markAbandonedCarts(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - ABANDON_AFTER_MS);
  // Select first (with user + item count) so we can notify, then mark.
  const carts = await prisma.cart.findMany({
    where: { abandonedAt: null, updatedAt: { lt: cutoff }, items: { some: {} } },
    select: { id: true, user: { select: { email: true, name: true, phone: true } }, _count: { select: { items: true } } },
    take: 200,
  });
  if (carts.length === 0) return 0;

  await prisma.cart.updateMany({
    where: { id: { in: carts.map((c) => c.id) } },
    data: { abandonedAt: now },
  });

  const storeUrl = process.env.WEB_ORIGIN || undefined;
  for (const c of carts) {
    const u = c.user;
    if (!u) continue;
    if (u.email) {
      sendAbandonedCartEmail(u.email, { customerName: u.name || 'there', itemCount: c._count.items, storeUrl: storeUrl ? `${storeUrl}/cart` : undefined })
        .catch((e) => console.warn('[abandoned-cart] email failed:', e?.message));
    }
    if (u.phone) {
      void sendWhatsApp(u.phone, `You left ${c._count.items} item(s) in your cart. Complete your order before they sell out!`);
    }
  }
  return carts.length;
}

let timer: ReturnType<typeof setInterval> | null = null;

export function startAbandonedCartJob() {
  if (timer) return;
  // Don't run during tests or when explicitly disabled.
  if (process.env.DISABLE_BACKGROUND_JOBS === 'true') return;

  const run = () => {
    markAbandonedCarts()
      .then((n) => { if (n > 0) console.log(`[abandoned-cart] marked ${n} cart(s)`); })
      .catch((e) => {
        if (isDbConnectionError(e)) {
          console.warn('[abandoned-cart] skipped — database unreachable, will retry next tick');
        } else {
          console.error('[abandoned-cart] failed:', e);
        }
      });
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
