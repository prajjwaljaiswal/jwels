-- Restore the empty-array default on Vendor.bannerUrls so vendor onboarding
-- doesn't have to send the field explicitly.
ALTER TABLE "Vendor" ALTER COLUMN "bannerUrls" SET DEFAULT ARRAY[]::TEXT[];
