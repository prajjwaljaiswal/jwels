import { TicketStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { isDbConnectionError } from '../lib/prisma-errors';

// Auto-close support tickets that have sat in RESOLVED with no further activity
// for the grace window. A customer reply before then auto-reopens the ticket
// (handled in the message route), so closing here only affects genuinely-settled
// threads. CLOSED is terminal; a new request must open a fresh ticket.
const AUTO_CLOSE_AFTER_MS = Number(process.env.SUPPORT_AUTO_CLOSE_DAYS || 7) * 24 * 60 * 60 * 1000;
const SCAN_INTERVAL_MS = 6 * 60 * 60 * 1000; // every 6 hours

export async function autoCloseResolvedTickets(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - AUTO_CLOSE_AFTER_MS);
  const res = await prisma.supportTicket.updateMany({
    where: { status: TicketStatus.RESOLVED, lastMessageAt: { lt: cutoff } },
    data: { status: TicketStatus.CLOSED, closedAt: now },
  });
  return res.count;
}

let timer: ReturnType<typeof setInterval> | null = null;

export function startSupportAutoCloseJob() {
  if (timer) return;
  if (process.env.DISABLE_BACKGROUND_JOBS === 'true') return;

  const run = () => {
    autoCloseResolvedTickets()
      .then((n) => { if (n > 0) console.log(`[support-autoclose] closed ${n} resolved ticket(s)`); })
      .catch((e) => {
        if (isDbConnectionError(e)) {
          console.warn('[support-autoclose] skipped — database unreachable, will retry next tick');
        } else {
          console.error('[support-autoclose] failed:', e);
        }
      });
  };

  setTimeout(run, 90_000);
  timer = setInterval(run, SCAN_INTERVAL_MS);
}

export function stopSupportAutoCloseJob() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
