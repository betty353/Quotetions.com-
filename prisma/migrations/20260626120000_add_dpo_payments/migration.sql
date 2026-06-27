-- Add DPO payment integration fields while preserving existing manual payment data.
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'FAILED';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'AIRTEL_MONEY';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'MTN_MOBILE_MONEY';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'ZAMTEL_KWACHA';

DO $$ BEGIN
  CREATE TYPE "PaymentProvider" AS ENUM ('MANUAL', 'DPO');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "SettlementMethod" AS ENUM ('BANK_ACCOUNT', 'AIRTEL_MONEY', 'MTN_MOBILE_MONEY', 'ZAMTEL_KWACHA');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "DpoEnvironment" AS ENUM ('SANDBOX', 'PRODUCTION');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "Quotation"
  ADD COLUMN IF NOT EXISTS "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "paymentProvider" "PaymentProvider",
  ADD COLUMN IF NOT EXISTS "paymentMethod" "PaymentMethod",
  ADD COLUMN IF NOT EXISTS "dpoTransactionToken" TEXT,
  ADD COLUMN IF NOT EXISTS "paymentReference" TEXT,
  ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "receiptNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "settlementNote" TEXT;

ALTER TABLE "Payment"
  ADD COLUMN IF NOT EXISTS "provider" "PaymentProvider" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS "dpoTransactionToken" TEXT,
  ADD COLUMN IF NOT EXISTS "receiptNumber" TEXT;

ALTER TABLE "Receipt"
  ADD COLUMN IF NOT EXISTS "provider" "PaymentProvider" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS "paymentId" TEXT;

ALTER TABLE "CompanySetting"
  ADD COLUMN IF NOT EXISTS "settlementMethod" "SettlementMethod",
  ADD COLUMN IF NOT EXISTS "accountName" TEXT,
  ADD COLUMN IF NOT EXISTS "accountNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "branch" TEXT,
  ADD COLUMN IF NOT EXISTS "swiftCode" TEXT,
  ADD COLUMN IF NOT EXISTS "mobileMoneyNetwork" TEXT,
  ADD COLUMN IF NOT EXISTS "mobileMoneyBusinessName" TEXT,
  ADD COLUMN IF NOT EXISTS "mobileMoneyNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "dpoCompanyTokenEncrypted" TEXT,
  ADD COLUMN IF NOT EXISTS "dpoServiceTypeEncrypted" TEXT,
  ADD COLUMN IF NOT EXISTS "dpoMerchantId" TEXT,
  ADD COLUMN IF NOT EXISTS "dpoCallbackUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "dpoReturnUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "dpoEnvironment" "DpoEnvironment" NOT NULL DEFAULT 'SANDBOX',
  ADD COLUMN IF NOT EXISTS "paymentSetupComplete" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "paymentEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS "Payment_dpoTransactionToken_key" ON "Payment"("dpoTransactionToken");
CREATE INDEX IF NOT EXISTS "Quotation_paymentStatus_idx" ON "Quotation"("paymentStatus");
CREATE INDEX IF NOT EXISTS "Quotation_dpoTransactionToken_idx" ON "Quotation"("dpoTransactionToken");
CREATE INDEX IF NOT EXISTS "Receipt_paymentId_idx" ON "Receipt"("paymentId");

DO $$ BEGIN
  ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
