-- Hierarchy + display + SEO columns on Category
ALTER TABLE "Category"
  ADD COLUMN "parentId"        TEXT,
  ADD COLUMN "imageUrl"        TEXT,
  ADD COLUMN "iconUrl"         TEXT,
  ADD COLUMN "featured"        BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "metaTitle"       TEXT,
  ADD COLUMN "metaDescription" TEXT,
  ADD COLUMN "metaImageUrl"    TEXT;

-- Drop name uniqueness so sibling subcategories can share names (e.g. "Studs"
-- under Earrings and Nose Pins). Slug remains globally unique.
DROP INDEX IF EXISTS "Category_name_key";

-- Self-referential FK with set-null on parent removal
ALTER TABLE "Category"
  ADD CONSTRAINT "Category_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "Category"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");
CREATE INDEX "Category_featured_idx" ON "Category"("featured");
