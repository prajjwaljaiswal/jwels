import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.use(requireAuth);

const cartInclude = {
  items: {
    orderBy: { addedAt: 'asc' as const },
    include: {
      product: {
        include: {
          vendor: { select: { id: true, shopName: true, shopLogoUrl: true } },
          variations: {
            include: { options: { orderBy: { position: 'asc' as const } } },
            orderBy: { position: 'asc' as const },
          },
        },
      },
      variationCombo: true,
    },
  },
};

async function getOrCreateCart(userId: string) {
  return prisma.cart.upsert({
    where: { userId },
    update: {},
    create: { userId },
    include: cartInclude,
  });
}

function serializeCart(cart: Prisma.CartGetPayload<{ include: typeof cartInclude }>) {
  const items = cart.items.map((it) => {
    const basePrice = Number(it.product.price);
    const comboPrice = it.variationCombo?.price != null ? Number(it.variationCombo.price) : null;
    const unitPrice = comboPrice ?? basePrice;
    const stock = it.variationCombo ? it.variationCombo.stock : it.product.stockQuantity;
    return {
      id: it.id,
      productId: it.productId,
      variationComboId: it.variationComboId,
      quantity: it.quantity,
      addedAt: it.addedAt,
      unitPrice,
      lineTotal: unitPrice * it.quantity,
      stock,
      product: {
        id: it.product.id,
        name: it.product.name,
        images: it.product.images,
        price: basePrice,
        isActive: it.product.isActive,
        status: it.product.status,
        vendor: it.product.vendor,
      },
      variationLabel: it.variationCombo
        ? buildVariationLabel(it.product.variations, it.variationCombo.optionIds)
        : null,
    };
  });
  const subtotal = items.reduce((sum, it) => sum + it.lineTotal, 0);
  return {
    id: cart.id,
    userId: cart.userId,
    items,
    subtotal,
    itemCount: items.reduce((n, it) => n + it.quantity, 0),
    updatedAt: cart.updatedAt,
  };
}

function buildVariationLabel(
  variations: { name: string; options: { id: string; value: string }[] }[],
  optionIds: string[]
): string {
  const parts: string[] = [];
  for (const v of variations) {
    const match = v.options.find((o) => optionIds.includes(o.id));
    if (match) parts.push(`${v.name}: ${match.value}`);
  }
  return parts.join(' · ');
}

async function validateProductAndCombo(
  productId: string,
  variationComboId: string | undefined,
  quantity: number
) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { variationCombos: true, variations: true },
  });
  if (!product) throw new HttpError(404, 'Product not found');
  if (!product.isActive) {
    throw new HttpError(400, 'Product is not available');
  }

  if (product.variations.length > 0 && !variationComboId) {
    throw new HttpError(400, 'Please select a variation');
  }

  let stock = product.stockQuantity;
  if (variationComboId) {
    const combo = product.variationCombos.find((c) => c.id === variationComboId);
    if (!combo) throw new HttpError(400, 'Invalid variation for this product');
    stock = combo.stock;
  }
  if (stock < quantity) {
    throw new HttpError(400, `Only ${stock} in stock`);
  }
  return { product, stock };
}

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

router.get('/', async (req, res, next) => {
  try {
    const cart = await getOrCreateCart(req.user!.id);
    res.json(serializeCart(cart));
  } catch (e) {
    next(e);
  }
});

const addItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive().max(99).default(1),
  variationComboId: z.string().uuid().optional(),
});

