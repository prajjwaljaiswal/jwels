-- Replace single bannerUrl with ordered bannerUrls array
ALTER TABLE "Vendor" ADD COLUMN "bannerUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Migrate any existing single banner into the array
UPDATE "Vendor" SET "bannerUrls" = ARRAY["bannerUrl"] WHERE "bannerUrl" IS NOT NULL AND "bannerUrl" != '';

ALTER TABLE "Vendor" DROP COLUMN "bannerUrl";

-- Drop the default now that existing rows are populated
ALTER TABLE "Vendor" ALTER COLUMN "bannerUrls" DROP DEFAULT;
