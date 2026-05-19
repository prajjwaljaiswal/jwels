ALTER TABLE "Vendor" ADD COLUMN "bannerUrl"    TEXT;
ALTER TABLE "Vendor" ADD COLUMN "tagline"      TEXT;
ALTER TABLE "Vendor" ADD COLUMN "themeColor"   TEXT NOT NULL DEFAULT '#F1641E';
ALTER TABLE "Vendor" ADD COLUMN "customDomain" TEXT;
CREATE UNIQUE INDEX "Vendor_customDomain_key" ON "Vendor"("customDomain");
