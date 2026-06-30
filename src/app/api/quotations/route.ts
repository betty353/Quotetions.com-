import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { createQuotationSchema } from "@/lib/schemas"
import requireRole from "@/lib/roles"
import { ZodError } from "zod"
import { createActivityLog, createAuditLog } from "@/lib/finance"
import { isCompanyAdminRole } from "@/lib/tenant"
import { generateNextQuotationNumber, quotationValidUntil } from "@/lib/quotation-number"

export async function GET(request: NextRequest) {
  const session = await requireRole("ADMIN", "EMPLOYEE", "CUSTOMER")
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(request.url)
  const page = Number(url.searchParams.get("page") || "1")
  const pageSize = Number(url.searchParams.get("pageSize") || "20")
  const status = url.searchParams.get("status") || undefined

  const role = (session.user as any).role
  const sessionCompanyId = session.user.companyId
  const where: any = {}

  if (status) {
    where.status = status
  }

  if (role === "CUSTOMER") {
    const customer = await prisma.customer.findUnique({ where: { userId: session.user.id } })
    if (!customer) return NextResponse.json({ error: "Customer profile not found" }, { status: 404 })
    where.customerId = customer.id
    where.OR = [
      { validUntil: null },
      { validUntil: { gte: new Date() } },
      { paymentStatus: "COMPLETED" },
      { status: "COMPLETED" },
    ]
  } else if (sessionCompanyId) {
    where.companyId = sessionCompanyId
  } else {
    return NextResponse.json({ error: "Company workspace required" }, { status: 400 })
  }

  const total = await prisma.quotation.count({ where })
  const quotations = await prisma.quotation.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
    include: {
      customer: true,
      createdBy: true,
      assignedEmployee: true,
    },
  })

  return NextResponse.json({ data: quotations, total, page, pageSize })
}

