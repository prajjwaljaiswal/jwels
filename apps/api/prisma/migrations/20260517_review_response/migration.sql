-- Vendor response + soft-hide on reviews.

ALTER TABLE "Review"
  ADD COLUMN "vendorResponse"    TEXT,
  ADD COLUMN "vendorRespondedAt" TIMESTAMP(3),
  ADD COLUMN "isHidden"          BOOLEAN NOT NULL DEFAULT false;
