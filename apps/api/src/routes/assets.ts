// Vendor media library.
//   GET    /api/vendors/me/assets        — paginated list (newest first)
//   POST   /api/vendors/me/assets        — multipart upload (field: "file")
//   DELETE /api/vendors/me/assets/:id    — remove row + Cloudinary asset
//
// Each upload goes to Cloudinary and a corresponding VendorAsset row stores
// the metadata so the picker can show thumbnails + dimensions without hitting
// Cloudinary directly.

import { Router } from 'express';
import multer from 'multer';
import { Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';
import { uploadBufferFull, deleteByPublicId } from '../lib/cloudinary';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

const VIDEO_EXT = /\.(mp4|webm|mov|m4v|ogv|avi|mkv)$/i;
const IMAGE_EXT = /\.(jpe?g|png|gif|webp|avif|svg|bmp|tiff?)$/i;

const MAX_PAGE_SIZE = 60;

// ── LIST ────────────────────────────────────────────────────────────────────
router.get('/me/assets', requireAuth, requireRole(Role.VENDOR), async (req, res, next) => {
  try {
    const vendor = await prisma.vendor.findUnique({ where: { userId: req.user!.id }, select: { id: true } });
    if (!vendor) return res.status(404).json({ error: 'Vendor profile not created' });

    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(String(req.query.limit ?? '40'), 10) || 40));
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';

    const where: any = { vendorId: vendor.id };
    if (q) where.alt = { contains: q, mode: 'insensitive' };

    const rows = await prisma.vendorAsset.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: {
        id: true, url: true, kind: true, alt: true,
        width: true, height: true, bytes: true, format: true,
        createdAt: true,
      },
    });
    const nextCursor = rows.length > limit ? rows[limit - 1]?.id ?? null : null;
    const assets = nextCursor ? rows.slice(0, limit) : rows;
    res.json({ assets, nextCursor });
  } catch (e) { next(e); }
});

// ── UPLOAD ──────────────────────────────────────────────────────────────────
router.post(
  '/me/assets',
  requireAuth,
  requireRole(Role.VENDOR),
  upload.single('file'),
  async (req, res, next) => {
    try {
      const vendor = await prisma.vendor.findUnique({ where: { userId: req.user!.id }, select: { id: true } });
      if (!vendor) return res.status(404).json({ error: 'Vendor profile not created' });

      const file = req.file;
      if (!file) return res.status(400).json({ error: 'No file uploaded' });

      // Detect by mime OR extension — browsers sometimes report video files as
      // application/octet-stream, which would otherwise be treated as an image.
      const name = file.originalname || '';
      const isVideo = file.mimetype.startsWith('video/') || VIDEO_EXT.test(name);
      const isImage = file.mimetype.startsWith('image/') || IMAGE_EXT.test(name);
      if (!isImage && !isVideo) {
        return res.status(400).json({ error: 'Only image / video uploads are accepted' });
      }

      const alt = typeof req.body?.alt === 'string' ? req.body.alt.slice(0, 200) : null;
      const folder = `vendor-assets/${vendor.id}`;

      // 'auto' lets Cloudinary pick the right pipeline even when the mime is
      // ambiguous; we read the true type back from result.resourceType.
      const result = await uploadBufferFull(file.buffer, folder, isVideo ? 'video' : 'auto');
      const kind = result.resourceType === 'video' ? 'video' : result.resourceType === 'raw' ? 'raw' : 'image';

      const row = await prisma.vendorAsset.create({
        data: {
          vendorId: vendor.id,
          url: result.url,
          publicId: result.publicId,
          kind,
          alt,
          width: result.width ?? null,
          height: result.height ?? null,
          bytes: result.bytes ?? file.size,
          format: result.format ?? null,
          folder,
        },
        select: {
          id: true, url: true, kind: true, alt: true,
          width: true, height: true, bytes: true, format: true, createdAt: true,
        },
      });
      res.status(201).json(row);
    } catch (e) { next(e); }
  }
);

// ── PATCH alt text ──────────────────────────────────────────────────────────
router.patch('/me/assets/:id', requireAuth, requireRole(Role.VENDOR), async (req, res, next) => {
  try {
    const vendor = await prisma.vendor.findUnique({ where: { userId: req.user!.id }, select: { id: true } });
    if (!vendor) return res.status(404).json({ error: 'Vendor profile not created' });

    const asset = await prisma.vendorAsset.findUnique({ where: { id: req.params.id } });
    if (!asset || asset.vendorId !== vendor.id) return res.status(404).json({ error: 'Asset not found' });

    const alt = typeof req.body?.alt === 'string' ? req.body.alt.slice(0, 200) : null;
    const updated = await prisma.vendorAsset.update({
      where: { id: asset.id },
      data: { alt },
      select: { id: true, url: true, kind: true, alt: true, width: true, height: true, bytes: true, format: true, createdAt: true },
    });
    res.json(updated);
  } catch (e) { next(e); }
});

// ── DELETE ──────────────────────────────────────────────────────────────────
router.delete('/me/assets/:id', requireAuth, requireRole(Role.VENDOR), async (req, res, next) => {
  try {
    const vendor = await prisma.vendor.findUnique({ where: { userId: req.user!.id }, select: { id: true } });
    if (!vendor) return res.status(404).json({ error: 'Vendor profile not created' });

    const asset = await prisma.vendorAsset.findUnique({ where: { id: req.params.id } });
    if (!asset || asset.vendorId !== vendor.id) return res.status(404).json({ error: 'Asset not found' });

    // Best-effort Cloudinary cleanup. Don't fail the delete if it's gone already.
    if (asset.publicId) {
      try {
        await deleteByPublicId(asset.publicId, asset.kind as 'image' | 'video' | 'raw');
      } catch {}
    }
    await prisma.vendorAsset.delete({ where: { id: asset.id } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
