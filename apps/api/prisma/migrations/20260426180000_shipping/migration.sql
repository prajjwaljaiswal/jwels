-- Shipping: enums, vendor pickup address, carrier accounts, shipping methods

-- Enums
CREATE TYPE "ShippingServiceType" AS ENUM ('STANDARD', 'EXPRESS', 'OVERNIGHT', 'SAME_DAY');
CREATE TYPE "CarrierMode" AS ENUM ('TEST', 'LIVE');
CREATE TYPE "RateMode" AS ENUM ('FLAT', 'LIVE');

-- VendorAddress: one pickup address per vendor
CREATE TABLE "VendorAddress" (
  "id"          TEXT PRIMARY KEY,
  "vendorId"    TEXT NOT NULL UNIQUE,
  "contactName" TEXT NOT NULL,
  "phone"       TEXT NOT NULL,
  "line1"       TEXT NOT NULL,
  "line2"       TEXT,
  "city"        TEXT NOT NULL,
  "state"       TEXT NOT NULL,
  "postalCode"  TEXT NOT NULL,
  "country"     TEXT NOT NULL DEFAULT 'IN',
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VendorAddress_vendorId_fkey"
    FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- VendorCarrierAccount: encrypted credentials per (vendor, carrier, label)
CREATE TABLE "VendorCarrierAccount" (
  "id"             TEXT PRIMARY KEY,
  "vendorId"       TEXT NOT NULL,
  "carrier"        TEXT NOT NULL,
  "accountLabel"   TEXT NOT NULL,
  "mode"           "CarrierMode" NOT NULL DEFAULT 'TEST',
  "credentials"    TEXT NOT NULL,
  "defaultsJson"   JSONB,
  "isActive"       BOOLEAN NOT NULL DEFAULT true,
  "lastVerifiedAt" TIMESTAMP(3),
  "verifyStatus"   TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VendorCarrierAccount_vendorId_fkey"
    FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "VendorCarrierAccount_vendorId_carrier_accountLabel_key"
  ON "VendorCarrierAccount" ("vendorId", "carrier", "accountLabel");
CREATE INDEX "VendorCarrierAccount_vendorId_idx" ON "VendorCarrierAccount" ("vendorId");

-- ShippingMethod: vendor-defined option shown at checkout
CREATE TABLE "ShippingMethod" (
  "id"               TEXT PRIMARY KEY,
  "vendorId"         TEXT NOT NULL,
  "carrierAccountId" TEXT,
  "carrier"          TEXT NOT NULL,
  "name"             TEXT NOT NULL,
  "serviceType"      "ShippingServiceType" NOT NULL DEFAULT 'STANDARD',
  "rateMode"         "RateMode" NOT NULL DEFAULT 'FLAT',
  "baseRate"         DECIMAL(10,2) NOT NULL DEFAULT 0,
  "perItemRate"      DECIMAL(10,2),
  "freeAbove"        DECIMAL(10,2),
  "etaMinDays"       INTEGER NOT NULL DEFAULT 3,
  "etaMaxDays"       INTEGER NOT NULL DEFAULT 7,
  "zones"            TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "isActive"         BOOLEAN NOT NULL DEFAULT true,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShippingMethod_vendorId_fkey"
    FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ShippingMethod_carrierAccountId_fkey"
    FOREIGN KEY ("carrierAccountId") REFERENCES "VendorCarrierAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "ShippingMethod_vendorId_idx" ON "ShippingMethod" ("vendorId");
CREATE INDEX "ShippingMethod_carrierAccountId_idx" ON "ShippingMethod" ("carrierAccountId");
