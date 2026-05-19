import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import {
  Role, VendorStatus, ItemType, WhoMade, ProductType, RenewalMode, ProductStatus,
  JewelleryType, Purity, Gender, MakingChargeType,
} from '@prisma/client';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';
import { uploadBuffer } from '../lib/cloudinary';
import { indexProduct, removeProductFromIndex } from '../lib/algolia';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 8 },
});

// Helpers for multipart-form parsing
const jsonArr = <T extends z.ZodTypeAny>(item: T) =>
  z.preprocess(
    (v) => {
      if (v === undefined || v === '') return undefined;
      if (typeof v === 'string') { try { return JSON.parse(v); } catch { return v; } }
      return v;
    },
    z.array(item).optional()
  );
const coerceBool = z.preprocess(
  (v) => (typeof v === 'string' ? v === 'true' || v === '1' : v),
  z.boolean().optional()
);
const optInt = z.preprocess(
  (v) => (v === '' || v === undefined ? undefined : Number(v)),
  z.number().int().optional()
);
const jsonObj = z.preprocess(
  (v) => {
    if (v === undefined || v === '') return undefined;
    if (typeof v === 'string') { try { return JSON.parse(v); } catch { return undefined; } }
    return v;
  },
  z.object({
    enabled: z.boolean().optional(),
    instructions: z.string().max(256).optional(),
    charLimit: z.number().int().min(1).max(1024).optional(),
  }).optional()
);

const productInputSchema = z.object({
  name: z.string().min(2),
  brand: z.string().max(60).optional(),
  description: z.string().optional(),
  categoryId: z.string().uuid(),
  metalType: z.string().optional(),
  price: z.coerce.number().positive(),
  stockQuantity: z.coerce.number().int().nonnegative(),
  attributeValues: jsonArr(z.object({ attributeId: z.string(), value: z.string() })),

  // Polish fields
  imageAlts:      jsonArr(z.string().max(160)),
  highlights:     jsonArr(z.string().min(1).max(120)),
  warranty:       z.string().max(200).optional(),
  seoTitle:       z.string().max(120).optional(),
  seoDescription: z.string().max(320).optional(),

  // Phase-2 listing taxonomy
  itemType:        z.nativeEnum(ItemType).optional(),
  whenMade:        z.string().max(40).optional(),
  whoMade:         z.nativeEnum(WhoMade).optional(),
  productType:     z.nativeEnum(ProductType).optional(),
  status:          z.nativeEnum(ProductStatus).optional(),
  renewalMode:     z.nativeEnum(RenewalMode).optional(),
  tags:            jsonArr(z.string().min(1).max(30)),
  materials:       jsonArr(z.string().min(1).max(60)),
  sku:             z.string().max(60).optional(),
  acceptsOffers:   coerceBool,
  featured:        coerceBool,
  personalization: jsonObj,
  processingMin:   optInt,
  processingMax:   optInt,
  weightGrams:     optInt,
  lengthMm:        optInt,
  widthMm:         optInt,
  heightMm:        optInt,
  shippingMethodDefaultId: z.string().uuid().optional().or(z.literal('')),
  shopSectionId:           z.string().uuid().optional().or(z.literal('')),
  returnPolicyId:          z.string().uuid().optional().or(z.literal('')),
  videoUrl:                z.string().url().max(500).optional().or(z.literal('')),

  // Jewellery identity & compliance
  jewelleryType:      z.nativeEnum(JewelleryType).optional(),
  purity:             z.nativeEnum(Purity).optional(),
  gender:             z.nativeEnum(Gender).optional(),
  baseMetal:          z.string().max(60).optional(),
  plating:            z.string().max(60).optional(),
  grossWeightGrams:   z.coerce.number().nonnegative().optional(),
  netWeightGrams:     z.coerce.number().nonnegative().optional(),
  makingChargeType:   z.nativeEnum(MakingChargeType).optional(),
  makingChargeValue:  z.coerce.number().nonnegative().optional(),
  wastagePercent:     z.coerce.number().min(0).max(100).optional(),
  hallmarked:         coerceBool,
  certifiedBy:        z.string().max(40).optional(),
  certificateNumber:  z.string().max(80).optional(),
  hsnCode:            z.string().max(20).optional(),
  gstRatePercent:     z.coerce.number().min(0).max(100).optional(),
  countryOfOrigin:    z.string().max(40).optional(),
  careInstructions:   z.string().max(1000).optional(),
  antiTarnish:        coerceBool,
  nickelFree:         coerceBool,
  hypoallergenic:     coerceBool,
  leadFree:           coerceBool,

  // Variations: parsed from a JSON string in multipart form.
  // Variation/option ids in the payload are CLIENT-GENERATED tokens (not UUIDs)
  // that the combos reference; the server re-issues real UUIDs and rebuilds combos.
  variations: jsonArr(z.object({
    name: z.string().min(1).max(40),
    options: z.array(z.object({
      tempId: z.string().min(1),
      value:  z.string().min(1).max(60),
    })).min(1).max(20),
  })),
  combos: jsonArr(z.object({
    optionTempIds: z.array(z.string().min(1)).min(1).max(8),
    price: z.coerce.number().nonnegative().optional(),
    stock: z.coerce.number().int().nonnegative().default(0),
    sku:   z.string().max(60).optional(),
  })),
});

