import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { Permission, VendorStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { requireAuth, requirePermission } from '../middleware/auth';
import { uploadBuffer } from '../lib/cloudinary';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });

const collectionSchema = z.object({
  slug:        z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  name:        z.string().min(1).max(120),
  description: z.string().max(2000).nullable().optional(),
  imageUrl:    z.string().url().max(500).nullable().optional(),
  bannerUrl:   z.string().url().max(500).nullable().optional(),
  isActive:    z.boolean().optional(),
  featured:    z.boolean().optional(),
  sortOrder:   z.coerce.number().int().nonnegative().optional(),
  metaTitle:       z.string().max(160).nullable().optional(),
  metaDescription: z.string().max(320).nullable().optional(),
  metaImageUrl:    z.string().url().max(500).nullable().optional(),
});

const cardSelect = {
  id: true, name: true, slug: true, price: true, images: true, metalType: true,
  vendorId: true, isActive: true,
  vendor: { select: { id: true, shopName: true } },
  category: { select: { id: true, name: true, slug: true } },
} as const;

// GET /api/collections — public, active only
router.get('/', async (_req, res, next) => {
  try {
    const items = await prisma.collection.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    res.json(items);
  } catch (e) { next(e); }
});

// GET /api/collections/all — admin, includes inactive + counts
router.get('/all', requireAuth, requirePermission(Permission.CATEGORY_MANAGE), async (_req, res, next) => {
  try {
    const items = await prisma.collection.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { products: true } } },
    });
    res.json(items);
  } catch (e) { next(e); }
});

// GET /api/collections/by-slug/:slug — public, single collection + products
router.get('/by-slug/:slug', async (req, res, next) => {
  try {
    const col = await prisma.collection.findUnique({
      where: { slug: req.params.slug },
      include: {
        products: {
          where: { isActive: true, vendor: { status: VendorStatus.APPROVED } },
          select: cardSelect,
          take: 48,
        },
      },
    });
    if (!col || !col.isActive) return res.status(404).json({ error: 'Not found' });
    res.json(col);
  } catch (e) { next(e); }
});

// POST /api/collections — admin
router.post('/', requireAuth, requirePermission(Permission.CATEGORY_MANAGE), async (req, res, next) => {
  try {
    const data = collectionSchema.parse(req.body);
    const col = await prisma.collection.create({ data });
    res.status(201).json(col);
  } catch (e) { next(e); }
});

// PUT /api/collections/:id — admin
router.put('/:id', requireAuth, requirePermission(Permission.CATEGORY_MANAGE), async (req, res, next) => {
  try {
    const data = collectionSchema.partial().parse(req.body);
    const col = await prisma.collection.update({ where: { id: req.params.id }, data });
    res.json(col);
  } catch (e) { next(e); }
});

// DELETE /api/collections/:id — admin
router.delete('/:id', requireAuth, requirePermission(Permission.CATEGORY_MANAGE), async (req, res, next) => {
  try {
    await prisma.collection.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (e) { next(e); }
});

// PUT /api/collections/:id/products — admin, replace product set (body: { productIds: string[] })
router.put('/:id/products', requireAuth, requirePermission(Permission.CATEGORY_MANAGE), async (req, res, next) => {
  try {
    const productIds = z.array(z.string().uuid()).max(500).parse(req.body?.productIds ?? []);
    await prisma.collection.update({
      where: { id: req.params.id },
      data: { products: { set: productIds.map((id) => ({ id })) } },
    });
    res.status(204).end();
  } catch (e) { next(e); }
});

// POST /api/collections/upload-image — admin, returns Cloudinary URL
router.post(
  '/upload-image',
  requireAuth,
  requirePermission(Permission.CATEGORY_MANAGE),
  upload.single('image'),
  async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No image provided' });
      const url = await uploadBuffer(req.file.buffer, 'collections');
      res.json({ url });
    } catch (e) { next(e); }
  },
);

export default router;
