-- CreateEnum
CREATE TYPE "AttributeInputType" AS ENUM ('SELECT', 'TEXT', 'NUMBER');

-- CreateTable: Category
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CategoryAttribute
CREATE TABLE "CategoryAttribute" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "inputType" "AttributeInputType" NOT NULL DEFAULT 'SELECT',
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CategoryAttribute_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CategoryAttributeOption
CREATE TABLE "CategoryAttributeOption" (
    "id" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CategoryAttributeOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ProductAttributeValue
CREATE TABLE "ProductAttributeValue" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "ProductAttributeValue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");
CREATE INDEX "Category_isActive_idx" ON "Category"("isActive");
CREATE INDEX "Category_sortOrder_idx" ON "Category"("sortOrder");
CREATE INDEX "CategoryAttribute_categoryId_idx" ON "CategoryAttribute"("categoryId");
CREATE INDEX "CategoryAttributeOption_attributeId_idx" ON "CategoryAttributeOption"("attributeId");
CREATE UNIQUE INDEX "ProductAttributeValue_productId_attributeId_key" ON "ProductAttributeValue"("productId", "attributeId");
CREATE INDEX "ProductAttributeValue_productId_idx" ON "ProductAttributeValue"("productId");

-- Seed legacy categories so existing products can be linked
INSERT INTO "Category" ("id", "name", "slug", "isActive", "sortOrder", "createdAt", "updatedAt") VALUES
  (gen_random_uuid(), 'Rings',     'rings',     true, 1, now(), now()),
  (gen_random_uuid(), 'Necklaces', 'necklaces', true, 2, now(), now()),
  (gen_random_uuid(), 'Earrings',  'earrings',  true, 3, now(), now()),
  (gen_random_uuid(), 'Bangles',   'bangles',   true, 4, now(), now()),
  (gen_random_uuid(), 'Bracelets', 'bracelets', true, 5, now(), now()),
  (gen_random_uuid(), 'Pendants',  'pendants',  true, 6, now(), now());

-- Add nullable categoryId to Product
ALTER TABLE "Product" ADD COLUMN "categoryId" TEXT;

-- Populate categoryId from old category string (ring→rings, necklace→necklaces, etc.)
UPDATE "Product" SET "categoryId" = (
  SELECT c.id FROM "Category" c
  WHERE c.slug = LOWER("Product"."category") || 's'
     OR c.slug = LOWER("Product"."category")
  LIMIT 1
);

-- Fallback: assign to Rings for any unmatched rows
UPDATE "Product" SET "categoryId" = (SELECT id FROM "Category" WHERE slug = 'rings' LIMIT 1)
WHERE "categoryId" IS NULL;

-- Enforce NOT NULL on categoryId
ALTER TABLE "Product" ALTER COLUMN "categoryId" SET NOT NULL;

-- Drop old category column and its index
DROP INDEX IF EXISTS "Product_category_idx";
ALTER TABLE "Product" DROP COLUMN "category";

-- Add categoryId index
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");

-- AddForeignKey constraints
ALTER TABLE "Category" ADD CONSTRAINT "Category_pkey_check" CHECK (true); -- no-op placeholder

ALTER TABLE "CategoryAttribute" ADD CONSTRAINT "CategoryAttribute_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CategoryAttributeOption" ADD CONSTRAINT "CategoryAttributeOption_attributeId_fkey"
  FOREIGN KEY ("attributeId") REFERENCES "CategoryAttribute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductAttributeValue" ADD CONSTRAINT "ProductAttributeValue_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductAttributeValue" ADD CONSTRAINT "ProductAttributeValue_attributeId_fkey"
  FOREIGN KEY ("attributeId") REFERENCES "CategoryAttribute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