const categoryInclude = { select: { id: true, name: true, slug: true } };
const attributeValuesInclude = {
  include: { attribute: { select: { id: true, name: true, inputType: true } } },
};

// PUBLIC: list active products with filters
router.get('/', async (req, res) => {
  const { category, metalType, q, vendorId, page = '1', limit = '20' } = req.query as Record<string, string>;
  const take = Math.min(parseInt(limit) || 20, 100);
  const skip = (Math.max(parseInt(page) || 1, 1) - 1) * take;

  const where: any = { isActive: true, vendor: { status: VendorStatus.APPROVED } };

  if (category) {
    // Accept either a UUID or a slug. Match the category AND any of its children
    // (2-level hierarchy capped by category-route validation).
    const isUuid = /^[0-9a-f-]{36}$/.test(category);
    const cat = isUuid
      ? await prisma.category.findUnique({ where: { id: category }, select: { id: true } })
      : await prisma.category.findUnique({ where: { slug: category }, select: { id: true } });
    if (cat) {
      const children = await prisma.category.findMany({
        where: { parentId: cat.id },
        select: { id: true },
      });
      const ids = [cat.id, ...children.map((c) => c.id)];
      where.categoryId = ids.length === 1 ? ids[0] : { in: ids };
    }
  }

  if (metalType) where.metalType = metalType;
  if (vendorId) {
    const { resolveVendorId } = await import('../lib/vendor-slug');
    const resolved = await resolveVendorId(vendorId);
    if (!resolved) return res.json({ items: [], total: 0, page: parseInt(page) || 1, limit: parseInt(limit) || 20 });
    where.vendorId = resolved;
  }
  if (q) where.name = { contains: q, mode: 'insensitive' };

  // Mega-menu filter shortcuts
  const { purity, stone, priceMin, priceMax, gender, jewelleryType, collection } = req.query as Record<string, string>;
  if (purity) where.purity = purity;
  if (gender) where.gender = gender;
  if (jewelleryType) where.jewelleryType = jewelleryType;
  if (stone) {
    // Match `materials[]` (covers fashion stone tags) OR a "Stone" attribute value
    where.OR = [
      { materials: { has: stone } },
      { attributeValues: { some: { attribute: { name: { contains: 'Stone', mode: 'insensitive' } }, value: stone } } },
    ];
  }
  if (priceMin || priceMax) {
    where.price = {};
    if (priceMin) (where.price as any).gte = Number(priceMin);
    if (priceMax) (where.price as any).lte = Number(priceMax);
  }
  if (collection) {
    where.collections = { some: { slug: collection } };
  }
  const section = (req.query as Record<string, string>).section;
  if (section) where.shopSection = { slug: section };
  const sectionId = (req.query as Record<string, string>).sectionId;
  if (sectionId) where.shopSectionId = sectionId;
  const ids = (req.query as Record<string, string>).ids;
  if (ids) {
    const idList = ids.split(',').map((s) => s.trim()).filter(Boolean);
    if (idList.length) where.id = { in: idList };
  }

  // Generic category-attribute filter: ?attr=Diamond+Cut:Round,Emerald&attr=Setting+Type:Bezel
  // Each entry becomes an AND clause (different attributes must all match);
  // values within one attribute are OR'd.
  const attrQuery = req.query.attr;
  const attrPairs = Array.isArray(attrQuery) ? attrQuery : attrQuery ? [attrQuery] : [];
  const attrAnds: any[] = [];
  for (const raw of attrPairs as string[]) {
    if (typeof raw !== 'string') continue;
    const idx = raw.indexOf(':');
    if (idx < 1) continue;
    const name = raw.slice(0, idx).trim();
    const values = raw.slice(idx + 1).split(',').map((s) => s.trim()).filter(Boolean);
    if (!name || values.length === 0) continue;
    attrAnds.push({
      attributeValues: {
        some: { attribute: { name }, value: { in: values } },
      },
    });
  }
  if (attrAnds.length > 0) {
    where.AND = [...(where.AND ?? []), ...attrAnds];
  }

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        vendor: { select: { id: true, slug: true, shopName: true } },
        category: categoryInclude,
        attributeValues: attributeValuesInclude,
        variationCombos: { select: { price: true } },
      },
    }),
    prisma.product.count({ where }),
  ]);
  res.json({ items, total, page: parseInt(page) || 1, limit: take });
});

