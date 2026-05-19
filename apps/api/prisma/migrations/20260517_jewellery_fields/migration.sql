-- New enums
CREATE TYPE "JewelleryType" AS ENUM ('FINE', 'DEMI_FINE', 'FASHION', 'HANDCRAFTED');
CREATE TYPE "Purity" AS ENUM ('K14', 'K18', 'K22', 'K24', 'SILVER_925', 'PLATINUM_950', 'OTHER');
CREATE TYPE "Gender" AS ENUM ('WOMEN', 'MEN', 'UNISEX', 'KIDS');
CREATE TYPE "MakingChargeType" AS ENUM ('PER_GRAM', 'FLAT', 'PERCENT');

-- Product columns
ALTER TABLE "Product"
  ADD COLUMN "jewelleryType"     "JewelleryType" NOT NULL DEFAULT 'FASHION',
  ADD COLUMN "purity"            "Purity",
  ADD COLUMN "gender"            "Gender",
  ADD COLUMN "baseMetal"         TEXT,
  ADD COLUMN "plating"           TEXT,
  ADD COLUMN "grossWeightGrams"  DECIMAL(10,3),
  ADD COLUMN "netWeightGrams"    DECIMAL(10,3),
  ADD COLUMN "makingChargeType"  "MakingChargeType",
  ADD COLUMN "makingChargeValue" DECIMAL(10,2),
  ADD COLUMN "wastagePercent"    DECIMAL(5,2),
  ADD COLUMN "hallmarked"        BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "certifiedBy"       TEXT,
  ADD COLUMN "certificateNumber" TEXT,
  ADD COLUMN "hsnCode"           TEXT NOT NULL DEFAULT '7113',
  ADD COLUMN "gstRatePercent"    DECIMAL(5,2) NOT NULL DEFAULT 3,
  ADD COLUMN "countryOfOrigin"   TEXT NOT NULL DEFAULT 'IN',
  ADD COLUMN "careInstructions"  TEXT,
  ADD COLUMN "antiTarnish"       BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "nickelFree"        BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "hypoallergenic"    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "leadFree"          BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX "Product_jewelleryType_idx" ON "Product"("jewelleryType");
CREATE INDEX "Product_gender_idx"        ON "Product"("gender");

-- Unique (categoryId, name) on CategoryAttribute so seed upserts are idempotent
CREATE UNIQUE INDEX "CategoryAttribute_categoryId_name_key"
  ON "CategoryAttribute"("categoryId", "name");
