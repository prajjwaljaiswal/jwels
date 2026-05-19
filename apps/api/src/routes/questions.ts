import { Router } from 'express';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

// PUBLIC: list answered/public questions for a product
router.get('/product/:productId', async (req, res, next) => {
  try {
    const items = await prisma.productQuestion.findMany({
      where: { productId: req.params.productId, isPublic: true },
      orderBy: [{ answeredAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        question: true,
        answer: true,
        answeredAt: true,
        askedByName: true,
        createdAt: true,
      },
    });
    res.json({ items });
  } catch (e) { next(e); }
});

// AUTH: customer asks a question
const askSchema = z.object({
  productId: z.string().uuid(),
  question: z.string().trim().min(5).max(1000),
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const body = askSchema.parse(req.body);
    const product = await prisma.product.findUnique({
      where: { id: body.productId },
      select: { id: true, isActive: true },
    });
    if (!product || !product.isActive) return res.status(404).json({ error: 'Product not found' });

    const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { name: true } });
    const created = await prisma.productQuestion.create({
      data: {
        productId: body.productId,
        askedById: req.user!.id,
        askedByName: user?.name ?? 'Customer',
        question: body.question,
      },
    });
    res.status(201).json({
      id: created.id,
      question: created.question,
      answer: null,
      askedByName: created.askedByName,
      createdAt: created.createdAt,
      answeredAt: null,
    });
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ error: 'Invalid input', details: e.errors });
    next(e);
  }
});

// VENDOR: list questions for the current vendor's products (answered + unanswered)
router.get('/vendor/inbox', requireAuth, requireRole(Role.VENDOR), async (req, res, next) => {
  try {
    const vendor = await prisma.vendor.findUnique({ where: { userId: req.user!.id }, select: { id: true } });
    if (!vendor) return res.status(404).json({ error: 'Vendor profile not created' });

    const filter = (req.query.filter as string) || 'all';
    const items = await prisma.productQuestion.findMany({
      where: {
        product: { vendorId: vendor.id },
        ...(filter === 'unanswered' ? { answer: null } : {}),
        ...(filter === 'answered' ? { answer: { not: null } } : {}),
      },
      orderBy: [{ answeredAt: 'asc' }, { createdAt: 'desc' }],
      include: {
        product: { select: { id: true, name: true, images: true } },
      },
    });
    res.json({ items });
  } catch (e) { next(e); }
});

// VENDOR: answer a question (must own the product)
const answerSchema = z.object({
  answer: z.string().trim().min(1).max(2000),
});

router.post('/:id/answer', requireAuth, requireRole(Role.VENDOR), async (req, res, next) => {
  try {
    const body = answerSchema.parse(req.body);
    const vendor = await prisma.vendor.findUnique({ where: { userId: req.user!.id }, select: { id: true } });
    if (!vendor) return res.status(403).json({ error: 'Vendor profile required' });

    const q = await prisma.productQuestion.findUnique({
      where: { id: req.params.id },
      include: { product: { select: { vendorId: true } } },
    });
    if (!q) return res.status(404).json({ error: 'Question not found' });
    if (q.product.vendorId !== vendor.id) return res.status(403).json({ error: 'Forbidden' });

    const updated = await prisma.productQuestion.update({
      where: { id: q.id },
      data: { answer: body.answer, answeredAt: new Date() },
    });
    res.json({
      id: updated.id,
      question: updated.question,
      answer: updated.answer,
      askedByName: updated.askedByName,
      createdAt: updated.createdAt,
      answeredAt: updated.answeredAt,
    });
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ error: 'Invalid input', details: e.errors });
    next(e);
  }
});

// VENDOR: hide (soft-delete) a question
router.delete('/:id', requireAuth, requireRole(Role.VENDOR), async (req, res, next) => {
  try {
    const vendor = await prisma.vendor.findUnique({ where: { userId: req.user!.id }, select: { id: true } });
    if (!vendor) return res.status(403).json({ error: 'Vendor profile required' });
    const q = await prisma.productQuestion.findUnique({
      where: { id: req.params.id },
      include: { product: { select: { vendorId: true } } },
    });
    if (!q) return res.status(404).json({ error: 'Question not found' });
    if (q.product.vendorId !== vendor.id) return res.status(403).json({ error: 'Forbidden' });
    await prisma.productQuestion.update({ where: { id: q.id }, data: { isPublic: false } });
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
