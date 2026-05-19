-- CreateTable
CREATE TABLE "VendorPage" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "isHomepage" BOOLEAN NOT NULL DEFAULT false,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "seoImageUrl" TEXT,
    "draftBlocks" JSONB NOT NULL DEFAULT '[]',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorPageVersion" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "versionNum" INTEGER NOT NULL,
    "blocks" JSONB NOT NULL,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "seoImageUrl" TEXT,
    "publishedBy" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorPageVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VendorPage_vendorId_isPublished_idx" ON "VendorPage"("vendorId", "isPublished");

-- CreateIndex
CREATE INDEX "VendorPage_vendorId_isHomepage_idx" ON "VendorPage"("vendorId", "isHomepage");

-- CreateIndex
CREATE UNIQUE INDEX "VendorPage_vendorId_slug_key" ON "VendorPage"("vendorId", "slug");

-- CreateIndex
CREATE INDEX "VendorPageVersion_pageId_publishedAt_idx" ON "VendorPageVersion"("pageId", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "VendorPageVersion_pageId_versionNum_key" ON "VendorPageVersion"("pageId", "versionNum");

-- AddForeignKey
ALTER TABLE "VendorPage" ADD CONSTRAINT "VendorPage_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorPageVersion" ADD CONSTRAINT "VendorPageVersion_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "VendorPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
