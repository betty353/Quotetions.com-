CREATE TABLE IF NOT EXISTS "ProductView" (
  "id" TEXT NOT NULL,
  "companyId" TEXT,
  "productId" TEXT NOT NULL,
  "userId" TEXT,
  "sessionId" TEXT,
  "ipHash" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProductView_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProductView_companyId_idx" ON "ProductView"("companyId");
CREATE INDEX IF NOT EXISTS "ProductView_productId_idx" ON "ProductView"("productId");
CREATE INDEX IF NOT EXISTS "ProductView_userId_idx" ON "ProductView"("userId");
CREATE INDEX IF NOT EXISTS "ProductView_createdAt_idx" ON "ProductView"("createdAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProductView_companyId_fkey') THEN
    ALTER TABLE "ProductView"
      ADD CONSTRAINT "ProductView_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProductView_productId_fkey') THEN
    ALTER TABLE "ProductView"
      ADD CONSTRAINT "ProductView_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProductView_userId_fkey') THEN
    ALTER TABLE "ProductView"
      ADD CONSTRAINT "ProductView_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