// PUBLIC: related products — same category, similar price band, exclude self.
router.get('/:id/related', async (req, res, next) => {
  try {
    const base = await prisma.product.findUnique({
      where: { id: req.params.id },
      select: { id: true, categoryId: true, price: true, vendorId: true, isActive: true, status: true },
    });
    if (!base || !base.isActive) return res.json({ items: [] });

    const basePrice = Number(base.price);
    const lo = basePrice * 0.5;
    const hi = basePrice * 1.8;

    const items = await prisma.product.findMany({
      where: {
        id: { not: base.id },
        categoryId: base.categoryId,
        isActive: true,
        status: 'ACTIVE',
        price: { gte: lo, lte: hi },
      },
      take: 12,
      orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
      include: {
        vendor: { select: { id: true, slug: true, shopName: true } },
        category: categoryInclude,
        variationCombos: { select: { price: true } },
      },
    });
    res.json({ items });
  } catch (e) { next(e); }
});

// PUBLIC: lookup multiple products by id (for recently-viewed hydration).
router.post('/by-ids', async (req, res, next) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((x: unknown) => typeof x === 'string').slice(0, 24) : [];
    if (ids.length === 0) return res.json({ items: [] });
    const items = await prisma.product.findMany({
      where: { id: { in: ids }, isActive: true, status: 'ACTIVE' },
      include: {
        vendor: { select: { id: true, slug: true, shopName: true } },
        category: categoryInclude,
        variationCombos: { select: { price: true } },
      },
    });
    // Preserve input order
    const map = new Map(items.map((p) => [p.id, p]));
    const ordered = ids.map((id: string) => map.get(id)).filter(Boolean);
    res.json({ items: ordered });
  } catch (e) { next(e); }
});

// PUBLIC: product detail
router.get('/:id', async (req, res) => {
  const key = req.params.id;
  const isUuid = /^[0-9a-f-]{36}$/.test(key);
  const product = await prisma.product.findUnique({
    where: isUuid ? { id: key } : { slug: key },
    include: {
      vendor: { select: { id: true, slug: true, shopName: true, shopLogoUrl: true } },
      category: categoryInclude,
      attributeValues: attributeValuesInclude,
      variations: {
        include: { options: { orderBy: { position: 'asc' } } },
        orderBy: { position: 'asc' },
      },
      variationCombos: true,
      shopSection:  { select: { id: true, name: true, slug: true } },
      returnPolicy: { select: { id: true, name: true, accepted: true, days: true, buyerPaysReturn: true, notes: true } },
    },
  });
  if (!product || !product.isActive) return res.status(404).json({ error: 'Not found' });
  res.json(product);
});

