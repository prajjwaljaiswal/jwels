import { Router } from 'express';
import { prisma } from '../lib/prisma';

const router = Router();

// Public: get COD enabled status
router.get('/cod', async (_req, res, next) => {
  try {
    const setting = await prisma.setting.findUnique({ where: { key: 'cod_enabled' } });
    res.json({ enabled: setting?.value === 'true' });
  } catch (e) {
    next(e);
  }
});

export default router;
