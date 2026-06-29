ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "nrc" TEXT;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "passportPhotoUrl" TEXT;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "village" TEXT;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "town" TEXT;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "whatsappNumber" TEXT;

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "images" JSONB;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "shortVideoUrl" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "view360Url" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "isFeatured" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "ProductStockMovement" (
  "id" TEXT NOT NULL,
  "companyId" TEXT,
  "productId" TEXT NOT NULL,
  "userId" TEXT,
  "type" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "previousStock" INTEGER NOT NULL,
  "newStock" INTEGER NOT NULL,
  "unitCost" DECIMAL(12,2),
  "reason" TEXT,
  "reference" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductStockMovement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProductStockMovement_companyId_idx" ON "ProductStockMovement"("companyId");
CREATE INDEX IF NOT EXISTS "ProductStockMovement_productId_idx" ON "ProductStockMovement"("productId");
CREATE INDEX IF NOT EXISTS "ProductStockMovement_type_idx" ON "ProductStockMovement"("type");
CREATE INDEX IF NOT EXISTS "ProductStockMovement_createdAt_idx" ON "ProductStockMovement"("createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProductStockMovement_companyId_fkey'
  ) THEN
    ALTER TABLE "ProductStockMovement"
      ADD CONSTRAINT "ProductStockMovement_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProductStockMovement_productId_fkey'
  ) THEN
    ALTER TABLE "ProductStockMovement"
      ADD CONSTRAINT "ProductStockMovement_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProductStockMovement_userId_fkey'
  ) THEN
    ALTER TABLE "ProductStockMovement"
      ADD CONSTRAINT "ProductStockMovement_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
