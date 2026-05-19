import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { OrderStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { uploadBuffer } from '../lib/cloudinary';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 4 }, // 50 MB per file, max 4
});

const reviewSchema = z.object({
  productId: z.string().uuid(),
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().max(120).optional(),
  body: z.string().max(2000).optional(),
});

// PUBLIC: paginated reviews + aggregate stats for a product
router.get('/product/:productId', async (req, res, next) => {
  try {
    const { page = '1', limit = '10' } = req.query as Record<string, string>;
    const take = Math.min(parseInt(limit) || 10, 50);
    const skip = (Math.max(parseInt(page) || 1, 1) - 1) * take;

    const [reviews, total, aggregate] = await Promise.all([
      prisma.review.findMany({
        where: { productId: req.params.productId, isHidden: false },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        select: {
          id: true,
          rating: true,
          title: true,
          body: true,
          mediaUrls: true,
          mediaTypes: true,
          createdAt: true,
          vendorResponse: true,
          vendorRespondedAt: true,
          customer: { select: { name: true } },
        },
      }),
      prisma.review.count({ where: { productId: req.params.productId } }),
      prisma.review.aggregate({
        where: { productId: req.params.productId, isHidden: false },
        _avg: { rating: true },
        _count: { rating: true },
      }),
    ]);

    // Compute per-star distribution (5 down to 1)
    const distribution = await prisma.review.groupBy({
      by: ['rating'],
      where: { productId: req.params.productId },
      _count: { rating: true },
    });
    const ratingBreakdown: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const d of distribution) ratingBreakdown[d.rating] = d._count.rating;

    res.json({
      reviews,
      total,
      averageRating: aggregate._avg.rating ? Math.round(aggregate._avg.rating * 10) / 10 : 0,
      ratingBreakdown,
      page: parseInt(page) || 1,
      limit: take,
    });
  } catch (e) {
    next(e);
  }
});

// AUTHENTICATED: check if current user can review this product
router.get('/can-review/:productId', requireAuth, async (req, res, next) => {
  try {
    const { productId } = req.params;
    const customerId = req.user!.id;

    const [deliveredItem, existingReview] = await Promise.all([
      prisma.orderItem.findFirst({
        where: {
          productId,
          status: OrderStatus.DELIVERED,
          order: { customerId },
        },
      }),
      prisma.review.findUnique({
        where: { productId_customerId: { productId, customerId } },
      }),
    ]);

    res.json({
      canReview: !!deliveredItem && !existingReview,
      alreadyReviewed: !!existingReview,
    });
  } catch (e) {
    next(e);
  }
});

// AUTHENTICATED: submit a review (verified buyers only)
router.post('/', requireAuth, upload.array('media', 4), async (req, res, next) => {
  try {
    const parsed = reviewSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const { productId, rating, title, body } = parsed.data;
    const customerId = req.user!.id;

    // Verify delivered purchase
    const deliveredItem = await prisma.orderItem.findFirst({
      where: {
        productId,
        status: OrderStatus.DELIVERED,
        order: { customerId },
      },
    });
    if (!deliveredItem) {
      return res.status(403).json({
        error: 'You can only review products from a delivered order.',
      });
    }

    // One review per user per product
    const existing = await prisma.review.findUnique({
      where: { productId_customerId: { productId, customerId } },
    });
    if (existing) {
      return res.status(409).json({ error: 'You have already reviewed this product.' });
    }

    // Upload media files
    const files = (req.files as Express.Multer.File[]) || [];
    const mediaUrls: string[] = [];
    const mediaTypes: string[] = [];

    if (files.length > 0) {
      await Promise.all(
        files.map(async (file) => {
          const isVideo = file.mimetype.startsWith('video/');
          const url = await uploadBuffer(file.buffer, 'reviews', isVideo ? 'video' : 'image');
          mediaUrls.push(url);
          mediaTypes.push(isVideo ? 'video' : 'image');
        })
      );
    }

    const review = await prisma.review.create({
      data: {
        productId,
        customerId,
        rating,
        title: title || null,
        body: body || null,
        mediaUrls,
        mediaTypes,
      },
      select: {
        id: true,
        rating: true,
        title: true,
        body: true,
        mediaUrls: true,
        mediaTypes: true,
        createdAt: true,
        customer: { select: { name: true } },
      },
    });

    res.status(201).json(review);
  } catch (e) {
    next(e);
  }
});

export default router;
