-- Add paymentMethod to Order
ALTER TABLE "Order" ADD COLUMN "paymentMethod" TEXT NOT NULL DEFAULT 'RAZORPAY';

-- Create Setting key-value table
CREATE TABLE "Setting" (
  "key"       TEXT NOT NULL,
  "value"     TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- Seed default COD setting (disabled)
INSERT INTO "Setting" ("key", "value", "updatedAt")
VALUES ('cod_enabled', 'false', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
