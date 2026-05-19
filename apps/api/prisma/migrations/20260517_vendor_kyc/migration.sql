-- Vendor KYC + onboarding fields

CREATE TYPE "BusinessType" AS ENUM ('INDIVIDUAL', 'PROPRIETORSHIP', 'PARTNERSHIP', 'PRIVATE_LIMITED', 'LLP');
CREATE TYPE "KycStatus" AS ENUM ('NOT_SUBMITTED', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED');

ALTER TABLE "Vendor"
  ADD COLUMN "businessType"      "BusinessType",
  ADD COLUMN "legalName"         TEXT,
  ADD COLUMN "panNumber"         TEXT,
  ADD COLUMN "gstin"              TEXT,
  ADD COLUMN "idDocumentUrl"     TEXT,
  ADD COLUMN "bankAccountName"   TEXT,
  ADD COLUMN "bankAccountNumber" TEXT,
  ADD COLUMN "bankIfsc"           TEXT,
  ADD COLUMN "onboardingStep"     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "kycStatus"          "KycStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
  ADD COLUMN "kycRejectionNote"   TEXT,
  ADD COLUMN "kycReviewedAt"      TIMESTAMP(3),
  ADD COLUMN "kycReviewedBy"      TEXT;

-- Backfill: existing APPROVED vendors are grandfathered as VERIFIED.
UPDATE "Vendor"
   SET "kycStatus" = 'VERIFIED',
       "onboardingStep" = 6
 WHERE "status" = 'APPROVED';