// VENDOR: list own products
router.get('/vendor/mine', requireAuth, requireRole(Role.VENDOR), async (req, res) => {
  const vendor = await prisma.vendor.findUnique({ where: { userId: req.user!.id } });
  if (!vendor) return res.status(404).json({ error: 'Vendor profile not created' });
  const products = await prisma.product.findMany({
    where: { vendorId: vendor.id },
    orderBy: { createdAt: 'desc' },
    include: {
      category: categoryInclude,
      attributeValues: attributeValuesInclude,
      vendor: { select: { slug: true } },
    },
  });
  res.json(products);
});

// VENDOR: get own product by id — returns drafts/inactive too (used by the listing editor)
router.get('/vendor/:id', requireAuth, requireRole(Role.VENDOR), async (req, res) => {
  const vendor = await prisma.vendor.findUnique({ where: { userId: req.user!.id } });
  if (!vendor) return res.status(404).json({ error: 'Vendor profile not created' });
  const product = await prisma.product.findUnique({
    where: { id: req.params.id },
    include: {
      vendor: { select: { id: true, slug: true, shopName: true, shopLogoUrl: true } },
      category: categoryInclude,
      attributeValues: attributeValuesInclude,
      variations: {
        include: { options: { orderBy: { position: 'asc' } } },
        orderBy: { position: 'asc' },
      },
      variationCombos: true,
      shopSection:  { select: { id: true, name: true, slug: true } },
      returnPolicy: { select: { id: true, name: true, accepted: true, days: true, buyerPaysReturn: true, notes: true } },
    },
  });
  if (!product || product.vendorId !== vendor.id) {
    return res.status(404).json({ error: 'Product not found' });
  }
  res.json(product);
});

// Slugify + ensure uniqueness against the Product table.
function slugifyProduct(name: string) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'product';
}
async function uniqueProductSlug(base: string, excludeId?: string): Promise<string> {
  let slug = slugifyProduct(base);
  let i = 1;
  while (true) {
    const existing = await prisma.product.findUnique({ where: { slug } });
    if (!existing || existing.id === excludeId) break;
    i += 1;
    slug = `${slugifyProduct(base)}-${i}`;
  }
  return slug;
}