export async function POST(request: NextRequest) {
  const session = await requireRole("ADMIN", "EMPLOYEE", "CUSTOMER")
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await request.json()
    const validated = createQuotationSchema.parse(body)

    let customerId = validated.customerId
    const role = (session.user as any).role
    let companyId = session.user.companyId ?? null

    if (role === "CUSTOMER") {
      const customer = await prisma.customer.findUnique({ where: { userId: session.user.id } })
      if (!customer) return NextResponse.json({ error: "Customer profile not found" }, { status: 404 })
      customerId = customer.id
      companyId = customer.companyId

      const hasCompletedPayment = await prisma.payment.findFirst({
        where: { customerId: customer.id, status: "COMPLETED" },
        select: { id: true },
      })
      const openUnpaid = await prisma.quotation.count({
        where: {
          customerId: customer.id,
          paymentStatus: { not: "COMPLETED" },
          status: { in: ["DRAFT", "SENT", "VIEWED", "APPROVED"] },
        },
      })
      const limit = hasCompletedPayment ? 5 : 2
      if (openUnpaid >= limit) {
        return NextResponse.json({
          error: hasCompletedPayment
            ? "Please complete or pay one of your open quotations before creating more requests."
            : "Please wait for the company to respond or complete your first order before creating more quotation requests.",
        }, { status: 403 })
      }
    }
    if (!companyId) return NextResponse.json({ error: "Company context is required" }, { status: 400 })

    const customer = await prisma.customer.findUnique({ where: { id: customerId }, select: { id: true, companyId: true } })
    if (!customer || customer.companyId !== companyId) {
      return NextResponse.json({ error: "Customer does not belong to this company" }, { status: 403 })
    }

    const productIds = validated.items.map((item) => item.productId)
    const products = await prisma.product.findMany({ where: { id: { in: productIds }, companyId } })
    const productMap = new Map(products.map((product) => [product.id, product]))

    const itemData = validated.items.map((item) => {
      const product = productMap.get(item.productId)
      if (!product) {
        throw new Error(`Product ${item.productId} not found`)
      }

      const quantity = Number(item.quantity)
      const unitPrice = Number(product.unitPrice)
      const rawDiscount = Number(item.discount ?? 0)
      const discount = role === "CUSTOMER" ? 0 : rawDiscount
      const subtotal = quantity * unitPrice
      const total = Math.max(0, subtotal - discount)

      return {
        productId: item.productId,
        quantity,
        unitPrice,
        discount,
        tax: 0,
        total,
      }
    })

    const subtotal = itemData.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
    const discountAmount = itemData.reduce((sum, item) => sum + item.discount, 0)
    const taxAmount = 0
    const totalAmount = itemData.reduce((sum, item) => sum + item.total, 0)

    const setting = await prisma.companySetting.findUnique({
      where: { companyId },
      select: { quotationPrefix: true, defaultCurrency: true, quotationValidDays: true, termsAndConditions: true },
    })

    if (role === "EMPLOYEE" && discountAmount > 0) {
      const request = await prisma.discountRequest.create({
        data: {
          companyId,
          customerId,
          requestedById: session.user.id,
          status: "PENDING",
          items: itemData,
          notes: validated.notes || null,
          terms: validated.terms || setting?.termsAndConditions || null,
          validUntil: validated.validUntil || quotationValidUntil(setting?.quotationValidDays || 7),
          subtotal,
          discountAmount,
          total: totalAmount,
        },
      })

      const admins = await prisma.user.findMany({
        where: { companyId, role: { in: ["SUPER_ADMIN", "COMPANY_ADMIN", "ADMIN"] }, isActive: true },
        select: { id: true },
      })
      if (admins.length > 0) {
        await prisma.notification.createMany({
          data: admins.map((admin) => ({
            companyId,
            userId: admin.id,
            type: "SYSTEM_ALERT",
            title: "Discount approval needed",
            message: `An employee requested a ${discountAmount.toFixed(2)} discount for a quotation.`,
            relatedId: request.id,
            relatedModel: "DiscountRequest",
            customerId,
          })),
        })
      }

      await createAuditLog({
        companyId,
        userId: session.user.id,
        action: "CREATE",
        entity: "DiscountRequest",
        entityId: request.id,
        changes: { discountAmount, total: totalAmount },
      })

      return NextResponse.json({ discountRequest: true, data: request }, { status: 202 })
    }

    if (!isCompanyAdminRole(role) && discountAmount > 0) {
      return NextResponse.json({ error: "Discounts require admin approval." }, { status: 403 })
    }
    let quotation = null
    for (let attempt = 1; attempt <= 25; attempt += 1) {
      const quotationNumber = await generateNextQuotationNumber(prisma, companyId, setting?.quotationPrefix || "QT", attempt)
      try {
        quotation = await prisma.quotation.create({
          data: {
            companyId,
            quotationNumber,
            customerId,
            createdById: session.user.id,
            assignedEmployeeId: null,
            status: "SENT",
            notes: validated.notes || null,
            terms: validated.terms || setting?.termsAndConditions || null,
            validUntil: validated.validUntil || quotationValidUntil(setting?.quotationValidDays || 7),
            subtotal,
            taxAmount,
            discountAmount,
            total: totalAmount,
            currency: "ZMW",
            items: {
              create: itemData,
            },
          },
          include: {
            customer: { include: { user: true } },
            items: true,
          },
        })
        break
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") continue
        throw error
      }
    }

    if (!quotation) {
      return NextResponse.json({ error: "Could not allocate quotation number. Please try again." }, { status: 409 })
    }

    await createActivityLog({
      companyId,
      customerId,
      userId: session.user.id,
      activityType: "QUOTATION_CREATED",
      description: `Quotation ${quotation.quotationNumber} created`,
      details: {
        total: totalAmount,
        itemCount: itemData.length,
      },
      quotationId: quotation.id,
    })
    await createAuditLog({
      companyId,
      userId: session.user.id,
      action: "CREATE",
      entity: "Quotation",
      entityId: quotation.id,
      changes: {
        quotationNumber: quotation.quotationNumber,
        total: totalAmount,
        status: quotation.status,
      },
    })
    await prisma.notification.create({
      data: {
        userId: quotation.customer.userId,
        companyId,
        type: "QUOTATION_CREATED",
        title: "Quotation created",
        message: `Quotation ${quotation.quotationNumber} has been created.`,
        relatedId: quotation.id,
        relatedModel: "Quotation",
        customerId,
        quotationId: quotation.id,
      },
    })

    return NextResponse.json({ data: quotation }, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "Validation failed", details: err.errors }, { status: 400 })
    }

    console.error(err)
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to create quotation" }, { status: 500 })
  }
}
