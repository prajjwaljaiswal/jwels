import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const items = await prisma.wishlistItem.findMany({
      where: { userId: req.user!.id },
      orderBy: { addedAt: 'desc' },
      include: {
        product: {
          include: {
            vendor: { select: { id: true, shopName: true, shopLogoUrl: true } },
          },
        },
      },
    });
    res.json({
      items: items.map((w) => ({
        id: w.id,
        productId: w.productId,
        addedAt: w.addedAt,
        product: {
          id: w.product.id,
          name: w.product.name,
          images: w.product.images,
          price: Number(w.product.price),
          stockQuantity: w.product.stockQuantity,
          isActive: w.product.isActive,
          status: w.product.status,
          vendor: w.product.vendor,
        },
      })),
      count: items.length,
    });
  } catch (e) { next(e); }
});

router.get('/count', async (req, res, next) => {
  try {
    const count = await prisma.wishlistItem.count({ where: { userId: req.user!.id } });
    res.json({ count });
  } catch (e) { next(e); }
});

router.get('/ids', async (req, res, next) => {
  try {
    const rows = await prisma.wishlistItem.findMany({
      where: { userId: req.user!.id },
      select: { productId: true },
    });
    res.json({ productIds: rows.map((r) => r.productId) });
  } catch (e) { next(e); }
});

const addSchema = z.object({ productId: z.string().uuid() });

router.post('/', async (req, res, next) => {
  try {
    const { productId } = addSchema.parse(req.body);
    const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const item = await prisma.wishlistItem.upsert({
      where: { userId_productId: { userId: req.user!.id, productId } },
      update: {},
      create: { userId: req.user!.id, productId },
    });
    res.status(201).json({ id: item.id, productId: item.productId, addedAt: item.addedAt });
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ error: 'Invalid input', details: e.errors });
    next(e);
  }
});

router.delete('/:productId', async (req, res, next) => {
  try {
    await prisma.wishlistItem.deleteMany({
      where: { userId: req.user!.id, productId: req.params.productId },
    });
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
