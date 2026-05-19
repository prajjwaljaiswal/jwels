-- CreateTable: Review
CREATE TABLE "Review" (
    "id"         TEXT NOT NULL,
    "productId"  TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "rating"     INTEGER NOT NULL,
    "title"      TEXT,
    "body"       TEXT,
    "mediaUrls"  TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "mediaTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Review_productId_customerId_key" ON "Review"("productId", "customerId");
CREATE INDEX "Review_productId_idx" ON "Review"("productId");
CREATE INDEX "Review_customerId_idx" ON "Review"("customerId");

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Review" ADD CONSTRAINT "Review_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
