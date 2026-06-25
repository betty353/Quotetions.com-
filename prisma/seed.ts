import { PrismaClient, UserRole } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  console.log("Starting database seed...")

  // Clear existing data
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
  await prisma.category.deleteMany()
  await prisma.session.deleteMany()
  await prisma.account.deleteMany()
  await prisma.user.deleteMany()
  await prisma.companySetting.deleteMany()

  console.log("Cleared existing data")

  // Create company settings
  const companySetting = await prisma.companySetting.create({
    data: {
      companyName: "Quotely Inc",
      companyEmail: "info@quotely.com",
      companyPhone: "+1 (555) 123-4567",
      companyAddress: "123 Business Street",
      companyCity: "San Francisco",
      companyRegion: "CA",
      companyCountry: "USA",
      companyPostalCode: "94105",
      companyTaxId: "12-3456789",
      companyRegistration: "REG-2023-001",
      defaultCurrency: "USD",
      taxRate: 10,
      quotationPrefix: "QT",
      receiptPrefix: "RC",
      paymentPrefix: "PM",
      quotationValidDays: 30,
      bankName: "First National Bank",
      bankAccount: "1234567890",
      bankCode: "123456",
      companyWebsite: "https://quotely.com",
      companyLogo: null,
      signatureImageUrl: null,
      documentFont: "Helvetica",
    },
  })

  console.log("Created company settings")

  // Create Admin User
  const adminPassword = await bcrypt.hash("password123", 10)
  const admin = await prisma.user.create({
    data: {
      email: "admin@company.com",
      password: adminPassword,
      firstName: "Admin",
      lastName: "User",
      phone: "+1234567890",
      role: UserRole.ADMIN,
      isActive: true,
      isEmailVerified: true,
    },
  })

  console.log("Created admin user")

  // Create Employee Users
  const employeePassword = await bcrypt.hash("password123", 10)
  const employee1 = await prisma.user.create({
    data: {
      email: "employee1@company.com",
      password: employeePassword,
      firstName: "John",
      lastName: "Sales",
      phone: "+1234567891",
      role: UserRole.EMPLOYEE,
      isActive: true,
      isEmailVerified: true,
    },
  })

  const employee2 = await prisma.user.create({
    data: {
      email: "employee2@company.com",
      password: employeePassword,
      firstName: "Jane",
      lastName: "Manager",
      phone: "+1234567892",
      role: UserRole.EMPLOYEE,
      isActive: true,
      isEmailVerified: true,
    },
  })

  console.log("Created employee users")

  // Create Employee Records
  const emp1 = await prisma.employee.create({
    data: {
      userId: employee1.id,
      employeeId: "EMP-00001",
      department: "Sales",
      position: "Sales Representative",
      phone: "+1234567891",
      hireDate: new Date("2023-01-15"),
      performanceRating: 4.5,
      quotaTarget: 50000,
      commissionRate: 5,
      status: "ACTIVE",
    },
  })

  const emp2 = await prisma.employee.create({
    data: {
      userId: employee2.id,
      employeeId: "EMP-00002",
      department: "Sales",
      position: "Sales Manager",
      phone: "+1234567892",
      hireDate: new Date("2022-06-01"),
      performanceRating: 4.8,
      quotaTarget: 100000,
      commissionRate: 7,
      status: "ACTIVE",
    },
  })

  console.log("Created employee records")

  // Create Customer Users
  const customerPassword = await bcrypt.hash("password123", 10)
  const customer1 = await prisma.user.create({
    data: {
      email: "customer@gmail.com",
      password: customerPassword,
      firstName: "John",
      lastName: "Client",
      phone: "+1987654321",
      role: UserRole.CUSTOMER,
      isActive: true,
      isEmailVerified: true,
    },
  })

  const customer2 = await prisma.user.create({
    data: {
      email: "jane@company.com",
      password: customerPassword,
      firstName: "Jane",
      lastName: "Company",
      phone: "+1987654322",
      role: UserRole.CUSTOMER,
      isActive: true,
      isEmailVerified: true,
    },
  })

  console.log("Created customer users")

  // Create Customer Records
  const cust1 = await prisma.customer.create({
    data: {
      userId: customer1.id,
      companyName: "Tech Solutions Inc",
      companyRegistration: "REG-2022-001",
      taxId: "98-7654321",
      phone: "+1987654321",
      address: "456 Tech Avenue",
      city: "New York",
      region: "NY",
      country: "USA",
      postalCode: "10001",
      contactPerson: "John Client",
      creditLimit: 50000,
      creditUsed: 15000,
      status: "ACTIVE",
    },
  })

  const cust2 = await prisma.customer.create({
    data: {
      userId: customer2.id,
      companyName: "Global Enterprises Ltd",
      companyRegistration: "REG-2021-005",
      taxId: "56-1234567",
      phone: "+1987654322",
      address: "789 Business Plaza",
      city: "Los Angeles",
      region: "CA",
      country: "USA",
      postalCode: "90001",
      contactPerson: "Jane Company",
      creditLimit: 100000,
      creditUsed: 45000,
      status: "ACTIVE",
    },
  })

  console.log("Created customer records")

  // Create Categories
  const category1 = await prisma.category.create({
    data: {
      name: "Software",
      description: "Software products and licenses",
    },
  })

  const category2 = await prisma.category.create({
    data: {
      name: "Hardware",
      description: "Hardware and equipment",
    },
  })

  const category3 = await prisma.category.create({
    data: {
      name: "Services",
      description: "Professional services",
    },
  })

  console.log("Created product categories")

  // Create Products
  const prod1 = await prisma.product.create({
    data: {
      sku: "SOFT-001",
      name: "Enterprise CRM License",
      description: "Full-featured CRM software with 30 days support",
      categoryId: category1.id,
      unitPrice: 2500,
      currency: "USD",
      stock: 100,
      reorderLevel: 10,
      status: "ACTIVE",
    },
  })

  const prod2 = await prisma.product.create({
    data: {
      sku: "SOFT-002",
      name: "Cloud Server - Professional",
      description: "Cloud hosting with 99.9% uptime",
      categoryId: category1.id,
      unitPrice: 500,
      currency: "USD",
      stock: 50,
      reorderLevel: 5,
      status: "ACTIVE",
    },
  })

  const prod3 = await prisma.product.create({
    data: {
      sku: "HARD-001",
      name: "Laptop Pro 15\"",
      description: "High-performance business laptop",
      categoryId: category2.id,
      unitPrice: 1800,
      currency: "USD",
      stock: 25,
      reorderLevel: 5,
      status: "ACTIVE",
    },
  })

  const prod4 = await prisma.product.create({
    data: {
      sku: "SERV-001",
      name: "Consulting Services - 40 hours",
      description: "Professional consulting for business optimization",
      categoryId: category3.id,
      unitPrice: 300,
      currency: "USD",
      stock: 999,
      reorderLevel: 1,
      status: "ACTIVE",
    },
  })

  console.log("Created products")

  // Create Quotations
  const quot1 = await prisma.quotation.create({
    data: {
      quotationNumber: "QT-2026-000001",
      customerId: cust1.id,
      createdById: employee1.id,
      assignedEmployeeId: emp1.id,
      status: "APPROVED",
      subtotal: 5000,
      taxAmount: 500,
      discountAmount: 0,
      total: 5500,
      currency: "USD",
      notes: "Standard enterprise package",
      terms: "Payment due within 30 days",
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      viewedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      approvedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    },
  })

  const quot2 = await prisma.quotation.create({
    data: {
      quotationNumber: "QT-2026-000002",
      customerId: cust2.id,
      createdById: employee2.id,
      assignedEmployeeId: emp2.id,
      status: "COMPLETED",
      subtotal: 10000,
      taxAmount: 1000,
      discountAmount: 500,
      total: 10500,
      currency: "USD",
      notes: "Large enterprise license",
      terms: "Payment due within 45 days",
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      viewedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      approvedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    },
  })

  const quot3 = await prisma.quotation.create({
    data: {
      quotationNumber: "QT-2026-000003",
      customerId: cust1.id,
      createdById: employee1.id,
      assignedEmployeeId: emp1.id,
      status: "SENT",
      subtotal: 3600,
      taxAmount: 360,
      discountAmount: 0,
      total: 3960,
      currency: "USD",
      notes: "Service package for 40 hours",
      terms: "Payment due within 14 days",
      validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
  })

  console.log("Created quotations")

  // Create Quotation Items
  await prisma.quotationItem.create({
    data: {
      quotationId: quot1.id,
      productId: prod1.id,
      quantity: 2,
      unitPrice: 2500,
      discount: 0,
      tax: 500,
      total: 5500,
    },
  })

  await prisma.quotationItem.create({
    data: {
      quotationId: quot2.id,
      productId: prod1.id,
      quantity: 4,
      unitPrice: 2500,
      discount: 500,
      tax: 1000,
      total: 10500,
    },
  })

  await prisma.quotationItem.create({
    data: {
      quotationId: quot3.id,
      productId: prod4.id,
      quantity: 12,
      unitPrice: 300,
      discount: 0,
      tax: 360,
      total: 3960,
    },
  })

  console.log("Created quotation items")

  // Create Payments
  const payment1 = await prisma.payment.create({
    data: {
      paymentNumber: "PM-2026-000001",
      quotationId: quot1.id,
      customerId: cust1.id,
      recordedById: employee1.id,
      method: "BANK_TRANSFER",
      amount: 5500,
      currency: "USD",
      status: "COMPLETED",
      reference: "TRF-2026-001",
      notes: "Payment received",
      paymentDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    },
  })

  const payment2 = await prisma.payment.create({
    data: {
      paymentNumber: "PM-2026-000002",
      quotationId: quot2.id,
      customerId: cust2.id,
      recordedById: employee2.id,
      method: "CARD",
      amount: 10500,
      currency: "USD",
      status: "COMPLETED",
      reference: "CARD-2026-001",
      notes: "Credit card payment",
      paymentDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
  })

  console.log("Created payments")

  // Create Receipts
  await prisma.receipt.create({
    data: {
      receiptNumber: "RC-2026-000001",
      quotationId: quot1.id,
      customerId: cust1.id,
      generatedById: employee1.id,
      amount: 5500,
      currency: "USD",
      paymentMethod: "BANK_TRANSFER",
      reference: "TRF-2026-001",
      notes: "Professional services receipt",
    },
  })

  await prisma.receipt.create({
    data: {
      receiptNumber: "RC-2026-000002",
      quotationId: quot2.id,
      customerId: cust2.id,
      generatedById: employee2.id,
      amount: 10500,
      currency: "USD",
      paymentMethod: "CARD",
      reference: "CARD-2026-001",
      notes: "Enterprise software license receipt",
    },
  })

  console.log("Created receipts")

  // Create Follow-ups
  await prisma.followUp.create({
    data: {
      quotationId: quot3.id,
      customerId: cust1.id,
      employeeId: emp1.id,
      createdById: employee1.id,
      status: "PENDING",
      type: "CALL",
      callNotes: "Need to follow up about pricing",
      nextFollowUpDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      reminderDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
    },
  })

  console.log("Created follow-ups")

  console.log("Database seed completed successfully!")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
