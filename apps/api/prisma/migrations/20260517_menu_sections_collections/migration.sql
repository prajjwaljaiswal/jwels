-- Category promo (mega-menu right rail)
ALTER TABLE "Category"
  ADD COLUMN "promoImageUrl" TEXT,
  ADD COLUMN "promoLinkUrl"  TEXT,
  ADD COLUMN "promoLabel"    TEXT;

-- Mega-menu sections per (top-level) Category
CREATE TABLE "CategoryMenuSection" (
  "id"         TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "title"      TEXT NOT NULL,
  "sortOrder"  INTEGER NOT NULL DEFAULT 0,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CategoryMenuSection_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CategoryMenuSection_categoryId_idx" ON "CategoryMenuSection"("categoryId");
ALTER TABLE "CategoryMenuSection"
  ADD CONSTRAINT "CategoryMenuSection_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "Category"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Items within a section
CREATE TABLE "CategoryMenuItem" (
  "id"        TEXT NOT NULL,
  "sectionId" TEXT NOT NULL,
  "label"     TEXT NOT NULL,
  "href"      TEXT NOT NULL,
  "iconUrl"   TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "CategoryMenuItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CategoryMenuItem_sectionId_idx" ON "CategoryMenuItem"("sectionId");
ALTER TABLE "CategoryMenuItem"
  ADD CONSTRAINT "CategoryMenuItem_sectionId_fkey"
  FOREIGN KEY ("sectionId") REFERENCES "CategoryMenuSection"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Virtual collections (Engagement & Wedding, Bridal, Gifts, …)
CREATE TABLE "Collection" (
  "id"              TEXT NOT NULL,
  "slug"            TEXT NOT NULL,
  "name"            TEXT NOT NULL,
  "description"     TEXT,
  "imageUrl"        TEXT,
  "bannerUrl"       TEXT,
  "isActive"        BOOLEAN NOT NULL DEFAULT TRUE,
  "featured"        BOOLEAN NOT NULL DEFAULT FALSE,
  "sortOrder"       INTEGER NOT NULL DEFAULT 0,
  "metaTitle"       TEXT,
  "metaDescription" TEXT,
  "metaImageUrl"    TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Collection_slug_key"     ON "Collection"("slug");
CREATE INDEX "Collection_isActive_idx" ON "Collection"("isActive");
CREATE INDEX "Collection_featured_idx" ON "Collection"("featured");
CREATE INDEX "Collection_sortOrder_idx" ON "Collection"("sortOrder");

-- Implicit M2M join table for Collection ⇄ Product
CREATE TABLE "_CollectionProducts" (
  "A" TEXT NOT NULL,
  "B" TEXT NOT NULL
);
CREATE UNIQUE INDEX "_CollectionProducts_AB_unique" ON "_CollectionProducts"("A", "B");
CREATE INDEX "_CollectionProducts_B_index" ON "_CollectionProducts"("B");
ALTER TABLE "_CollectionProducts"
  ADD CONSTRAINT "_CollectionProducts_A_fkey"
  FOREIGN KEY ("A") REFERENCES "Collection"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_CollectionProducts"
  ADD CONSTRAINT "_CollectionProducts_B_fkey"
  FOREIGN KEY ("B") REFERENCES "Product"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
