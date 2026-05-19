-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('RAZORPAY', 'UPI_MANUAL', 'BANK_TRANSFER', 'COD');

-- CreateEnum
CREATE TYPE "PaymentMethodMode" AS ENUM ('TEST', 'LIVE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Permission" ADD VALUE 'PAYMENT_METHOD_VIEW';
ALTER TYPE "Permission" ADD VALUE 'PAYMENT_METHOD_MANAGE';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "paymentMethodId" TEXT;

-- AlterTable
ALTER TABLE "ShippingMethod" ALTER COLUMN "zones" DROP DEFAULT;

-- CreateTable
CREATE TABLE "VendorPaymentMethod" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "label" TEXT NOT NULL,
    "mode" "PaymentMethodMode" NOT NULL DEFAULT 'TEST',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "credentials" TEXT,
    "publicConfig" JSONB,
    "lastVerifiedAt" TIMESTAMP(3),
    "verifyStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorPaymentMethod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VendorPaymentMethod_vendorId_idx" ON "VendorPaymentMethod"("vendorId");

-- CreateIndex
CREATE INDEX "VendorPaymentMethod_provider_idx" ON "VendorPaymentMethod"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "VendorPaymentMethod_vendorId_provider_label_key" ON "VendorPaymentMethod"("vendorId", "provider", "label");

-- CreateIndex
CREATE INDEX "Order_paymentMethodId_idx" ON "Order"("paymentMethodId");

-- AddForeignKey
ALTER TABLE "VendorPaymentMethod" ADD CONSTRAINT "VendorPaymentMethod_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "VendorPaymentMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

