import { Router } from 'express';
import { createHash } from 'crypto';
import { z } from 'zod';
import { Role, FeedCondition, AvailabilityStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';
import { feedLimiter } from '../middleware/rateLimit';
import { generateFeedXml } from '../lib/marketing/feed';
import {
  getMarketingStatus,
  setProductFeedFields,
  syncVendorCatalog,
  type MarketingCaller,
} from '../lib/marketing/service';

const router = Router();

/** Caller context for a vendor acting on their own resources. */
function vendorCaller(userId: string): MarketingCaller {
  return { actorId: userId, actorRole: 'VENDOR', onBehalf: false };
}

async function getVendorOrThrow(userId: string) {
  const vendor = await prisma.vendor.findUnique({ where: { userId } });
  if (!vendor) throw new Error('Vendor profile not created');
  return vendor;
}

// ---------------------------------------------------------------------------
// PUBLIC: canonical product feed (Google Merchant spec; Meta consumes the same URL).
// Anonymous — Meta/Google crawlers fetch without auth. Rate-limited + cached + ETag.
// Optional ?vendor=<id> returns a single vendor's slice.
// ---------------------------------------------------------------------------
router.get('/feed.xml', feedLimiter, async (req, res) => {
  const vendorId = typeof req.query.vendor === 'string' ? req.query.vendor : undefined;
  try {
    const { xml } = await generateFeedXml({ vendorId });
    const etag = `W/"${createHash('sha1').update(xml).digest('hex')}"`;

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=900'); // 15 min
    res.setHeader('ETag', etag);
    if (req.headers['if-none-match'] === etag) return res.status(304).end();
    return res.status(200).send(xml);
  } catch (e: any) {
    // Public, anonymous surface — never reflect internal error text (mirror the global handler).
    console.error('[marketing] feed generation failed:', e?.message ?? e);
    return res.status(500).json({ error: 'Failed to generate feed' });
  }
});

// ---------------------------------------------------------------------------
// VENDOR self-serve. vendorId is ALWAYS resolved from req.user — the vendor never
// names a vendorId, so cross-vendor access is structurally impossible (§7A.2).
// ---------------------------------------------------------------------------
router.get('/status', requireAuth, requireRole(Role.VENDOR), async (req, res) => {
  let vendor;
  try { vendor = await getVendorOrThrow(req.user!.id); }
  catch (e: any) { return res.status(400).json({ error: e.message }); }
  const status = await getMarketingStatus(vendor.id, vendorCaller(req.user!.id));
  res.json(status);
});

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

router.patch('/products/:id/feed-fields', requireAuth, requireRole(Role.VENDOR), async (req, res, next) => {
  const parsed = feedFieldsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  let vendor;
  try { vendor = await getVendorOrThrow(req.user!.id); }
  catch (e: any) { return res.status(400).json({ error: e.message }); }

  try {
    const updated = await setProductFeedFields(vendor.id, req.params.id, parsed.data, vendorCaller(req.user!.id));
    res.json(updated);
  } catch (e: any) {
    // Only reflect controlled errors that carry a numeric .status (e.g. the 404); route
    // anything else to the global handler so raw DB/internal text is never leaked.
    if (typeof e?.status === 'number') return res.status(e.status).json({ error: e.message });
    next(e);
  }
});

router.post('/sync', requireAuth, requireRole(Role.VENDOR), async (req, res) => {
  let vendor;
  try { vendor = await getVendorOrThrow(req.user!.id); }
  catch (e: any) { return res.status(400).json({ error: e.message }); }
  const result = await syncVendorCatalog(vendor.id, vendorCaller(req.user!.id));
  res.json(result);
});

export default router;
