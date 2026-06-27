import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function clearBusinessData() {
  await prisma.notification.deleteMany()
  await prisma.auditLog.deleteMany()
  await prisma.activityLog.deleteMany()
  await prisma.followUp.deleteMany()
  await prisma.receipt.deleteMany()
  await prisma.payment.deleteMany()
  await prisma.quotationItem.deleteMany()
  await prisma.quotation.deleteMany()
  await prisma.employee.deleteMany()
  await prisma.customer.deleteMany()
  await prisma.product.deleteMany()
  await prisma.productImportHistory.deleteMany()
  await prisma.category.deleteMany()
  await prisma.session.deleteMany()
  await prisma.account.deleteMany()
  await prisma.user.deleteMany()
  await prisma.companySetting.deleteMany()
}

async function main() {
  console.log("Starting production seed...")

  await clearBusinessData()
  console.log("Cleared existing business data")

  await prisma.companySetting.create({
    data: {
      companyName: process.env.COMPANY_NAME || "Your Company",
      companyEmail: process.env.COMPANY_EMAIL || "admin@example.com",
      companyPhone: process.env.COMPANY_PHONE || "",
      defaultCurrency: process.env.DEFAULT_CURRENCY || "USD",
      taxRate: Number(process.env.DEFAULT_TAX_RATE || 0),
      quotationPrefix: "QT",
      receiptPrefix: "RC",
      paymentPrefix: "PM",
      quotationValidDays: 30,
      companyLogo: "/logo.jpg",
      documentFont: "Helvetica",
    },
  })

  console.log("Created base company settings")
  console.log("Seed complete. Register the first real user to create the Admin account.")
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
