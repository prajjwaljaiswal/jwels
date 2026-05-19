-- Product polish fields: brand, slug (unique), SEO meta, image alts, highlights, warranty, certificate image.

ALTER TABLE "Product"
  ADD COLUMN "slug"                TEXT,
  ADD COLUMN "brand"               TEXT,
  ADD COLUMN "imageAlts"           TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN "highlights"          TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN "warranty"            TEXT,
  ADD COLUMN "certificateImageUrl" TEXT,
  ADD COLUMN "seoTitle"            TEXT,
  ADD COLUMN "seoDescription"      TEXT;

-- Backfill slugs from name + short id suffix to guarantee uniqueness.
UPDATE "Product"
   SET "slug" = LOWER(
        REGEXP_REPLACE(
          REGEXP_REPLACE(COALESCE("name", 'product'), '[^a-zA-Z0-9]+', '-', 'g'),
          '(^-+|-+$)', '', 'g'
        )
      ) || '-' || SUBSTRING("id" FROM 1 FOR 6)
 WHERE "slug" IS NULL;

CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");
