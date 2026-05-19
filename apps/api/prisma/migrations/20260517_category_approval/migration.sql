-- Category approval workflow: vendors propose, admins approve.

CREATE TYPE "CategoryApprovalStatus" AS ENUM ('APPROVED', 'PROPOSED', 'REJECTED');

ALTER TABLE "Category"
  ADD COLUMN "approvalStatus"      "CategoryApprovalStatus" NOT NULL DEFAULT 'APPROVED',
  ADD COLUMN "proposedByVendorId"  TEXT,
  ADD COLUMN "rejectionNote"       TEXT,
  ADD COLUMN "reviewedAt"          TIMESTAMP(3),
  ADD COLUMN "reviewedBy"          TEXT;

CREATE INDEX "Category_approvalStatus_idx" ON "Category"("approvalStatus");

-- Existing categories were created by admins — grandfather as APPROVED (default already handles this).
