import { runSettlement } from '../lib/payouts';
import { isDbConnectionError } from '../lib/prisma-errors';

// Weekly vendor settlement sweep: creates PENDING payouts for all DELIVERED
// items not yet settled. Admins then mark them paid (manual UTR) or, once a
// rail is enabled, execute them automatically.
const SCAN_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // weekly
const FIRST_RUN_DELAY_MS = 5 * 60 * 1000;         // 5 min after boot

let timer: ReturnType<typeof setInterval> | null = null;

export function startSettlementJob() {
  if (timer) return;
  if (process.env.DISABLE_BACKGROUND_JOBS === 'true') return;

  const run = () => {
    runSettlement()
      .then((created) => { if (created.length > 0) console.log(`[settlement] created ${created.length} payout(s)`); })
      .catch((e) => {
        if (isDbConnectionError(e)) console.warn('[settlement] skipped — database unreachable, will retry next tick');
        else console.error('[settlement] failed:', e);
      });
  };

  setTimeout(run, FIRST_RUN_DELAY_MS);
  timer = setInterval(run, SCAN_INTERVAL_MS);
}

export function stopSettlementJob() {
  if (timer) { clearInterval(timer); timer = null; }
}