// VENDOR: create product (with up to 6 images + optional certificate scan)
router.post(
  '/',
  requireAuth,
  requireRole(Role.VENDOR),
  upload.fields([{ name: 'images', maxCount: 6 }, { name: 'certificate', maxCount: 1 }]),
  async (req, res) => {
    const parsed = productInputSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const vendor = await prisma.vendor.findUnique({ where: { userId: req.user!.id } });
    if (!vendor) return res.status(404).json({ error: 'Vendor profile not created' });
    if (vendor.status !== VendorStatus.APPROVED) {
      return res.status(403).json({ error: 'Vendor not approved yet' });
    }
    if (vendor.kycStatus !== 'VERIFIED') {
      return res.status(403).json({ error: 'KYC not verified — complete onboarding before listing' });
    }

    const fileMap = (req.files as Record<string, Express.Multer.File[]>) || {};
    const files = fileMap.images || [];
    const certFile = fileMap.certificate?.[0];
    if (files.length === 0) {
      return res.status(400).json({ error: 'At least one image is required' });
    }

    // Verify category exists, is active, and approved (vendor-proposed categories
    // can only be used once the admin approves them).
    const category = await prisma.category.findUnique({ where: { id: parsed.data.categoryId } });
    if (!category || !category.isActive || category.approvalStatus !== 'APPROVED') {
      return res.status(400).json({ error: 'Invalid or unapproved category' });
    }

    try {
      const imageUrls = await Promise.all(files.map((f) => uploadBuffer(f.buffer, 'products')));
      const certificateImageUrl = certFile ? await uploadBuffer(certFile.buffer, 'certificates') : undefined;
      const slug = await uniqueProductSlug(parsed.data.name);
      const {
        attributeValues, shippingMethodDefaultId, shopSectionId, returnPolicyId,
        tags, materials, variations, combos, videoUrl,
        hsnCode, countryOfOrigin, certifiedBy, certificateNumber,
        baseMetal, plating, careInstructions,
        imageAlts, highlights, brand, warranty, seoTitle, seoDescription,
        ...productData
      } = parsed.data;

      // Validate combos reference known option tempIds
      if (combos && combos.length > 0) {
        const validTempIds = new Set(
          (variations ?? []).flatMap((v) => v.options.map((o) => o.tempId))
        );
        for (const c of combos) {
          if (c.optionTempIds.some((id) => !validTempIds.has(id))) {
            return res.status(400).json({ error: 'Combo references unknown variation option' });
          }
        }
      }

      // Wrap product create, variations create, and combos create in a transaction
      // so a partial failure doesn't leave orphaned variations.
      const product = await prisma.$transaction(async (tx) => {
        const created = await tx.product.create({
          data: {
            ...productData,
            slug,
            tags:      tags ?? [],
            materials: materials ?? [],
            imageAlts: (imageAlts ?? []).slice(0, imageUrls.length),
            highlights: highlights ?? [],
            shippingMethodDefaultId: shippingMethodDefaultId || null,
            shopSectionId:           shopSectionId  || null,
            returnPolicyId:          returnPolicyId || null,
            ...(brand ? { brand } : {}),
            ...(warranty ? { warranty } : {}),
            ...(seoTitle ? { seoTitle } : {}),
            ...(seoDescription ? { seoDescription } : {}),
            ...(certificateImageUrl ? { certificateImageUrl } : {}),
            ...(videoUrl ? { videoUrl } : {}),
            ...(baseMetal ? { baseMetal } : {}),
            ...(plating ? { plating } : {}),
            ...(certifiedBy ? { certifiedBy } : {}),
            ...(certificateNumber ? { certificateNumber } : {}),
            ...(careInstructions ? { careInstructions } : {}),
            ...(hsnCode ? { hsnCode } : {}),
            ...(countryOfOrigin ? { countryOfOrigin } : {}),
            vendorId: vendor.id,
            images: imageUrls,
            ...(attributeValues?.length
              ? {
                  attributeValues: {
                    create: attributeValues.map((av) => ({
                      attributeId: av.attributeId,
                      value: av.value,
                    })),
                  },
                }
              : {}),
          },
        });

        // Create variations + options, mapping each tempId → real option uuid
        const tempIdToOptionId = new Map<string, string>();
        if (variations && variations.length > 0) {
          for (let vIdx = 0; vIdx < variations.length; vIdx++) {
            const v = variations[vIdx];
            const variation = await tx.productVariation.create({
              data: {
                productId: created.id,
                name: v.name,
                position: vIdx,
                options: {
                  create: v.options.map((o, oIdx) => ({
                    value: o.value,
                    position: oIdx,
                  })),
                },
              },
              include: { options: { orderBy: { position: 'asc' } } },
            });
            // Match by position (set above) so tempIds line up with created options
            // even when Postgres returns rows in a different physical order.
            v.options.forEach((o, oIdx) => {
              const created = variation.options.find((opt) => opt.position === oIdx);
              if (created) tempIdToOptionId.set(o.tempId, created.id);
            });
          }
        }

        if (combos && combos.length > 0) {
          await tx.productVariationCombo.createMany({
            data: combos.map((c) => ({
              productId: created.id,
              optionIds: c.optionTempIds.map((tid) => tempIdToOptionId.get(tid)!).filter(Boolean),
              price: c.price !== undefined ? c.price : null,
              stock: c.stock,
              sku:   c.sku || null,
            })),
          });
        }

        return tx.product.findUnique({
          where: { id: created.id },
          include: {
            category: categoryInclude,
            attributeValues: attributeValuesInclude,
            variations: { include: { options: true }, orderBy: { position: 'asc' } },
            variationCombos: true,
          },
        });
      });

      if (product) indexProduct(product.id).catch((e) => console.error('[algolia] index failed', e));
      res.status(201).json(product);
    } catch (err) {
      console.error('Product creation failed', err);
      res.status(500).json({ error: 'Product creation failed' });
    }
  }
);

