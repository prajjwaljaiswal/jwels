import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import DOMPurify from 'isomorphic-dompurify';
import { Role, VendorStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';
import { uploadBuffer } from '../lib/cloudinary';
import {
  BlocksArraySchema,
  RESERVED_PAGE_SLUGS,
  SLUG_REGEX,
  SYSTEM_PAGE_SLUGS,
  validateBlocksForKind,
  type Block,
  type PageKind,
} from '../lib/blockSchemas';
import { aiAvailable, generatePageBlocks, generateTheme } from '../lib/ai';
import { defaultBlocksFor, SYSTEM_TITLES, type SystemPageKind } from '../lib/themePresets';
import { notifyStorefrontRevalidate } from '../lib/revalidate';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

const MAX_VERSIONS_PER_PAGE = 5;

const slugSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(SLUG_REGEX, 'slug must be lowercase letters, numbers, and dashes')
  .refine((s) => !RESERVED_PAGE_SLUGS.has(s), 'reserved slug');

const seoFields = {
  seoTitle: z.string().max(160).optional().nullable(),
  seoDescription: z.string().max(320).optional().nullable(),
  seoImageUrl: z.string().url().max(2000).optional().nullable(),
};

const createSchema = z.object({
  slug: slugSchema,
  title: z.string().min(1).max(120),
  isHomepage: z.boolean().optional(),
  ...seoFields,
});

const updateSchema = z.object({
  slug: slugSchema.optional(),
  title: z.string().min(1).max(120).optional(),
  isHomepage: z.boolean().optional(),
  draftBlocks: z.array(z.unknown()).optional(),
  ...seoFields,
});

function sanitizeBlocks(blocks: Block[]): Block[] {
  return blocks.map((b) => {
    if (b.type === 'richText') {
      return {
        ...b,
        settings: {
          ...b.settings,
          html: DOMPurify.sanitize(b.settings.html ?? '', {
            ALLOWED_TAGS: [
              'p','br','strong','em','u','s','a','ul','ol','li','h1','h2','h3','h4','blockquote','code','pre','hr','img','span',
            ],
            ALLOWED_ATTR: ['href','target','rel','src','alt','title','class'],
          }),
        },
      };
    }
    return b;
  });
}

type OwnedPageResult =
  | { ok: true; vendor: NonNullable<Awaited<ReturnType<typeof prisma.vendor.findUnique>>>; page: NonNullable<Awaited<ReturnType<typeof prisma.vendorPage.findUnique>>> }
  | { ok: false; error: string; code: number };

async function getOwnedPage(userId: string, pageId: string): Promise<OwnedPageResult> {
  const vendor = await prisma.vendor.findUnique({ where: { userId } });
  if (!vendor) return { ok: false, error: 'Vendor profile not created', code: 404 };
  const page = await prisma.vendorPage.findUnique({ where: { id: pageId } });
  if (!page) return { ok: false, error: 'Page not found', code: 404 };
  if (page.vendorId !== vendor.id) return { ok: false, error: 'Forbidden', code: 403 };
  return { ok: true, vendor, page };
}

// ---------------- VENDOR (authenticated) ----------------

router.get('/me', requireAuth, requireRole(Role.VENDOR), async (req, res, next) => {
  try {
    const vendor = await prisma.vendor.findUnique({ where: { userId: req.user!.id } });
    if (!vendor) return res.status(404).json({ error: 'Vendor profile not created' });
    const kindParam = typeof req.query.kind === 'string' ? req.query.kind.toUpperCase() : null;
    const validKinds = ['HOMEPAGE','CUSTOM','PDP','CART','CHECKOUT'] as const;
    const where: any = { vendorId: vendor.id };
    if (kindParam && (validKinds as readonly string[]).includes(kindParam)) {
      where.pageKind = kindParam;
    }
    const pages = await prisma.vendorPage.findMany({
      where,
      orderBy: [{ isHomepage: 'desc' }, { updatedAt: 'desc' }],
      select: {
        id: true, slug: true, title: true, pageKind: true, isHomepage: true, isPublished: true,
        publishedAt: true, createdAt: true, updatedAt: true,
      },
    });
    res.json(pages);
  } catch (e) { next(e); }
});

// Idempotently create a system page (PDP/CART/CHECKOUT). Returns the page row.
// HOMEPAGE is handled via the regular create flow (it has user-facing slug "home").
router.post(
  '/me/system/:kind/init',
  requireAuth,
  requireRole(Role.VENDOR),
  async (req, res, next) => {
    try {
      const kind = String(req.params.kind || '').toUpperCase() as SystemPageKind;
      if (!['PDP', 'CART', 'CHECKOUT', 'HOMEPAGE'].includes(kind)) {
        return res.status(400).json({ error: 'Invalid system page kind' });
      }
      const vendor = await prisma.vendor.findUnique({ where: { userId: req.user!.id } });
      if (!vendor) return res.status(404).json({ error: 'Vendor profile not created' });

      const existing = await prisma.vendorPage.findFirst({
        where: { vendorId: vendor.id, pageKind: kind as any },
      });
      if (existing) return res.json(existing);

      const slug = SYSTEM_PAGE_SLUGS[kind];
      const seed = defaultBlocksFor(kind);
      const page = await prisma.vendorPage.create({
        data: {
          vendorId: vendor.id,
          slug,
          pageKind: kind as any,
          title: SYSTEM_TITLES[kind],
          isHomepage: kind === 'HOMEPAGE',
          draftBlocks: seed as any,
        },
      });
      res.status(201).json(page);
    } catch (e) { next(e); }
  }
);

router.post('/me', requireAuth, requireRole(Role.VENDOR), async (req, res, next) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const vendor = await prisma.vendor.findUnique({ where: { userId: req.user!.id } });
    if (!vendor) return res.status(404).json({ error: 'Vendor profile not created' });

    const dup = await prisma.vendorPage.findUnique({
      where: { vendorId_slug: { vendorId: vendor.id, slug: parsed.data.slug } },
    });
    if (dup) return res.status(409).json({ error: 'A page with this slug already exists' });

    if (parsed.data.isHomepage) {
      await prisma.vendorPage.updateMany({
        where: { vendorId: vendor.id, isHomepage: true },
        data: { isHomepage: false },
      });
    }

    const page = await prisma.vendorPage.create({
      data: {
        vendorId: vendor.id,
        slug: parsed.data.slug,
        title: parsed.data.title,
        isHomepage: parsed.data.isHomepage ?? false,
        seoTitle: parsed.data.seoTitle ?? null,
        seoDescription: parsed.data.seoDescription ?? null,
        seoImageUrl: parsed.data.seoImageUrl ?? null,
        draftBlocks: [],
      },
    });
    res.status(201).json(page);
  } catch (e) { next(e); }
});

