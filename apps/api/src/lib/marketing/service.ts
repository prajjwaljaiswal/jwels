/**
 * Marketing service layer — the SINGLE implementation of every vendor marketing
 * capability (docs/marketing-integration-plan.md §7A.1). Both route surfaces call these:
 *   - vendor self-serve  (/api/marketing/*)        → caller.actorRole = 'VENDOR', onBehalf = false
 *   - admin operator     (/api/admin/marketing/*)  → caller.actorRole = 'ADMIN',  onBehalf = true
 *
 * Functions take an EXPLICIT vendorId plus a caller context — they never read identity
 * from globals. The route layer is responsible for resolving & authorizing the vendorId
 * (vendor: from req.user; admin: from the path, behind a permission guard). This layer is
 * the only place that mutates MarketingConnection / ProductFeedState and the only place
 * that writes audit rows, so the two callers behave identically and stay auditable.
 */
import { Prisma, MarketingPlatform, FeedItemStatus, FeedCondition, AvailabilityStatus } from '@prisma/client';
import { prisma } from '../prisma';
import { audit } from '../audit';
import { buildFeedDataset, resolvePrice } from './feed';
import { isGoogleMerchantConfigured, pushItems } from './googleMerchant';

export type MarketingActorRole = 'VENDOR' | 'ADMIN' | 'SYSTEM';

export interface MarketingCaller {
  actorId: string; // req.user.id, or a system sentinel for jobs
  actorRole: MarketingActorRole;
  onBehalf: boolean; // true when an ADMIN acts for a vendor
}

/** Thrown by capabilities whose provider integration lands in a later step/phase. */
export class MarketingNotImplementedError extends Error {
  code = 'NOT_IMPLEMENTED';
  constructor(message: string) {
    super(message);
    this.name = 'MarketingNotImplementedError';
  }
}

/**
 * Write an audit row for an on-behalf (admin) action. Vendor self-serve mutations are
 * intentionally NOT audited in Phase 1 (consistent with the codebase auditing admin
 * actions only — §7A.4); flip this when self-serve auditing is wanted. SYSTEM callers are
 * skipped because AuditLog.actorId is a FK to a real User (a seeded system user is the
 * follow-up for job-triggered audit rows).
 *
 * Note: audit() is fire-and-forget (it swallows write failures and logs them) — the same
 * best-effort pattern used across the codebase (admin.ts, rbac.ts). So in the rare case the
 * audit insert itself fails, the mutation still commits without a durable audit row. If
 * strict atomicity is later required for marketing, write the audit row inside the same
 * $transaction as the mutation.
 */
async function auditOnBehalf(
  caller: MarketingCaller,
  action: string,
  vendorId: string,
  metadata: Record<string, unknown>,
) {
  if (!caller.onBehalf || caller.actorRole !== 'ADMIN') return;
  await audit(caller.actorId, action, vendorId, { ...metadata, isAdminAction: true });
}

// ---------------------------------------------------------------------------
// Status — masked connections + feed-state health. Safe for both callers.
// ---------------------------------------------------------------------------

export interface MarketingStatus {
  vendorId: string;
  connections: Array<{
    platform: MarketingPlatform;
    mode: string;
    status: string;
    managedByPlatform: boolean;
    connectedByAdmin: boolean;
    hasCredentials: boolean;
    publicConfig: Prisma.JsonValue | null;
    lastVerifiedAt: Date | null;
  }>;
  feed: {
    eligible: number; // products that build cleanly and would sync
    errored: number; // products with blocking field problems
    byState: Record<string, number>; // persisted ProductFeedState counts
  };
}

export async function getMarketingStatus(vendorId: string, _caller: MarketingCaller): Promise<MarketingStatus> {
  const [connections, dataset, stateGroups] = await Promise.all([
    prisma.marketingConnection.findMany({ where: { vendorId } }),
    buildFeedDataset({ vendorId }),
    prisma.productFeedState.groupBy({
      by: ['status'],
      where: { vendorId },
      _count: { _all: true },
    }),
  ]);

  const byState: Record<string, number> = {};
  for (const g of stateGroups) byState[g.status] = g._count._all;

  // Distinct source products represented in the live dataset (variant rows collapse to parent).
  const eligibleProducts = new Set(dataset.items.map((i) => i.itemGroupId ?? i.id)).size;

  return {
    vendorId,
    connections: connections.map((c) => ({
      platform: c.platform,
      mode: c.mode,
      status: c.status,
      managedByPlatform: c.managedByPlatform,
      connectedByAdmin: Boolean(c.connectedByAdminId),
      hasCredentials: Boolean(c.credentials),
      publicConfig: c.publicConfig ?? null,
      lastVerifiedAt: c.lastVerifiedAt,
    })),
    feed: {
      eligible: eligibleProducts,
      errored: dataset.errors.length,
      byState,
    },
  };
}