// VENDOR: update own product (multipart — supports images, variations, etc.)
router.put(
  '/:id',
  requireAuth,
  requireRole(Role.VENDOR),
  upload.fields([{ name: 'images', maxCount: 6 }, { name: 'certificate', maxCount: 1 }]),
  async (req, res) => {
    const vendor = await prisma.vendor.findUnique({ where: { userId: req.user!.id } });
    if (!vendor) return res.status(404).json({ error: 'Vendor profile not created' });

    const product = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!product || product.vendorId !== vendor.id) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const updateSchema = productInputSchema
      .omit({ attributeValues: true })
      .partial()
      .extend({
        isActive: z.preprocess(
          (v) => (typeof v === 'string' ? v === 'true' || v === '1' : v),
          z.boolean().optional(),
        ),
        attributeValues: z.preprocess(
          (v) => (typeof v === 'string' ? JSON.parse(v) : v),
          z.array(z.object({ attributeId: z.string(), value: z.string() })).optional(),
        ),
        keepImages: z.preprocess(
          (v) => (typeof v === 'string' ? JSON.parse(v) : v),
          z.array(z.string().url()).optional(),
        ),
      });

    console.log('[PUT /products] raw req.body keys:', Object.keys(req.body));
    console.log('[PUT /products] raw variations field:', req.body.variations);
    console.log('[PUT /products] raw combos field:', req.body.combos);

    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      console.error('[PUT /products] zod validation failed:', JSON.stringify(parsed.error.flatten(), null, 2));
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const {
      attributeValues, shippingMethodDefaultId, shopSectionId, returnPolicyId,
      tags, materials, variations, combos, keepImages, videoUrl,
      hsnCode, countryOfOrigin, certifiedBy, certificateNumber,
      baseMetal, plating, careInstructions,
      imageAlts, highlights, brand, warranty, seoTitle, seoDescription,
      ...productData
    } = parsed.data;

    console.log('[PUT /products] parsed variations:', JSON.stringify(variations));
    console.log('[PUT /products] parsed combos:', JSON.stringify(combos));

    // Validate combos reference known option tempIds (only when both supplied)
    if (combos && combos.length > 0 && variations) {
      const validTempIds = new Set(variations.flatMap((v) => v.options.map((o) => o.tempId)));
      for (const c of combos) {
        if (c.optionTempIds.some((id) => !validTempIds.has(id))) {
          return res.status(400).json({ error: 'Combo references unknown variation option' });
        }
      }
    }

    try {
      // Regenerate slug when the product name changes or the current slug was
      // auto-generated from an old "Copy of …" name and now needs updating.
      const incomingName = productData.name?.trim();
      const nameChanged = incomingName && incomingName !== product.name.trim();
      const slugLooksStale = product.slug?.startsWith('copy-of-');
      let newSlug: string | undefined;
      if (incomingName && (nameChanged || slugLooksStale)) {
        newSlug = await uniqueProductSlug(incomingName, product.id);
      }

      // Upload any new image files first (before the transaction so Cloudinary
      // failures don't leave a half-applied DB state).
      const fileMap = (req.files as Record<string, Express.Multer.File[]>) || {};
      const files = fileMap.images || [];
      const certFile = fileMap.certificate?.[0];
      const newImageUrls = files.length > 0
        ? await Promise.all(files.map((f) => uploadBuffer(f.buffer, 'products')))
        : [];
      const newCertUrl = certFile ? await uploadBuffer(certFile.buffer, 'certificates') : undefined;

      // Final image list = kept (in submitted order) + newly uploaded.
      // If keepImages was not sent, preserve existing images as-is.
      const finalImages = keepImages !== undefined
        ? [...keepImages, ...newImageUrls]
        : [...product.images, ...newImageUrls];

      if (finalImages.length === 0) {
        return res.status(400).json({ error: 'At least one image is required' });
      }

      const updated = await prisma.$transaction(async (tx) => {
        await tx.product.update({
          where: { id: product.id },
          data: {
            ...productData,
            // When a vendor activates a DRAFT product, promote status to ACTIVE so
            // the cart API (which checks both isActive + status) allows purchases.
            ...(productData.isActive === true && product.status !== 'ACTIVE' ? { status: 'ACTIVE' } : {}),
            ...(newSlug ? { slug: newSlug } : {}),
            images: finalImages,
            ...(tags      !== undefined ? { tags }       : {}),
            ...(materials !== undefined ? { materials }  : {}),
            ...(shippingMethodDefaultId !== undefined ? { shippingMethodDefaultId: shippingMethodDefaultId || null } : {}),
            ...(shopSectionId           !== undefined ? { shopSectionId:           shopSectionId           || null } : {}),
            ...(returnPolicyId          !== undefined ? { returnPolicyId:          returnPolicyId          || null } : {}),
            ...(videoUrl          !== undefined ? { videoUrl:          videoUrl          || null } : {}),
            ...(baseMetal         !== undefined ? { baseMetal:         baseMetal         || null } : {}),
            ...(plating           !== undefined ? { plating:           plating           || null } : {}),
            ...(certifiedBy       !== undefined ? { certifiedBy:       certifiedBy       || null } : {}),
            ...(certificateNumber !== undefined ? { certificateNumber: certificateNumber || null } : {}),
            ...(careInstructions  !== undefined ? { careInstructions:  careInstructions  || null } : {}),
            ...(hsnCode           ? { hsnCode } : {}),
            ...(countryOfOrigin   ? { countryOfOrigin } : {}),
            // Polish fields — all nullable, set to null on explicit empty string.
            ...(brand             !== undefined ? { brand:          brand          || null } : {}),
            ...(warranty          !== undefined ? { warranty:       warranty       || null } : {}),
            ...(seoTitle          !== undefined ? { seoTitle:       seoTitle       || null } : {}),
            ...(seoDescription    !== undefined ? { seoDescription: seoDescription || null } : {}),
            ...(highlights        !== undefined ? { highlights } : {}),
            ...(imageAlts         !== undefined ? { imageAlts: imageAlts.slice(0, finalImages.length) } : {}),
            ...(newCertUrl ? { certificateImageUrl: newCertUrl } : {}),
          },
        });

        // Upsert attribute values
        if (attributeValues?.length) {
          await Promise.all(
            attributeValues.map((av) =>
              tx.productAttributeValue.upsert({
                where: { productId_attributeId: { productId: product.id, attributeId: av.attributeId } },
                update: { value: av.value },
                create: { productId: product.id, attributeId: av.attributeId, value: av.value },
              }),
            ),
          );
        }

        // Replace variations + combos when supplied. Cascade delete on variations
        // also drops options; combos are a sibling table so wipe them explicitly.
        // OrderItem.variationComboId is SetNull on cascade, so historical orders
        // remain intact but lose their combo pointer.
        if (variations !== undefined) {
          await tx.productVariationCombo.deleteMany({ where: { productId: product.id } });
          await tx.productVariation.deleteMany({ where: { productId: product.id } });

          const tempIdToOptionId = new Map<string, string>();
          for (let vIdx = 0; vIdx < variations.length; vIdx++) {
            const v = variations[vIdx];
            const created = await tx.productVariation.create({
              data: {
                productId: product.id,
                name: v.name,
                position: vIdx,
                options: {
                  create: v.options.map((o, oIdx) => ({ value: o.value, position: oIdx })),
                },
              },
              include: { options: { orderBy: { position: 'asc' } } },
            });
            v.options.forEach((o, oIdx) => {
              const created_o = created.options.find((opt) => opt.position === oIdx);
              if (created_o) tempIdToOptionId.set(o.tempId, created_o.id);
            });
          }

          if (combos && combos.length > 0) {
            await tx.productVariationCombo.createMany({
              data: combos.map((c) => ({
                productId: product.id,
                optionIds: c.optionTempIds.map((tid) => tempIdToOptionId.get(tid)!).filter(Boolean),
                price: c.price !== undefined ? c.price : null,
                stock: c.stock,
                sku:   c.sku || null,
              })),
            });
          }
        }

        return tx.product.findUnique({
          where: { id: product.id },
          include: {
            category: categoryInclude,
            attributeValues: attributeValuesInclude,
            variations: { include: { options: { orderBy: { position: 'asc' } } }, orderBy: { position: 'asc' } },
            variationCombos: true,
          },
        });
      });

      console.log(
        '[PUT /products] saved. variations:',
        updated?.variations.length,
        'combos:',
        updated?.variationCombos.length,
      );
      if (updated) indexProduct(updated.id).catch((e) => console.error('[algolia] reindex failed', e));
      res.json(updated);
    } catch (err) {
      console.error('Product update failed', err);
      res.status(500).json({ error: 'Product update failed' });
    }
  },
);

