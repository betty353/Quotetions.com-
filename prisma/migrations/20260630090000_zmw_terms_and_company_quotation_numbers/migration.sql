ALTER TABLE "Product" ALTER COLUMN "currency" SET DEFAULT 'ZMW';
ALTER TABLE "Quotation" ALTER COLUMN "currency" SET DEFAULT 'ZMW';
ALTER TABLE "Payment" ALTER COLUMN "currency" SET DEFAULT 'ZMW';
ALTER TABLE "Receipt" ALTER COLUMN "currency" SET DEFAULT 'ZMW';
ALTER TABLE "CompanySetting" ALTER COLUMN "defaultCurrency" SET DEFAULT 'ZMW';
ALTER TABLE "CompanySetting" ALTER COLUMN "quotationValidDays" SET DEFAULT 7;
ALTER TABLE "CompanySetting" ADD COLUMN IF NOT EXISTS "termsAndConditions" TEXT;

UPDATE "CompanySetting"
SET "defaultCurrency" = 'ZMW'
WHERE "defaultCurrency" IS NULL OR "defaultCurrency" = 'USD';

UPDATE "Product" SET "currency" = 'ZMW' WHERE "currency" IS NULL OR "currency" = 'USD';
UPDATE "Quotation" SET "currency" = 'ZMW' WHERE "currency" IS NULL OR "currency" = 'USD';
UPDATE "Payment" SET "currency" = 'ZMW' WHERE "currency" IS NULL OR "currency" = 'USD';
UPDATE "Receipt" SET "currency" = 'ZMW' WHERE "currency" IS NULL OR "currency" = 'USD';

ALTER TABLE "Quotation" DROP CONSTRAINT IF EXISTS "Quotation_quotationNumber_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Quotation_companyId_quotationNumber_key" ON "Quotation"("companyId", "quotationNumber");
