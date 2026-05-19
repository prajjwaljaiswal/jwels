-- Phase 4: Vendor sections + return policies

CREATE TABLE "VendorSection" (
    "id"        TEXT NOT NULL,
    "vendorId"  TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "slug"      TEXT NOT NULL,
    "position"  INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VendorSection_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "VendorSection_vendorId_fkey"
      FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "VendorSection_vendorId_slug_key" ON "VendorSection"("vendorId", "slug");
CREATE INDEX "VendorSection_vendorId_idx" ON "VendorSection"("vendorId");

CREATE TABLE "VendorReturnPolicy" (
    "id"              TEXT    NOT NULL,
    "vendorId"        TEXT    NOT NULL,
    "name"            TEXT    NOT NULL,
    "accepted"        BOOLEAN NOT NULL DEFAULT true,
    "days"            INTEGER NOT NULL DEFAULT 14,
    "buyerPaysReturn" BOOLEAN NOT NULL DEFAULT true,
    "notes"           TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VendorReturnPolicy_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "VendorReturnPolicy_vendorId_fkey"
      FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "VendorReturnPolicy_vendorId_idx" ON "VendorReturnPolicy"("vendorId");

ALTER TABLE "Product"
  ADD COLUMN "shopSectionId"  TEXT,
  ADD COLUMN "returnPolicyId" TEXT;

ALTER TABLE "Product"
  ADD CONSTRAINT "Product_shopSectionId_fkey"
  FOREIGN KEY ("shopSectionId") REFERENCES "VendorSection"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Product"
  ADD CONSTRAINT "Product_returnPolicyId_fkey"
  FOREIGN KEY ("returnPolicyId") REFERENCES "VendorReturnPolicy"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Product_shopSectionId_idx" ON "Product"("shopSectionId");
