import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { Permission, AttributeInputType } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { requireAuth, requirePermission } from '../middleware/auth';
import { uploadBuffer } from '../lib/cloudinary';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

const categorySchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens only'),
  description: z.string().optional(),
  sortOrder: z.coerce.number().int().nonnegative().optional(),
  parentId:        z.string().uuid().nullable().optional(),
  imageUrl:        z.string().url().max(500).nullable().optional(),
  iconUrl:         z.string().url().max(500).nullable().optional(),
  featured:        z.boolean().optional(),
  metaTitle:       z.string().max(160).nullable().optional(),
  metaDescription: z.string().max(320).nullable().optional(),
  metaImageUrl:    z.string().url().max(500).nullable().optional(),
  promoImageUrl:   z.string().url().max(500).nullable().optional(),
  promoLinkUrl:    z.string().max(500).nullable().optional(),
  promoLabel:      z.string().max(120).nullable().optional(),
});

const categoryUpdateSchema = categorySchema.partial().extend({
  isActive: z.boolean().optional(),
});

// Enforce the 2-level cap: a category can be a root (parentId null) or a child
// of a root, but not a child of a child.
async function validateParent(parentId: string | null | undefined, selfId?: string) {
  if (!parentId) return null;
  if (selfId && parentId === selfId) {
    return { error: 'A category cannot be its own parent' };
  }
  const parent = await prisma.category.findUnique({
    where: { id: parentId },
    select: { id: true, parentId: true },
  });
  if (!parent) return { error: 'Parent category not found' };
  if (parent.parentId) {
    return { error: 'Categories are limited to 2 levels — parent must be a top-level category' };
  }
  // If editing, also ensure this category has no children of its own (otherwise
  // making it a child would create a 3-level chain).
  if (selfId) {
    const childCount = await prisma.category.count({ where: { parentId: selfId } });
    if (childCount > 0) {
      return { error: 'This category has subcategories — move or delete them before assigning a parent' };
    }
  }
  return null;
}

const attributeSchema = z.object({
  name: z.string().min(1).max(100),
  inputType: z.nativeEnum(AttributeInputType).default(AttributeInputType.SELECT),
  isRequired: z.boolean().default(false),
  sortOrder: z.coerce.number().int().nonnegative().optional(),
});

const optionSchema = z.object({
  value: z.string().min(1).max(100),
  sortOrder: z.coerce.number().int().nonnegative().optional(),
});

// ─── Categories ───────────────────────────────────────────────────────────────

// GET /api/categories — public, active only (flat — frontend builds the tree)
router.get('/', async (_req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      where: { isActive: true, approvalStatus: 'APPROVED' },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true, name: true, slug: true, description: true, sortOrder: true,
        parentId: true, imageUrl: true, iconUrl: true, featured: true,
      },
    });
    res.json(categories);
  } catch (e) {
    next(e);
  }
});

// GET /api/categories/tree — public, nested. For mega-menus and storefront sidebars.
router.get('/tree', async (_req, res, next) => {
  try {
    const all = await prisma.category.findMany({
      where: { isActive: true, approvalStatus: 'APPROVED' },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true, name: true, slug: true, description: true, sortOrder: true,
        parentId: true, imageUrl: true, iconUrl: true, featured: true,
      },
    });
    const roots = all.filter((c) => !c.parentId)
      .map((c) => ({ ...c, children: all.filter((x) => x.parentId === c.id) }));
    res.json(roots);
  } catch (e) {
    next(e);
  }
});

// GET /api/categories/by-slug/:slug — public, single category by slug (used by /c/[slug] landing)
router.get('/by-slug/:slug', async (req, res, next) => {
  try {
    const cat = await prisma.category.findUnique({
      where: { slug: req.params.slug },
      include: {
        parent:   { select: { id: true, name: true, slug: true } },
        children: { where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] },
      },
    });
    if (!cat || !cat.isActive || cat.approvalStatus !== 'APPROVED') return res.status(404).json({ error: 'Not found' });
    res.json(cat);
  } catch (e) {
    next(e);
  }
});

// GET /api/categories/all — admin only, includes inactive
router.get('/all', requireAuth, requirePermission(Permission.CATEGORY_MANAGE), async (_req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { products: true } } },
    });
    res.json(categories);
  } catch (e) {
    next(e);
  }
});

// POST /api/categories — admin
router.post('/', requireAuth, requirePermission(Permission.CATEGORY_MANAGE), async (req, res, next) => {
  try {
    const data = categorySchema.parse(req.body);
    const parentErr = await validateParent(data.parentId);
    if (parentErr) return res.status(400).json(parentErr);
    const category = await prisma.category.create({ data });
    res.status(201).json(category);
  } catch (e) {
    next(e);
  }
});

