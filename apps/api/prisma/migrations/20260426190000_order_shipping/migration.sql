-- Order-level shipping total
ALTER TABLE "Order" ADD COLUMN "shippingTotal" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Per-item shipping snapshot (recorded at order time so historical orders survive method changes)
ALTER TABLE "OrderItem"
  ADD COLUMN "shippingMethodId" TEXT,
  ADD COLUMN "shippingCarrier"  TEXT,
  ADD COLUMN "shippingService"  TEXT,
  ADD COLUMN "shippingCost"     DECIMAL(10,2),
  ADD COLUMN "trackingNumber"   TEXT,
  ADD COLUMN "trackingUrl"      TEXT,
  ADD COLUMN "labelUrl"         TEXT;