router.get('/me/:id', requireAuth, requireRole(Role.VENDOR), async (req, res, next) => {
  try {
    const owned = await getOwnedPage(req.user!.id, req.params.id);
    if (!owned.ok) return res.status(owned.code).json({ error: owned.error });
    const versions = await prisma.vendorPageVersion.findMany({
      where: { pageId: owned.page.id },
      orderBy: { versionNum: 'desc' },
      select: { id: true, versionNum: true, publishedAt: true, publishedBy: true },
    });
    res.json({ ...owned.page, versions });
  } catch (e) { next(e); }
});

router.patch('/me/:id', requireAuth, requireRole(Role.VENDOR), async (req, res, next) => {
  try {
    const owned = await getOwnedPage(req.user!.id, req.params.id);
    if (!owned.ok) return res.status(owned.code).json({ error: owned.error });

    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const data: any = {};
    if (parsed.data.title !== undefined) data.title = parsed.data.title;
    if (parsed.data.seoTitle !== undefined) data.seoTitle = parsed.data.seoTitle;
    if (parsed.data.seoDescription !== undefined) data.seoDescription = parsed.data.seoDescription;
    if (parsed.data.seoImageUrl !== undefined) data.seoImageUrl = parsed.data.seoImageUrl;

    if (parsed.data.slug !== undefined && parsed.data.slug !== owned.page.slug) {
      if ((owned.page as any).pageKind && (owned.page as any).pageKind !== 'CUSTOM' && (owned.page as any).pageKind !== 'HOMEPAGE') {
        return res.status(400).json({ error: 'System page slug cannot be changed' });
      }
      const dup = await prisma.vendorPage.findUnique({
        where: { vendorId_slug: { vendorId: owned.vendor.id, slug: parsed.data.slug } },
      });
      if (dup) return res.status(409).json({ error: 'A page with this slug already exists' });
      data.slug = parsed.data.slug;
    }

    if (parsed.data.draftBlocks !== undefined) {
      const blocksParsed = BlocksArraySchema.safeParse(parsed.data.draftBlocks);
      if (!blocksParsed.success) return res.status(400).json({ error: { draftBlocks: blocksParsed.error.flatten() } });
      const kindCheck = validateBlocksForKind(blocksParsed.data, (owned.page as any).pageKind as PageKind);
      if (!kindCheck.ok) return res.status(400).json({ error: kindCheck.error });
      data.draftBlocks = sanitizeBlocks(blocksParsed.data);
    }

    if (parsed.data.isHomepage === true && !owned.page.isHomepage) {
      await prisma.vendorPage.updateMany({
        where: { vendorId: owned.vendor.id, isHomepage: true },
        data: { isHomepage: false },
      });
      data.isHomepage = true;
    } else if (parsed.data.isHomepage === false && owned.page.isHomepage) {
      data.isHomepage = false;
    }

    const updated = await prisma.vendorPage.update({ where: { id: owned.page.id }, data });
    res.json(updated);
  } catch (e) { next(e); }
});

