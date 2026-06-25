import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createQuotationSchema } from "@/lib/schemas"
import requireRole from "@/lib/roles"
import { generateQuotationNumber } from "@/lib/utils"
import { ZodError } from "zod"

export async function GET(request: NextRequest) {
  const session = await requireRole("ADMIN", "EMPLOYEE", "CUSTOMER")
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(request.url)
  const page = Number(url.searchParams.get("page") || "1")
  const pageSize = Number(url.searchParams.get("pageSize") || "20")
  const status = url.searchParams.get("status") || undefined

  const role = (session.user as any).role
  const where: any = {}

  if (status) {
    where.status = status
  }

  if (role === "CUSTOMER") {
    const customer = await prisma.customer.findUnique({ where: { userId: session.user.id } })
    if (!customer) return NextResponse.json({ error: "Customer profile not found" }, { status: 404 })
    where.customerId = customer.id
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

    if (role === "CUSTOMER") {
      const customer = await prisma.customer.findUnique({ where: { userId: session.user.id } })
      if (!customer) return NextResponse.json({ error: "Customer profile not found" }, { status: 404 })
      customerId = customer.id
    }

    const productIds = validated.items.map((item) => item.productId)
    const products = await prisma.product.findMany({ where: { id: { in: productIds } } })
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
    const count = await prisma.quotation.count()
    const quotationNumber = generateQuotationNumber("QT", count + 1)

    const quotation = await prisma.quotation.create({
      data: {
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
        currency: "USD",
        items: {
          create: itemData,
        },
      },
      include: {
        customer: true,
        items: true,
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