// VENDOR: duplicate own product. Creates a DRAFT copy with "Copy of …" title
// and a fresh unique slug. Variations, options, and attribute values are cloned;
// orders, reviews, and questions are not. Use this to bootstrap near-clones.
router.post('/:id/duplicate', requireAuth, requireRole(Role.VENDOR), async (req, res) => {
  try {
    const vendor = await prisma.vendor.findUnique({ where: { userId: req.user!.id } });
    if (!vendor) return res.status(404).json({ error: 'Vendor profile not created' });

    const src = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: {
        variations: { include: { options: { orderBy: { position: 'asc' } } }, orderBy: { position: 'asc' } },
        variationCombos: true,
        attributeValues: true,
      },
    });
    if (!src || src.vendorId !== vendor.id) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const newName = `Copy of ${src.name}`.slice(0, 140);
    const newSlug = await uniqueProductSlug(newName);

    const {
      id: _omitId, slug: _omitSlug, createdAt: _omitCreated, updatedAt: _omitUpdated,
      variations: _omitV, variationCombos: _omitC, attributeValues: _omitAv,
      ...rest
    } = src as any;

    const created = await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          ...rest,
          name: newName,
          slug: newSlug,
          status: 'DRAFT',
          isActive: false,
          sku: src.sku ? `${src.sku}-COPY` : null,
        },
      });

      // Clone variations + remember old→new option ids so combos line up.
      const optionRemap = new Map<string, string>();
      for (let vi = 0; vi < src.variations.length; vi++) {
        const v = src.variations[vi];
        const newVar = await tx.productVariation.create({
          data: {
            productId: product.id,
            name: v.name,
            position: vi,
            options: { create: v.options.map((o, oi) => ({ value: o.value, position: oi })) },
          },
          include: { options: { orderBy: { position: 'asc' } } },
        });
        v.options.forEach((o, oi) => {
          const newOpt = newVar.options.find((no) => no.position === oi);
          if (newOpt) optionRemap.set(o.id, newOpt.id);
        });
      }

      if (src.variationCombos.length > 0) {
        await tx.productVariationCombo.createMany({
          data: src.variationCombos.map((c) => ({
            productId: product.id,
            optionIds: c.optionIds.map((id) => optionRemap.get(id)).filter(Boolean) as string[],
            price: c.price,
            stock: c.stock,
            sku: c.sku ? `${c.sku}-COPY` : null,
          })),
        });
      }

      if (src.attributeValues.length > 0) {
        await tx.productAttributeValue.createMany({
          data: src.attributeValues.map((av) => ({
            productId: product.id,
            attributeId: av.attributeId,
            value: av.value,
          })),
        });
      }
      return product;
    });

    res.status(201).json(created);
  } catch (e) {
    console.error('Duplicate failed', e);
    res.status(500).json({ error: 'Duplicate failed' });
  }
});

// VENDOR: delete own product
router.delete('/:id', requireAuth, requireRole(Role.VENDOR), async (req, res) => {
  const vendor = await prisma.vendor.findUnique({ where: { userId: req.user!.id } });
  if (!vendor) return res.status(404).json({ error: 'Vendor profile not created' });
  const product = await prisma.product.findUnique({ where: { id: req.params.id } });
  if (!product || product.vendorId !== vendor.id) {
    return res.status(404).json({ error: 'Product not found' });
  }
  await prisma.product.delete({ where: { id: product.id } });
  removeProductFromIndex(product.id).catch((e) => console.error('[algolia] remove failed', e));
  res.status(204).end();
});

export default router;
