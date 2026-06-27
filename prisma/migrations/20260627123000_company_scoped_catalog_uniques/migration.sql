DROP INDEX IF EXISTS "Product_sku_key";
DROP INDEX IF EXISTS "Category_name_key";

CREATE UNIQUE INDEX IF NOT EXISTS "Product_companyId_sku_key" ON "Product"("companyId", "sku");
CREATE UNIQUE INDEX IF NOT EXISTS "Category_companyId_name_key" ON "Category"("companyId", "name");
