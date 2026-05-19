-- Phase 3: Product variations + per-combo price/stock/sku

CREATE TABLE "ProductVariation" (
    "id"        TEXT    NOT NULL,
    "productId" TEXT    NOT NULL,
    "name"      TEXT    NOT NULL,
    "position"  INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ProductVariation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ProductVariation_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "Product"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductVariation_productId_idx" ON "ProductVariation"("productId");

CREATE TABLE "ProductVariationOption" (
    "id"          TEXT    NOT NULL,
    "variationId" TEXT    NOT NULL,
    "value"       TEXT    NOT NULL,
    "position"    INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ProductVariationOption_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ProductVariationOption_variationId_fkey"
      FOREIGN KEY ("variationId") REFERENCES "ProductVariation"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductVariationOption_variationId_idx" ON "ProductVariationOption"("variationId");

CREATE TABLE "ProductVariationCombo" (
    "id"        TEXT    NOT NULL,
    "productId" TEXT    NOT NULL,
    "optionIds" TEXT[]  NOT NULL,
    "price"     DECIMAL(10,2),
    "stock"     INTEGER NOT NULL DEFAULT 0,
    "sku"       TEXT,
    CONSTRAINT "ProductVariationCombo_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ProductVariationCombo_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "Product"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductVariationCombo_productId_idx" ON "ProductVariationCombo"("productId");

ALTER TABLE "OrderItem"
  ADD COLUMN "variationComboId" TEXT,
  ADD COLUMN "variationLabel"   TEXT;

ALTER TABLE "OrderItem"
  ADD CONSTRAINT "OrderItem_variationComboId_fkey"
  FOREIGN KEY ("variationComboId") REFERENCES "ProductVariationCombo"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