router.delete('/me/:id', requireAuth, requireRole(Role.VENDOR), async (req, res, next) => {
  try {
    const owned = await getOwnedPage(req.user!.id, req.params.id);
    if (!owned.ok) return res.status(owned.code).json({ error: owned.error });
    if (owned.page.isHomepage) {
      return res.status(400).json({ error: 'Cannot delete the homepage. Set another page as homepage first.' });
    }
    await prisma.vendorPage.delete({ where: { id: owned.page.id } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.post('/me/:id/publish', requireAuth, requireRole(Role.VENDOR), async (req, res, next) => {
  try {
    const owned = await getOwnedPage(req.user!.id, req.params.id);
    if (!owned.ok) return res.status(owned.code).json({ error: owned.error });

    const blocksParsed = BlocksArraySchema.safeParse(owned.page.draftBlocks);
    if (!blocksParsed.success) {
      return res.status(400).json({ error: 'Draft contains invalid blocks; cannot publish', detail: blocksParsed.error.flatten() });
    }
    const kindCheck = validateBlocksForKind(blocksParsed.data, (owned.page as any).pageKind as PageKind);
    if (!kindCheck.ok) return res.status(400).json({ error: kindCheck.error });
    const sanitized = sanitizeBlocks(blocksParsed.data);

    const last = await prisma.vendorPageVersion.findFirst({
      where: { pageId: owned.page.id },
      orderBy: { versionNum: 'desc' },
      select: { versionNum: true },
    });
    const nextVersion = (last?.versionNum ?? 0) + 1;

    const [version, updatedPage] = await prisma.$transaction([
      prisma.vendorPageVersion.create({
        data: {
          pageId: owned.page.id,
          versionNum: nextVersion,
          blocks: sanitized as any,
          seoTitle: owned.page.seoTitle,
          seoDescription: owned.page.seoDescription,
          seoImageUrl: owned.page.seoImageUrl,
          publishedBy: req.user!.id,
        },
      }),
      prisma.vendorPage.update({
        where: { id: owned.page.id },
        data: { isPublished: true, publishedAt: new Date(), draftBlocks: sanitized as any },
      }),
    ]);

    // Prune to last MAX_VERSIONS_PER_PAGE
    const all = await prisma.vendorPageVersion.findMany({
      where: { pageId: owned.page.id },
      orderBy: { versionNum: 'desc' },
      select: { id: true },
    });
    if (all.length > MAX_VERSIONS_PER_PAGE) {
      const toDelete = all.slice(MAX_VERSIONS_PER_PAGE).map((v) => v.id);
      await prisma.vendorPageVersion.deleteMany({ where: { id: { in: toDelete } } });
    }

    // Publishing changes live storefront content → bump the vendor's cache signal + revalidate.
    await prisma.vendor.update({ where: { id: owned.vendor.id }, data: { themeVersion: { increment: 1 } } });
    await notifyStorefrontRevalidate(owned.vendor.id);

    res.json({ page: updatedPage, version });
  } catch (e) { next(e); }
});

router.post('/me/:id/restore/:versionNum', requireAuth, requireRole(Role.VENDOR), async (req, res, next) => {
  try {
    const owned = await getOwnedPage(req.user!.id, req.params.id);
    if (!owned.ok) return res.status(owned.code).json({ error: owned.error });

    const versionNum = parseInt(req.params.versionNum, 10);
    if (!Number.isFinite(versionNum)) return res.status(400).json({ error: 'Invalid version number' });

    const version = await prisma.vendorPageVersion.findUnique({
      where: { pageId_versionNum: { pageId: owned.page.id, versionNum } },
    });
    if (!version) return res.status(404).json({ error: 'Version not found' });

    const updated = await prisma.vendorPage.update({
      where: { id: owned.page.id },
      data: {
        draftBlocks: version.blocks as any,
        seoTitle: version.seoTitle,
        seoDescription: version.seoDescription,
        seoImageUrl: version.seoImageUrl,
      },
    });
    res.json({ page: updated, restoredFromVersion: versionNum });
  } catch (e) { next(e); }
});

router.post(
  '/me/:id/upload',
  requireAuth,
  requireRole(Role.VENDOR),
  upload.single('file'),
  async (req, res, next) => {
    try {
      const owned = await getOwnedPage(req.user!.id, req.params.id);
      if (!owned.ok) return res.status(owned.code).json({ error: owned.error });
      const file = req.file;
      if (!file) return res.status(400).json({ error: 'No file uploaded' });
      // Let Cloudinary auto-detect image vs video — browsers sometimes report a
      // video's mime as application/octet-stream, which would otherwise be sent as
      // an image and rejected with "Invalid image file".
      const url = await uploadBuffer(file.buffer, 'page-blocks', 'auto');
      res.json({ url });
    } catch (e) { next(e); }
  }
);

// ---------------- AI ----------------

router.get('/ai/status', requireAuth, requireRole(Role.VENDOR), (_req, res) => {
  res.json({ available: aiAvailable() });
});

router.post('/ai/generate-theme', requireAuth, requireRole(Role.VENDOR), async (req, res, next) => {
  try {
    const brief = String(req.body?.brief ?? '').slice(0, 1000);
    if (brief.trim().length < 5) {
      return res.status(400).json({ error: 'Brief must be at least 5 characters' });
    }
    const result = await generateTheme(brief);
    res.json(result);
  } catch (e) { next(e); }
});

router.post('/me/:id/ai-generate', requireAuth, requireRole(Role.VENDOR), async (req, res, next) => {
  try {
    const owned = await getOwnedPage(req.user!.id, req.params.id);
    if (!owned.ok) return res.status(owned.code).json({ error: owned.error });

    const brief = String(req.body?.brief ?? '').slice(0, 1000);
    if (brief.trim().length < 5) {
      return res.status(400).json({ error: 'Brief must be at least 5 characters' });
    }
    const replace = req.body?.replace !== false; // default: replace draft

    const sections = await prisma.vendorSection.findMany({
      where: { vendorId: owned.vendor.id },
      select: { name: true },
    });

    const result = await generatePageBlocks(brief, {
      shopName: owned.vendor.shopName,
      sectionNames: sections.map((s) => s.name),
      pageKind: (owned.page as any).pageKind as PageKind,
    });

    const sanitized = sanitizeBlocks(result.blocks);
    // For system kinds with required blocks (PDP/CART/CHECKOUT), appending alone
    // can leave duplicates or break required-block ordering. Default to replace
    // for non-HOMEPAGE/CUSTOM unless the caller explicitly opts out.
    const pageKind = (owned.page as any).pageKind as PageKind;
    const replaceEffective = replace || (pageKind !== 'HOMEPAGE' && pageKind !== 'CUSTOM');
    const nextDraft = replaceEffective ? sanitized : [...((owned.page.draftBlocks as any) ?? []), ...sanitized];

    const updated = await prisma.vendorPage.update({
      where: { id: owned.page.id },
      data: { draftBlocks: nextDraft as any },
    });

    res.json({ page: updated, source: result.source, addedBlockCount: sanitized.length });
  } catch (e) { next(e); }
});

// ---------------- PUBLIC ----------------
// GET /api/storefront-pages/:vendorId           → published homepage
// GET /api/storefront-pages/:vendorId/:slug     → published page by slug

async function fetchPublishedPage(
  vendorKey: string,
  opts: { slug?: string; kind?: PageKind } = {},
) {
  const { VENDOR_UUID_RE } = await import('../lib/vendor-slug');
  const lookup = VENDOR_UUID_RE.test(vendorKey) ? { id: vendorKey } : { slug: vendorKey };
  const vendor = await prisma.vendor.findUnique({ where: lookup });
  if (!vendor || vendor.status !== VendorStatus.APPROVED) return null;
  const vendorId = vendor.id;

  const where: any = opts.kind
    ? { vendorId, pageKind: opts.kind, isPublished: true }
    : opts.slug
      ? { vendorId, slug: opts.slug, isPublished: true }
      : { vendorId, isHomepage: true, isPublished: true };

  const page = await prisma.vendorPage.findFirst({ where });
  if (!page) return null;

  const latest = await prisma.vendorPageVersion.findFirst({
    where: { pageId: page.id },
    orderBy: { versionNum: 'desc' },
  });
  if (!latest) return null;

  return {
    id: page.id,
    vendorId: page.vendorId,
    slug: page.slug,
    title: page.title,
    isHomepage: page.isHomepage,
    seoTitle: latest.seoTitle ?? page.seoTitle,
    seoDescription: latest.seoDescription ?? page.seoDescription,
    seoImageUrl: latest.seoImageUrl ?? page.seoImageUrl,
    blocks: latest.blocks,
    publishedAt: latest.publishedAt,
    versionNum: latest.versionNum,
  };
}

export const publicRouter = Router();

publicRouter.get('/:vendorId', async (req, res, next) => {
  try {
    const result = await fetchPublishedPage(req.params.vendorId);
    if (!result) return res.status(404).json({ error: 'Page not found' });
    res.json(result);
  } catch (e) { next(e); }
});

// System pages: /api/storefront-pages/:vendorId/system/:kind
publicRouter.get('/:vendorId/system/:kind', async (req, res, next) => {
  try {
    const kind = String(req.params.kind || '').toUpperCase();
    if (!['HOMEPAGE','PDP','CART','CHECKOUT'].includes(kind)) {
      return res.status(400).json({ error: 'Invalid system page kind' });
    }
    const result = await fetchPublishedPage(req.params.vendorId, { kind: kind as PageKind });
    if (!result) return res.status(404).json({ error: 'Page not found' });
    res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=300');
    res.json(result);
  } catch (e) { next(e); }
});

publicRouter.get('/:vendorId/:slug', async (req, res, next) => {
  try {
    const result = await fetchPublishedPage(req.params.vendorId, { slug: req.params.slug });
    if (!result) return res.status(404).json({ error: 'Page not found' });
    res.json(result);
  } catch (e) { next(e); }
});

export default router;
