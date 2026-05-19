-- Vendor media library. Centralised store of every image a vendor uploads,
-- reusable across block settings, banners, hero images, trust-strip icons, etc.
CREATE TABLE "VendorAsset" (
    "id"        TEXT NOT NULL,
    "vendorId"  TEXT NOT NULL,
    "url"       TEXT NOT NULL,
    "publicId"  TEXT,
    "kind"      TEXT NOT NULL DEFAULT 'image',
    "alt"       TEXT,
    "width"     INTEGER,
    "height"    INTEGER,
    "bytes"     INTEGER,
    "format"    TEXT,
    "folder"    TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorAsset_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VendorAsset_vendorId_createdAt_idx"
    ON "VendorAsset"("vendorId", "createdAt");

ALTER TABLE "VendorAsset"
    ADD CONSTRAINT "VendorAsset_vendorId_fkey"
    FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
