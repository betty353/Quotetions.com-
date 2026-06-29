CREATE TABLE IF NOT EXISTS "DiscountRequest" (
  "id" TEXT NOT NULL,
  "companyId" TEXT,
  "customerId" TEXT NOT NULL,
  "requestedById" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "items" JSONB NOT NULL,
  "notes" TEXT,
  "terms" TEXT,
  "validUntil" TIMESTAMP(3),
  "subtotal" DECIMAL(12,2) NOT NULL,
  "discountAmount" DECIMAL(12,2) NOT NULL,
  "total" DECIMAL(12,2) NOT NULL,
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "rejectedById" TEXT,
  "rejectedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "quotationId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DiscountRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DiscountRequest_companyId_idx" ON "DiscountRequest"("companyId");
CREATE INDEX IF NOT EXISTS "DiscountRequest_customerId_idx" ON "DiscountRequest"("customerId");
CREATE INDEX IF NOT EXISTS "DiscountRequest_requestedById_idx" ON "DiscountRequest"("requestedById");
CREATE INDEX IF NOT EXISTS "DiscountRequest_status_idx" ON "DiscountRequest"("status");
CREATE INDEX IF NOT EXISTS "DiscountRequest_createdAt_idx" ON "DiscountRequest"("createdAt");
