import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

const addressInput = z.object({
  label: z.string().max(40).optional().nullable(),
  name: z.string().min(1).max(120),
  phone: z.string().min(7).max(20),
  line1: z.string().min(1).max(200),
  line2: z.string().max(200).optional().nullable(),
  city: z.string().min(1).max(80),
  state: z.string().min(1).max(80),
  pincode: z.string().min(3).max(20),
  country: z.string().min(2).max(2).default('IN'),
  isDefault: z.boolean().optional(),
});

router.get('/', async (req, res, next) => {
  try {
    const items = await prisma.address.findMany({
      where: { userId: req.user!.id },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    });
    res.json({ items });
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const body = addressInput.parse(req.body);
    const existingCount = await prisma.address.count({ where: { userId: req.user!.id } });
    const shouldBeDefault = body.isDefault ?? existingCount === 0;

    const created = await prisma.$transaction(async (tx) => {
      if (shouldBeDefault) {
        await tx.address.updateMany({
          where: { userId: req.user!.id, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.address.create({
        data: {
          userId: req.user!.id,
          label: body.label ?? null,
          name: body.name,
          phone: body.phone,
          line1: body.line1,
          line2: body.line2 ?? null,
          city: body.city,
          state: body.state,
          pincode: body.pincode,
          country: body.country,
          isDefault: shouldBeDefault,
        },
      });
    });
    res.status(201).json(created);
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ error: 'Invalid input', details: e.errors });
    next(e);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const body = addressInput.partial().parse(req.body);
    const existing = await prisma.address.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.userId !== req.user!.id) {
      return res.status(404).json({ error: 'Address not found' });
    }
    const updated = await prisma.$transaction(async (tx) => {
      if (body.isDefault === true && !existing.isDefault) {
        await tx.address.updateMany({
          where: { userId: req.user!.id, isDefault: true, NOT: { id: existing.id } },
          data: { isDefault: false },
        });
      }
      return tx.address.update({
        where: { id: existing.id },
        data: {
          label: body.label !== undefined ? body.label : undefined,
          name: body.name,
          phone: body.phone,
          line1: body.line1,
          line2: body.line2 !== undefined ? body.line2 : undefined,
          city: body.city,
          state: body.state,
          pincode: body.pincode,
          country: body.country,
          isDefault: body.isDefault,
        },
      });
    });
    res.json(updated);
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ error: 'Invalid input', details: e.errors });
    next(e);
  }
});

router.post('/:id/default', async (req, res, next) => {
  try {
    const existing = await prisma.address.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.userId !== req.user!.id) {
      return res.status(404).json({ error: 'Address not found' });
    }
    await prisma.$transaction([
      prisma.address.updateMany({
        where: { userId: req.user!.id, isDefault: true },
        data: { isDefault: false },
      }),
      prisma.address.update({ where: { id: existing.id }, data: { isDefault: true } }),
    ]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const existing = await prisma.address.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.userId !== req.user!.id) {
      return res.status(404).json({ error: 'Address not found' });
    }
    await prisma.address.delete({ where: { id: existing.id } });
    if (existing.isDefault) {
      // Promote the most-recently-updated remaining address.
      const next = await prisma.address.findFirst({
        where: { userId: req.user!.id },
        orderBy: { updatedAt: 'desc' },
      });
      if (next) {
        await prisma.address.update({ where: { id: next.id }, data: { isDefault: true } });
      }
    }
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
