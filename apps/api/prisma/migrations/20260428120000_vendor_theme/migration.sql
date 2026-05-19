-- Add JSON `theme` column to Vendor for full storefront theme/content config
ALTER TABLE "Vendor" ADD COLUMN "theme" JSONB;
