-- Phase 2: Etsy-style listing taxonomy fields on Product

-- Enums
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE');
CREATE TYPE "ItemType"      AS ENUM ('PHYSICAL', 'DIGITAL');
CREATE TYPE "WhoMade"       AS ENUM ('I_DID', 'TEAM', 'ANOTHER_COMPANY');
CREATE TYPE "ProductType"   AS ENUM ('FINISHED', 'SUPPLY');
CREATE TYPE "RenewalMode"   AS ENUM ('AUTOMATIC', 'MANUAL');

-- Columns
ALTER TABLE "Product"
  ADD COLUMN "status"          "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "itemType"        "ItemType"      NOT NULL DEFAULT 'PHYSICAL',
  ADD COLUMN "whenMade"        TEXT,
  ADD COLUMN "whoMade"         "WhoMade",
  ADD COLUMN "productType"     "ProductType"   NOT NULL DEFAULT 'FINISHED',
  ADD COLUMN "tags"            TEXT[]          NOT NULL DEFAULT '{}',
  ADD COLUMN "materials"       TEXT[]          NOT NULL DEFAULT '{}',
  ADD COLUMN "sku"             TEXT,
  ADD COLUMN "videoUrl"        TEXT,
  ADD COLUMN "personalization" JSONB,
  ADD COLUMN "acceptsOffers"   BOOLEAN         NOT NULL DEFAULT false,
  ADD COLUMN "featured"        BOOLEAN         NOT NULL DEFAULT false,
  ADD COLUMN "renewalMode"     "RenewalMode"   NOT NULL DEFAULT 'AUTOMATIC',
  ADD COLUMN "processingMin"   INTEGER,
  ADD COLUMN "processingMax"   INTEGER,
  ADD COLUMN "weightGrams"     INTEGER,
  ADD COLUMN "lengthMm"        INTEGER,
  ADD COLUMN "widthMm"         INTEGER,
  ADD COLUMN "heightMm"        INTEGER,
  ADD COLUMN "shippingMethodDefaultId" TEXT;

ALTER TABLE "Product"
  ADD CONSTRAINT "Product_shippingMethodDefaultId_fkey"
  FOREIGN KEY ("shippingMethodDefaultId")
  REFERENCES "ShippingMethod"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Product_status_idx"   ON "Product"("status");
CREATE INDEX "Product_featured_idx" ON "Product"("featured");