router.post('/items', async (req, res, next) => {
  try {
    const body = addItemSchema.parse(req.body);
    await validateProductAndCombo(body.productId, body.variationComboId, body.quantity);

    const cart = await prisma.cart.upsert({
      where: { userId: req.user!.id },
      update: { abandonedAt: null },
      create: { userId: req.user!.id },
    });

    const existing = await prisma.cartItem.findFirst({
      where: {
        cartId: cart.id,
        productId: body.productId,
        variationComboId: body.variationComboId ?? null,
      },
    });

    if (existing) {
      const nextQty = existing.quantity + body.quantity;
      await validateProductAndCombo(body.productId, body.variationComboId, nextQty);
      await prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: nextQty },
      });
    } else {
      await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId: body.productId,
          variationComboId: body.variationComboId,
          quantity: body.quantity,
        },
      });
    }

    const fresh = await getOrCreateCart(req.user!.id);
    res.status(201).json(serializeCart(fresh));
  } catch (e) {
    if (e instanceof HttpError) return res.status(e.status).json({ error: e.message });
    if (e instanceof z.ZodError) return res.status(400).json({ error: 'Invalid input', details: e.errors });
    next(e);
  }
});

const updateItemSchema = z.object({
  quantity: z.number().int().positive().max(99),
});

router.patch('/items/:itemId', async (req, res, next) => {
  try {
    const body = updateItemSchema.parse(req.body);
    const item = await prisma.cartItem.findUnique({
      where: { id: req.params.itemId },
      include: { cart: true },
    });
    if (!item || item.cart.userId !== req.user!.id) {
      return res.status(404).json({ error: 'Cart item not found' });
    }
    await validateProductAndCombo(item.productId, item.variationComboId ?? undefined, body.quantity);

    await prisma.cartItem.update({
      where: { id: item.id },
      data: { quantity: body.quantity },
    });
    await prisma.cart.update({
      where: { id: item.cartId },
      data: { abandonedAt: null },
    });

    const fresh = await getOrCreateCart(req.user!.id);
    res.json(serializeCart(fresh));
  } catch (e) {
    if (e instanceof HttpError) return res.status(e.status).json({ error: e.message });
    if (e instanceof z.ZodError) return res.status(400).json({ error: 'Invalid input', details: e.errors });
    next(e);
  }
});

router.delete('/items/:itemId', async (req, res, next) => {
  try {
    const item = await prisma.cartItem.findUnique({
      where: { id: req.params.itemId },
      include: { cart: true },
    });
    if (!item || item.cart.userId !== req.user!.id) {
      return res.status(404).json({ error: 'Cart item not found' });
    }
    await prisma.cartItem.delete({ where: { id: item.id } });

    const fresh = await getOrCreateCart(req.user!.id);
    res.json(serializeCart(fresh));
  } catch (e) {
    next(e);
  }
});

router.delete('/', async (req, res, next) => {
  try {
    const cart = await prisma.cart.findUnique({ where: { userId: req.user!.id } });
    if (cart) {
      await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    }
    const fresh = await getOrCreateCart(req.user!.id);
    res.json(serializeCart(fresh));
  } catch (e) {
    next(e);
  }
});

const mergeSchema = z.object({
  items: z.array(addItemSchema).max(50),
});

router.post('/merge', async (req, res, next) => {
  try {
    const body = mergeSchema.parse(req.body);
    const cart = await prisma.cart.upsert({
      where: { userId: req.user!.id },
      update: { abandonedAt: null },
      create: { userId: req.user!.id },
    });

    for (const incoming of body.items) {
      try {
        await validateProductAndCombo(incoming.productId, incoming.variationComboId, incoming.quantity);
      } catch {
        continue;
      }
      const existing = await prisma.cartItem.findFirst({
        where: {
          cartId: cart.id,
          productId: incoming.productId,
          variationComboId: incoming.variationComboId ?? null,
        },
      });
      if (existing) {
        const desired = Math.max(existing.quantity, incoming.quantity);
        await prisma.cartItem.update({ where: { id: existing.id }, data: { quantity: desired } });
      } else {
        await prisma.cartItem.create({
          data: {
            cartId: cart.id,
            productId: incoming.productId,
            variationComboId: incoming.variationComboId,
            quantity: incoming.quantity,
          },
        });
      }
    }

    const fresh = await getOrCreateCart(req.user!.id);
    res.json(serializeCart(fresh));
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ error: 'Invalid input', details: e.errors });
    next(e);
  }
});

export default router;