// PUT /api/categories/:id — admin
router.put('/:id', requireAuth, requirePermission(Permission.CATEGORY_MANAGE), async (req, res, next) => {
  try {
    const data = categoryUpdateSchema.parse(req.body);
    if (data.parentId !== undefined) {
      const parentErr = await validateParent(data.parentId, req.params.id);
      if (parentErr) return res.status(400).json(parentErr);
    }
    const category = await prisma.category.update({
      where: { id: req.params.id },
      data,
    });
    res.json(category);
  } catch (e) {
    next(e);
  }
});

// DELETE /api/categories/:id — admin, only if no products and no children
router.delete('/:id', requireAuth, requirePermission(Permission.CATEGORY_MANAGE), async (req, res, next) => {
  try {
    const [productCount, childCount] = await Promise.all([
      prisma.product.count({ where: { categoryId: req.params.id } }),
      prisma.category.count({ where: { parentId: req.params.id } }),
    ]);
    if (productCount > 0) {
      return res.status(409).json({
        error: `Cannot delete: ${productCount} product(s) are assigned to this category. Deactivate it instead.`,
      });
    }
    if (childCount > 0) {
      return res.status(409).json({
        error: `Cannot delete: ${childCount} subcategor${childCount === 1 ? 'y is' : 'ies are'} nested under this category. Move or delete them first.`,
      });
    }
    await prisma.category.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

// ─── Attributes ───────────────────────────────────────────────────────────────

// GET /api/categories/:id/attributes — public, includes options
// ?includeAncestors=1 walks up the parent chain so a leaf inherits its parent's attributes.
router.get('/:id/attributes', async (req, res, next) => {
  try {
    const includeAncestors = req.query.includeAncestors === '1' || req.query.includeAncestors === 'true';
    const ids: string[] = [req.params.id];
    if (includeAncestors) {
      const self = await prisma.category.findUnique({
        where: { id: req.params.id },
        select: { parentId: true },
      });
      if (self?.parentId) ids.push(self.parentId);
    }
    const attributes = await prisma.categoryAttribute.findMany({
      where: { categoryId: { in: ids } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        options: { orderBy: [{ sortOrder: 'asc' }, { value: 'asc' }] },
      },
    });
    // De-dupe by name when a child redefines a parent attribute — child wins.
    const byName = new Map<string, typeof attributes[number]>();
    for (const a of attributes) {
      const existing = byName.get(a.name);
      if (!existing || a.categoryId === req.params.id) byName.set(a.name, a);
    }
    res.json([...byName.values()]);
  } catch (e) {
    next(e);
  }
});

// POST /api/categories/:id/attributes — admin
router.post('/:id/attributes', requireAuth, requirePermission(Permission.CATEGORY_MANAGE), async (req, res, next) => {
  try {
    const data = attributeSchema.parse(req.body);
    const attribute = await prisma.categoryAttribute.create({
      data: { ...data, categoryId: req.params.id },
      include: { options: true },
    });
    res.status(201).json(attribute);
  } catch (e) {
    next(e);
  }
});

// PUT /api/categories/attributes/:attrId — admin
router.put('/attributes/:attrId', requireAuth, requirePermission(Permission.CATEGORY_MANAGE), async (req, res, next) => {
  try {
    const data = attributeSchema.partial().parse(req.body);
    const attribute = await prisma.categoryAttribute.update({
      where: { id: req.params.attrId },
      data,
      include: { options: true },
    });
    res.json(attribute);
  } catch (e) {
    next(e);
  }
});

// DELETE /api/categories/attributes/:attrId — admin (cascades to options + product values)
router.delete('/attributes/:attrId', requireAuth, requirePermission(Permission.CATEGORY_MANAGE), async (req, res, next) => {
  try {
    await prisma.categoryAttribute.delete({ where: { id: req.params.attrId } });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

// ─── Attribute Options ────────────────────────────────────────────────────────

// POST /api/categories/attributes/:attrId/options — admin
router.post('/attributes/:attrId/options', requireAuth, requirePermission(Permission.CATEGORY_MANAGE), async (req, res, next) => {
  try {
    const data = optionSchema.parse(req.body);
    const option = await prisma.categoryAttributeOption.create({
      data: { ...data, attributeId: req.params.attrId },
    });
    res.status(201).json(option);
  } catch (e) {
    next(e);
  }
});

// PUT /api/categories/attributes/options/:optId — admin
router.put('/attributes/options/:optId', requireAuth, requirePermission(Permission.CATEGORY_MANAGE), async (req, res, next) => {
  try {
    const data = optionSchema.partial().parse(req.body);
    const option = await prisma.categoryAttributeOption.update({
      where: { id: req.params.optId },
      data,
    });
    res.json(option);
  } catch (e) {
    next(e);
  }
});

// DELETE /api/categories/attributes/options/:optId — admin
router.delete('/attributes/options/:optId', requireAuth, requirePermission(Permission.CATEGORY_MANAGE), async (req, res, next) => {
  try {
    await prisma.categoryAttributeOption.delete({ where: { id: req.params.optId } });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

// ─── Mega-menu sections ──────────────────────────────────────────────────────

const menuSectionSchema = z.object({
  title: z.string().min(1).max(120),
  sortOrder: z.coerce.number().int().nonnegative().optional(),
});
const menuItemSchema = z.object({
  label:    z.string().min(1).max(120),
  href:     z.string().min(1).max(500),
  iconUrl:  z.string().url().max(500).nullable().optional(),
  sortOrder: z.coerce.number().int().nonnegative().optional(),
});

// GET /api/categories/menu/:slug — public, returns top-level category + nested sections + promo
router.get('/menu/:slug', async (req, res, next) => {
  try {
    const cat = await prisma.category.findUnique({
      where: { slug: req.params.slug },
      include: {
        children: { where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] },
        menuSections: {
          orderBy: { sortOrder: 'asc' },
          include: { items: { orderBy: { sortOrder: 'asc' } } },
        },
      },
    });
    if (!cat || !cat.isActive || cat.approvalStatus !== 'APPROVED') return res.status(404).json({ error: 'Not found' });
    res.json(cat);
  } catch (e) { next(e); }
});

// POST /api/categories/:id/menu-sections — admin
router.post('/:id/menu-sections', requireAuth, requirePermission(Permission.CATEGORY_MANAGE), async (req, res, next) => {
  try {
    const data = menuSectionSchema.parse(req.body);
    const section = await prisma.categoryMenuSection.create({
      data: { ...data, categoryId: req.params.id },
      include: { items: true },
    });
    res.status(201).json(section);
  } catch (e) { next(e); }
});

// PUT /api/categories/menu-sections/:id — admin
router.put('/menu-sections/:id', requireAuth, requirePermission(Permission.CATEGORY_MANAGE), async (req, res, next) => {
  try {
    const data = menuSectionSchema.partial().parse(req.body);
    const section = await prisma.categoryMenuSection.update({
      where: { id: req.params.id }, data,
    });
    res.json(section);
  } catch (e) { next(e); }
});

// DELETE /api/categories/menu-sections/:id — admin
router.delete('/menu-sections/:id', requireAuth, requirePermission(Permission.CATEGORY_MANAGE), async (req, res, next) => {
  try {
    await prisma.categoryMenuSection.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (e) { next(e); }
});

// POST /api/categories/menu-sections/:id/items — admin
router.post('/menu-sections/:id/items', requireAuth, requirePermission(Permission.CATEGORY_MANAGE), async (req, res, next) => {
  try {
    const data = menuItemSchema.parse(req.body);
    const item = await prisma.categoryMenuItem.create({
      data: { ...data, sectionId: req.params.id },
    });
    res.status(201).json(item);
  } catch (e) { next(e); }
});

// PUT /api/categories/menu-items/:id — admin
router.put('/menu-items/:id', requireAuth, requirePermission(Permission.CATEGORY_MANAGE), async (req, res, next) => {
  try {
    const data = menuItemSchema.partial().parse(req.body);
    const item = await prisma.categoryMenuItem.update({ where: { id: req.params.id }, data });
    res.json(item);
  } catch (e) { next(e); }
});

// DELETE /api/categories/menu-items/:id — admin
router.delete('/menu-items/:id', requireAuth, requirePermission(Permission.CATEGORY_MANAGE), async (req, res, next) => {
  try {
    await prisma.categoryMenuItem.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (e) { next(e); }
});

// POST /api/categories/upload-image — admin, returns a Cloudinary URL
// Lets the admin UI upload a hero/icon image then save the resulting URL via PUT.
router.post(
  '/upload-image',
  requireAuth,
  requirePermission(Permission.CATEGORY_MANAGE),
  upload.single('image'),
  async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No image provided' });
      const url = await uploadBuffer(req.file.buffer, 'categories');
      res.json({ url });
    } catch (e) { next(e); }
  },
);

export default router;
