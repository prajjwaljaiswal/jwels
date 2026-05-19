-- VendorPageKind enum: discriminates the surface a VendorPage powers.
CREATE TYPE "VendorPageKind" AS ENUM ('HOMEPAGE', 'CUSTOM', 'PDP', 'CART', 'CHECKOUT');

-- New columns
ALTER TABLE "Vendor"     ADD COLUMN "themePresetKey" TEXT;
ALTER TABLE "VendorPage" ADD COLUMN "pageKind" "VendorPageKind" NOT NULL DEFAULT 'CUSTOM';

-- Backfill: existing homepage rows become HOMEPAGE; everything else stays CUSTOM.
UPDATE "VendorPage" SET "pageKind" = 'HOMEPAGE' WHERE "isHomepage" = TRUE;

-- Singleton index on system kinds (HOMEPAGE/PDP/CART/CHECKOUT). CUSTOM rows are excluded.
CREATE UNIQUE INDEX "VendorPage_singleton_kind"
  ON "VendorPage"("vendorId", "pageKind")
  WHERE "pageKind" <> 'CUSTOM';

-- Lookup index used by storefront read paths.
CREATE INDEX "VendorPage_vendorId_pageKind_idx"
  ON "VendorPage"("vendorId", "pageKind");
