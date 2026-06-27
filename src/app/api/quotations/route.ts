import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createQuotationSchema } from "@/lib/schemas"
import requireRole from "@/lib/roles"
import { generateQuotationNumber } from "@/lib/utils"
import { ZodError } from "zod"
import { createActivityLog, createAuditLog } from "@/lib/finance"

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
  } else if (sessionCompanyId) {
    where.companyId = sessionCompanyId
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
      const discount = Number(item.discount ?? 0)
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
    const setting = await prisma.companySetting.findUnique({ where: { companyId }, select: { quotationPrefix: true, defaultCurrency: true } })
    const count = await prisma.quotation.count({ where: { companyId } })
    const quotationNumber = generateQuotationNumber(setting?.quotationPrefix || "QT", count + 1)

    const quotation = await prisma.quotation.create({
      data: {
        companyId,
        quotationNumber,
        customerId,
        createdById: session.user.id,
        assignedEmployeeId: null,
        status: "SENT",
        notes: validated.notes || null,
        terms: validated.terms || null,
        validUntil: validated.validUntil || null,
        subtotal,
        taxAmount,
        discountAmount,
        total: totalAmount,
        currency: setting?.defaultCurrency || "USD",
        items: {
          create: itemData,
        },
      },
      include: {
        customer: { include: { user: true } },
        items: true,
      },
    })

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
