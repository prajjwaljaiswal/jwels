/**
 * Admin operator surface for marketing (plan §7A.2). Distinct from the vendor self-serve
 * router (/api/marketing/*): here the target vendorId comes from the PATH and every route
 * is gated by a per-route permission guard. requirePermission/requireAnyPermission already
 * hard-reject any caller whose role !== ADMIN (middleware/auth.ts), so a VENDOR token can
 * never reach these handlers — the permission guard IS the gate. Vendor routes stay
 * parameter-free (vendorId from req.user), so cross-vendor IDOR is structurally impossible
 * on that side; here it's open behind the gate, and we 404 unknown vendors.
 *
 * All handlers call the SAME service functions as the vendor router, with
 * { actorRole: 'ADMIN', onBehalf: true } — so every action is audited (service.auditOnBehalf).
 */
import { Router } from 'express';
import { z } from 'zod';
import { Permission, FeedCondition, AvailabilityStatus, MarketingPlatform } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { requireAuth, requirePermission, requireAnyPermission } from '../middleware/auth';
import {
  getMarketingStatus,
  setProductFeedFields,
  syncVendorCatalog,
  connectStart,
  launchCampaign,
  MarketingNotImplementedError,
  type MarketingCaller,
} from '../lib/marketing/service';

const router = Router();
// 401 if unauthenticated; ADMIN role + the specific permission are enforced per-route below.
router.use(requireAuth);

function adminCaller(userId: string): MarketingCaller {
  return { actorId: userId, actorRole: 'ADMIN', onBehalf: true };
}

/** Resolve the target vendor from the path; 404 if it doesn't exist. Returns null after responding. */
async function loadVendorOr404(res: import('express').Response, vendorId: string) {
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId }, select: { id: true } });
  if (!vendor) {
    res.status(404).json({ error: 'Vendor not found' });
    return null;
  }
  return vendor;
}

// ─── Global overview (§7A.7a) ──────────────────────────────────────────────
// All-vendors roll-up: feed health + connection status per vendor. Read-only + PAGINATED —
// the feed/connection aggregates are scoped to the current page of vendors so the query cost
// is bounded by the page size, not the whole catalog.
const overviewQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

router.get(
  '/overview',
  requireAnyPermission(Permission.MARKETING_VIEW, Permission.MARKETING_MANAGE),
  async (req, res, next) => {
    const parsed = overviewQuerySchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const { page, limit } = parsed.data;
    try {
      const [total, vendors] = await Promise.all([
        prisma.vendor.count({ where: { status: 'APPROVED' } }),
        prisma.vendor.findMany({
          where: { status: 'APPROVED' },
          select: { id: true, shopName: true, managedMarketingConsent: true },
          orderBy: { shopName: 'asc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
      ]);

      const ids = vendors.map((v) => v.id);
      // Aggregates scoped to THIS page of vendors (in: ids); empty page → no rows scanned.
      const [feedGroups, connections] = await Promise.all([
        prisma.productFeedState.groupBy({ by: ['vendorId', 'status'], where: { vendorId: { in: ids } }, _count: { _all: true } }),
        prisma.marketingConnection.findMany({ where: { vendorId: { in: ids } }, select: { vendorId: true, platform: true, status: true } }),
      ]);

      const feedByVendor = new Map<string, Record<string, number>>();
      for (const g of feedGroups) {
        const m = feedByVendor.get(g.vendorId) ?? {};
        m[g.status] = g._count._all;
        feedByVendor.set(g.vendorId, m);
      }
      const connByVendor = new Map<string, Array<{ platform: string; status: string }>>();
      for (const c of connections) {
        const list = connByVendor.get(c.vendorId) ?? [];
        list.push({ platform: c.platform, status: c.status });
        connByVendor.set(c.vendorId, list);
      }

      res.json({
        page,
        limit,
        total,
        vendors: vendors.map((v) => ({
          vendorId: v.id,
          shopName: v.shopName,
          managedMarketingConsent: v.managedMarketingConsent,
          feed: feedByVendor.get(v.id) ?? {},
          connections: connByVendor.get(v.id) ?? [],
        })),
      });
    } catch (e) { next(e); }
  },
);

// ─── Per-vendor console (§7A.7b) ────────────────────────────────────────────

router.get(
  '/vendors/:vendorId/status',
  requireAnyPermission(Permission.MARKETING_VIEW, Permission.MARKETING_MANAGE),
  async (req, res, next) => {
    try {
      if (!(await loadVendorOr404(res, req.params.vendorId))) return;
      const status = await getMarketingStatus(req.params.vendorId, adminCaller(req.user!.id));
      res.json(status);
    } catch (e) { next(e); }
  },
);

router.post(
  '/vendors/:vendorId/sync',
  requirePermission(Permission.MARKETING_MANAGE),
  async (req, res, next) => {
    try {
      if (!(await loadVendorOr404(res, req.params.vendorId))) return;
      const result = await syncVendorCatalog(req.params.vendorId, adminCaller(req.user!.id));
      res.json(result);
    } catch (e) { next(e); }
  },
);

const feedFieldsSchema = z
  .object({
    gtin: z.string().trim().max(50).nullable(),
    mpn: z.string().trim().max(70).nullable(),
    googleProductCategory: z.string().trim().max(255).nullable(),
    feedCondition: z.nativeEnum(FeedCondition),
    availabilityStatus: z.nativeEnum(AvailabilityStatus).nullable(),
    feedExcluded: z.boolean(),
  })
  .partial();

router.patch(
  '/vendors/:vendorId/products/:productId/feed-fields',
  requirePermission(Permission.MARKETING_MANAGE),
  async (req, res, next) => {
    const parsed = feedFieldsSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    try {
      if (!(await loadVendorOr404(res, req.params.vendorId))) return;
      // setProductFeedFields verifies the product belongs to THIS vendor (404 otherwise),
      // so an admin can't edit one vendor's product under another vendor's path.
      const updated = await setProductFeedFields(
        req.params.vendorId,
        req.params.productId,
        parsed.data,
        adminCaller(req.user!.id),
      );
      res.json(updated);
    } catch (e: any) {
      if (typeof e?.status === 'number') return res.status(e.status).json({ error: e.message });
      next(e);
    }
  },
);

// ─── Provider-dependent (interface wired; implementations land later) ───────

const platformSchema = z.nativeEnum(MarketingPlatform);

router.post(
  '/vendors/:vendorId/connect/:platform',
  requirePermission(Permission.MARKETING_MANAGE),
  async (req, res, next) => {
    const platform = platformSchema.safeParse(req.params.platform?.toUpperCase());
    if (!platform.success) return res.status(400).json({ error: 'Unknown platform' });
    try {
      if (!(await loadVendorOr404(res, req.params.vendorId))) return;
      const authUrl = await connectStart(req.params.vendorId, platform.data, adminCaller(req.user!.id));
      res.json({ authUrl });
    } catch (e: any) {
      if (e instanceof MarketingNotImplementedError) return res.status(501).json({ error: e.message, code: e.code });
      next(e);
    }
  },
);

router.post(
  '/vendors/:vendorId/campaigns',
  requirePermission(Permission.MARKETING_ADS_MANAGE),
  async (req, res, next) => {
    try {
      if (!(await loadVendorOr404(res, req.params.vendorId))) return;
      await launchCampaign(req.params.vendorId, req.body, adminCaller(req.user!.id));
      res.status(501).json({ error: 'not implemented' }); // unreachable; launchCampaign throws
    } catch (e: any) {
      if (e instanceof MarketingNotImplementedError) return res.status(501).json({ error: e.message, code: e.code });
      next(e);
    }
  },
);

export default router;