// ---------------------------------------------------------------------------
// Feed fields — vendor or admin edits a product's shopping-feed attributes.
// ---------------------------------------------------------------------------

export interface FeedFieldsInput {
  gtin?: string | null;
  mpn?: string | null;
  googleProductCategory?: string | null;
  feedCondition?: FeedCondition;
  availabilityStatus?: AvailabilityStatus | null;
  feedExcluded?: boolean;
}

const FEED_FIELD_KEYS: (keyof FeedFieldsInput)[] = [
  'gtin',
  'mpn',
  'googleProductCategory',
  'feedCondition',
  'availabilityStatus',
  'feedExcluded',
];

/**
 * Update a product's feed attributes. Verifies the product belongs to the vendor
 * (the IDOR guard for admin-supplied ids too) before mutating, and audits on-behalf edits
 * with a { before, after } diff.
 */
export async function setProductFeedFields(
  vendorId: string,
  productId: string,
  fields: FeedFieldsInput,
  caller: MarketingCaller,
) {
  const product = await prisma.product.findFirst({
    where: { id: productId, vendorId },
    select: {
      id: true,
      gtin: true,
      mpn: true,
      googleProductCategory: true,
      feedCondition: true,
      availabilityStatus: true,
      feedExcluded: true,
    },
  });
  if (!product) {
    const err = new Error('Product not found for this vendor');
    (err as any).status = 404;
    throw err;
  }

  const data: Prisma.ProductUpdateInput = {};
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};
  for (const key of FEED_FIELD_KEYS) {
    if (fields[key] === undefined) continue;
    (data as any)[key] = fields[key];
    before[key] = (product as any)[key];
    after[key] = fields[key];
  }

  if (Object.keys(data).length === 0) return product;

  const updated = await prisma.product.update({
    where: { id: productId },
    data,
    select: {
      id: true,
      gtin: true,
      mpn: true,
      googleProductCategory: true,
      feedCondition: true,
      availabilityStatus: true,
      feedExcluded: true,
    },
  });

  await auditOnBehalf(caller, 'marketing.feed.fieldsChanged', vendorId, { productId, before, after });
  return updated;
}

// ---------------------------------------------------------------------------
// Reconcile feed states — recompute per-product catalog health from the live data.
// This is the basis of forceSync; the actual provider push (Merchant API products.insert
// / Meta items_batch) lands with googleMerchant.ts / metaCatalog.ts in the next step, and
// will flip PENDING → SYNCED and stamp lastSyncedAt. Until then states reflect readiness.
// ---------------------------------------------------------------------------

export interface ReconcileResult {
  vendorId: string;
  platform: MarketingPlatform;
  ready: number; // valid products marked PENDING (ready to push)
  errored: number; // products with blocking problems marked ERROR
  excluded: number; // products opted out / ineligible marked EXCLUDED
  pushed: number; // products successfully pushed to the provider → SYNCED
  pushFailed: number; // products that failed the provider push → ERROR
  pushSkipped: string | null; // reason the push did not run (e.g. provider not configured)
}

