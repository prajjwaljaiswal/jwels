import { VendorStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { isDbConnectionError } from '../lib/prisma-errors';
import { syncVendorCatalog, type MarketingCaller } from '../lib/marketing/service';
import { isGoogleMerchantConfigured } from '../lib/marketing/googleMerchant';

// Catalog reconcile cadence. Google effectively allows ~2 product updates/day per offer,
// so a few hours between full reconciles is plenty; on-demand `POST /sync` covers urgency.
const SCAN_INTERVAL_MS = 6 * 60 * 60 * 1000; // every 6 hours
const INITIAL_DELAY_MS = 60_000; // 1 min after boot

// Background jobs have no human actor. onBehalf=false means no audit row is written
// (AuditLog.actorId is a FK to a real User — see service.auditOnBehalf).
const SYSTEM_CALLER: MarketingCaller = { actorId: 'system:catalogSync', actorRole: 'SYSTEM', onBehalf: false };

export interface CatalogSyncSummary {
  vendors: number;
  ready: number;
  pushed: number;
  pushFailed: number;
  errored: number;
}

/**
 * Reconcile (and, when Google Merchant is configured, push) every approved vendor's
 * catalog. Sequential per vendor to keep provider load gentle and bounded. Idempotent:
 * re-running simply re-asserts ProductFeedState. Per-vendor failures are logged and skipped
 * so one bad vendor never blocks the rest.
 */
export async function reconcileAllVendors(): Promise<CatalogSyncSummary> {
  const vendors = await prisma.vendor.findMany({
    where: { status: VendorStatus.APPROVED },
    select: { id: true },
  });

  const summary: CatalogSyncSummary = { vendors: 0, ready: 0, pushed: 0, pushFailed: 0, errored: 0 };
  for (const v of vendors) {
    try {
      const r = await syncVendorCatalog(v.id, SYSTEM_CALLER);
      summary.vendors++;
      summary.ready += r.ready;
      summary.pushed += r.pushed;
      summary.pushFailed += r.pushFailed;
      summary.errored += r.errored;
    } catch (e: any) {
      if (isDbConnectionError(e)) throw e; // let the caller treat DB drops as transient
      console.error(`[catalog-sync] vendor ${v.id} failed:`, e?.message ?? e);
    }
  }
  return summary;
}

let timer: ReturnType<typeof setInterval> | null = null;

export function startCatalogSyncJob() {
  if (timer) return;
  if (process.env.DISABLE_BACKGROUND_JOBS === 'true') return;

  const run = () => {
    reconcileAllVendors()
      .then((s) => {
        const tail = isGoogleMerchantConfigured()
          ? `pushed ${s.pushed}, pushFailed ${s.pushFailed}`
          : 'push skipped (Google Merchant not configured)';
        if (s.vendors > 0) {
          console.log(`[catalog-sync] reconciled ${s.vendors} vendor(s): ready ${s.ready}, errored ${s.errored}, ${tail}`);
        }
      })
      .catch((e) => {
        if (isDbConnectionError(e)) {
          console.warn('[catalog-sync] skipped — database unreachable, will retry next tick');
        } else {
          console.error('[catalog-sync] failed:', e);
        }
      });
  };

  setTimeout(run, INITIAL_DELAY_MS);
  timer = setInterval(run, SCAN_INTERVAL_MS);
}

export function stopCatalogSyncJob() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
