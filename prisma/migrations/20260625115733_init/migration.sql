-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'EMPLOYEE', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "QuotationStatus" AS ENUM ('DRAFT', 'SENT', 'VIEWED', 'APPROVED', 'REJECTED', 'EXPIRED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PARTIAL', 'COMPLETED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'MOBILE_MONEY', 'CARD', 'CHEQUE', 'OTHER');

-- CreateEnum
CREATE TYPE "FollowUpStatus" AS ENUM ('PENDING', 'COMPLETED', 'RESCHEDULED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('QUOTATION_CREATED', 'QUOTATION_APPROVED', 'PAYMENT_RECORDED', 'RECEIPT_GENERATED', 'EMPLOYEE_ASSIGNED', 'FOLLOWUP_REMINDER', 'SYSTEM_ALERT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'CUSTOMER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
    "lastLogin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyName" TEXT,
    "companyRegistration" TEXT,
    "taxId" TEXT,
    "phone" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "region" TEXT,
    "country" TEXT,
    "postalCode" TEXT,
    "contactPerson" TEXT,
    "creditLimit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "creditUsed" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "department" TEXT,
    "position" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "hireDate" TIMESTAMP(3),
    "salary" DECIMAL(12,2),
    "performanceRating" DOUBLE PRECISION,
    "quotaTarget" DECIMAL(12,2),
    "commissionRate" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "stock" INTEGER NOT NULL DEFAULT 0,
    "reorderLevel" INTEGER,
    "image" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductImportHistory" (
    "id" TEXT NOT NULL,
    "importedById" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'csv',
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "categoriesCreated" JSONB,
    "errors" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductImportHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quotation" (
    "id" TEXT NOT NULL,
    "quotationNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "assignedEmployeeId" TEXT,
    "status" "QuotationStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "taxAmount" DECIMAL(12,2) NOT NULL,
    "discountAmount" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "notes" TEXT,
    "terms" TEXT,
    "validUntil" TIMESTAMP(3),
    "viewedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotationItem" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tax" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuotationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "paymentNumber" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "recordedById" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "reference" TEXT,
    "notes" TEXT,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Receipt" (
    "id" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "generatedById" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "paymentMethod" "PaymentMethod" NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "signatureImageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowUp" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "status" "FollowUpStatus" NOT NULL DEFAULT 'PENDING',
    "type" TEXT NOT NULL,
    "callNotes" TEXT,
    "meetingNotes" TEXT,
    "feedback" TEXT,
    "nextFollowUpDate" TIMESTAMP(3),
    "reminderDate" TIMESTAMP(3),
    "reminderSent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "relatedId" TEXT,
    "relatedModel" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "customerId" TEXT,
    "quotationId" TEXT,
    "paymentId" TEXT,
    "followUpId" TEXT,
    "receiptId" TEXT,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "changes" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "userId" TEXT,
    "employeeId" TEXT,
    "activityType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quotationId" TEXT,
    "paymentId" TEXT,
    "receiptId" TEXT,
    "followUpId" TEXT,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanySetting" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "companyEmail" TEXT NOT NULL,
    "companyPhone" TEXT NOT NULL,
    "companyAddress" TEXT,
    "companyCity" TEXT,
    "companyRegion" TEXT,
    "companyCountry" TEXT,
    "companyPostalCode" TEXT,
    "companyTaxId" TEXT,
    "companyRegistration" TEXT,
    "defaultCurrency" TEXT NOT NULL DEFAULT 'USD',
    "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "quotationPrefix" TEXT NOT NULL DEFAULT 'QT',
    "receiptPrefix" TEXT NOT NULL DEFAULT 'RC',
    "paymentPrefix" TEXT NOT NULL DEFAULT 'PM',
    "quotationValidDays" INTEGER NOT NULL DEFAULT 30,
    "bankName" TEXT,
    "bankAccount" TEXT,
    "bankCode" TEXT,
    "companyWebsite" TEXT,
    "companyLogo" TEXT,
    "signatureImageUrl" TEXT,
    "documentFont" TEXT NOT NULL DEFAULT 'Helvetica',
    "socialMedia" TEXT,
    "businessHours" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanySetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Account_userId_key" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_userId_key" ON "Customer"("userId");

-- CreateIndex
CREATE INDEX "Customer_userId_idx" ON "Customer"("userId");

-- CreateIndex
CREATE INDEX "Customer_companyName_idx" ON "Customer"("companyName");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_userId_key" ON "Employee"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_employeeId_key" ON "Employee"("employeeId");

-- CreateIndex
CREATE INDEX "Employee_userId_idx" ON "Employee"("userId");

-- CreateIndex
CREATE INDEX "Employee_employeeId_idx" ON "Employee"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");

-- CreateIndex
CREATE INDEX "Product_sku_idx" ON "Product"("sku");

-- CreateIndex
CREATE INDEX "Product_name_idx" ON "Product"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE INDEX "ProductImportHistory_importedById_idx" ON "ProductImportHistory"("importedById");

-- CreateIndex
CREATE INDEX "ProductImportHistory_createdAt_idx" ON "ProductImportHistory"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Quotation_quotationNumber_key" ON "Quotation"("quotationNumber");

-- CreateIndex
CREATE INDEX "Quotation_customerId_idx" ON "Quotation"("customerId");

-- CreateIndex
CREATE INDEX "Quotation_createdById_idx" ON "Quotation"("createdById");

-- CreateIndex
CREATE INDEX "Quotation_assignedEmployeeId_idx" ON "Quotation"("assignedEmployeeId");

-- CreateIndex
CREATE INDEX "Quotation_status_idx" ON "Quotation"("status");

-- CreateIndex
CREATE INDEX "Quotation_quotationNumber_idx" ON "Quotation"("quotationNumber");

-- CreateIndex
CREATE INDEX "QuotationItem_quotationId_idx" ON "QuotationItem"("quotationId");

-- CreateIndex
CREATE INDEX "QuotationItem_productId_idx" ON "QuotationItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_paymentNumber_key" ON "Payment"("paymentNumber");

-- CreateIndex
CREATE INDEX "Payment_quotationId_idx" ON "Payment"("quotationId");

-- CreateIndex
CREATE INDEX "Payment_customerId_idx" ON "Payment"("customerId");

-- CreateIndex
CREATE INDEX "Payment_recordedById_idx" ON "Payment"("recordedById");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_receiptNumber_key" ON "Receipt"("receiptNumber");

-- CreateIndex
CREATE INDEX "Receipt_quotationId_idx" ON "Receipt"("quotationId");

-- CreateIndex
CREATE INDEX "Receipt_customerId_idx" ON "Receipt"("customerId");

-- CreateIndex
CREATE INDEX "Receipt_generatedById_idx" ON "Receipt"("generatedById");

-- CreateIndex
CREATE INDEX "FollowUp_quotationId_idx" ON "FollowUp"("quotationId");

-- CreateIndex
CREATE INDEX "FollowUp_customerId_idx" ON "FollowUp"("customerId");

-- CreateIndex
CREATE INDEX "FollowUp_employeeId_idx" ON "FollowUp"("employeeId");

-- CreateIndex
CREATE INDEX "FollowUp_status_idx" ON "FollowUp"("status");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_isRead_idx" ON "Notification"("isRead");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_entity_idx" ON "AuditLog"("entity");

-- CreateIndex
CREATE INDEX "AuditLog_entityId_idx" ON "AuditLog"("entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_customerId_idx" ON "ActivityLog"("customerId");

-- CreateIndex
CREATE INDEX "ActivityLog_userId_idx" ON "ActivityLog"("userId");

-- CreateIndex
CREATE INDEX "ActivityLog_activityType_idx" ON "ActivityLog"("activityType");

-- CreateIndex
CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImportHistory" ADD CONSTRAINT "ProductImportHistory_importedById_fkey" FOREIGN KEY ("importedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_assignedEmployeeId_fkey" FOREIGN KEY ("assignedEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationItem" ADD CONSTRAINT "QuotationItem_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationItem" ADD CONSTRAINT "QuotationItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_followUpId_fkey" FOREIGN KEY ("followUpId") REFERENCES "FollowUp"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_followUpId_fkey" FOREIGN KEY ("followUpId") REFERENCES "FollowUp"("id") ON DELETE SET NULL ON UPDATE CASCADE;