export async function syncVendorCatalog(
  vendorId: string,
  caller: MarketingCaller,
  platform: MarketingPlatform = MarketingPlatform.GOOGLE,
): Promise<ReconcileResult> {
  const dataset = await buildFeedDataset({ vendorId });

  // Source-product → first built item (for drift baseline) and error reasons.
  const builtByProduct = new Map<string, { price: string; availability: string }>();
  for (const item of dataset.items) {
    const pid = item.itemGroupId ?? item.id;
    if (!builtByProduct.has(pid)) builtByProduct.set(pid, { price: item.price, availability: item.availability });
  }
  const errorByProduct = new Map<string, string>();
  for (const e of dataset.errors) errorByProduct.set(e.productId, e.reasons.join('; '));

  // Vendor products that are explicitly opted out of the feed.
  const excludedProducts = await prisma.product.findMany({
    where: { vendorId, feedExcluded: true },
    select: { id: true },
  });

  type FeedStateExtra = {
    lastPrice?: Prisma.Decimal | null;
    lastAvailable?: string | null;
    errorMessage?: string | null;
    lastSyncedAt?: Date | null;
    externalItemId?: string | null;
  };
  const ops: Prisma.PrismaPromise<unknown>[] = [];
  const upsert = (productId: string, status: FeedItemStatus, extra: FeedStateExtra = {}) =>
    prisma.productFeedState.upsert({
      where: { productId_platform: { productId, platform } },
      create: { productId, vendorId, platform, status, ...extra },
      update: { status, ...extra },
    });

  for (const [productId, vals] of builtByProduct) {
    ops.push(
      upsert(productId, FeedItemStatus.PENDING, {
        lastPrice: new Prisma.Decimal(vals.price.split(' ')[0]),
        lastAvailable: vals.availability,
        errorMessage: null,
      }),
    );
  }
  for (const [productId, reasons] of errorByProduct) {
    ops.push(upsert(productId, FeedItemStatus.ERROR, { errorMessage: reasons }));
  }
  for (const p of excludedProducts) {
    ops.push(upsert(p.id, FeedItemStatus.EXCLUDED, { errorMessage: null }));
  }

  await prisma.$transaction(ops);

  // Provider push — Phase 1 ships Google Merchant (Merchant API v1). When configured,
  // push the built items and flip product states PENDING → SYNCED / ERROR. When not
  // configured (e.g. dev, or no service account), states remain PENDING and we report why.
  let pushed = 0;
  let pushFailed = 0;
  let pushSkipped: string | null = null;

  if (platform === MarketingPlatform.GOOGLE && dataset.items.length > 0) {
    if (!isGoogleMerchantConfigured()) {
      pushSkipped = 'google_merchant_not_configured';
    } else {
      try {
        const results = await pushItems(dataset.items);

        // Aggregate per source product (a product may emit several variant offers):
        // SYNCED only if all its offers succeeded; otherwise ERROR with the first reason.
        const offerToProduct = new Map<string, string>();
        for (const it of dataset.items) offerToProduct.set(it.id, it.itemGroupId ?? it.id);

        const byProduct = new Map<string, { ok: boolean; error?: string; resourceName?: string }>();
        for (const r of results) {
          const pid = offerToProduct.get(r.offerId);
          if (!pid) continue;
          const cur = byProduct.get(pid);
          if (!cur) {
            byProduct.set(pid, { ok: r.ok, error: r.error, resourceName: r.resourceName });
          } else {
            byProduct.set(pid, {
              ok: cur.ok && r.ok,
              error: cur.error ?? r.error,
              resourceName: cur.resourceName ?? r.resourceName,
            });
          }
        }

        const pushOps: Prisma.PrismaPromise<unknown>[] = [];
        const now = new Date();
        for (const [productId, agg] of byProduct) {
          if (agg.ok) {
            pushed++;
            pushOps.push(
              upsert(productId, FeedItemStatus.SYNCED, {
                lastSyncedAt: now,
                externalItemId: agg.resourceName ?? null,
                errorMessage: null,
              }),
            );
          } else {
            pushFailed++;
            pushOps.push(upsert(productId, FeedItemStatus.ERROR, { errorMessage: (agg.error ?? 'push failed').slice(0, 500) }));
          }
        }
        await prisma.$transaction(pushOps);
      } catch (e: any) {
        // Auth/config/transport failure — leave states at PENDING, surface the reason.
        pushSkipped = `push_error: ${(e?.message ?? String(e)).slice(0, 200)}`;
      }
    }
  } else if (platform !== MarketingPlatform.GOOGLE) {
    pushSkipped = 'push_not_implemented_for_platform';
  }

  const result: ReconcileResult = {
    vendorId,
    platform,
    ready: builtByProduct.size,
    errored: errorByProduct.size,
    excluded: excludedProducts.length,
    pushed,
    pushFailed,
    pushSkipped,
  };
  await auditOnBehalf(caller, 'marketing.feed.forceSync', vendorId, { ...result });
  return result;
}

// ---------------------------------------------------------------------------
// Provider-dependent capabilities — interface fixed here so routes can be wired;
// implementations land with the OAuth (§5/§7A.5) and MCP-ads (§7A.6) steps.
// ---------------------------------------------------------------------------

/** Begin an OAuth connect for a platform; returns the provider authorize URL. */
export async function connectStart(
  _vendorId: string,
  platform: MarketingPlatform,
  _caller: MarketingCaller,
): Promise<string> {
  throw new MarketingNotImplementedError(
    `OAuth connect for ${platform} is not implemented yet (lands with the OAuth step, plan §5/§7A.5).`,
  );
}

/** Launch/boost a campaign scoped to this vendor's product set (gated MARKETING_ADS_MANAGE). */
export async function launchCampaign(
  _vendorId: string,
  _spec: unknown,
  _caller: MarketingCaller,
): Promise<never> {
  throw new MarketingNotImplementedError(
    'Operator campaign launch is not implemented yet (lands with the MCP-ads step, plan §7A.6).',
  );
}

// Re-export so callers/tests have a single import surface.
export { resolvePrice };
