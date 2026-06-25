import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createReceiptSchema } from "@/lib/schemas"
import requireRole from "@/lib/roles"
import { ZodError } from "zod"

export async function GET(request: NextRequest) {
  const session = await requireRole("ADMIN", "EMPLOYEE", "CUSTOMER")
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const role = (session.user as any).role
  const where: any = {}

  if (role === "CUSTOMER") {
    const customer = await prisma.customer.findUnique({ where: { userId: session.user.id } })
    if (!customer) return NextResponse.json({ error: "Customer profile not found" }, { status: 404 })
    where.customerId = customer.id
  }

  const receipts = await prisma.receipt.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      quotation: true,
      customer: true,
      generatedBy: true,
    },
  })

  return NextResponse.json({ data: receipts })
}

export async function POST(request: NextRequest) {
  const session = await requireRole("ADMIN", "EMPLOYEE")
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await request.json()
    const validated = createReceiptSchema.parse(body)

    const quotation = await prisma.quotation.findUnique({ where: { id: validated.quotationId } })
    if (!quotation) return NextResponse.json({ error: "Quotation not found" }, { status: 404 })

    const customer = await prisma.customer.findUnique({ where: { id: quotation.customerId } })
    if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 })

    const count = await prisma.receipt.count()
    const receiptNumber = `RC-${new Date().getFullYear()}-${String(count + 1).padStart(6, "0")}`

    const receipt = await prisma.receipt.create({
      data: {
        receiptNumber,
        quotationId: validated.quotationId,
        customerId: quotation.customerId,
        generatedById: session.user.id,
        amount: validated.amount,
        currency: quotation.currency,
        paymentMethod: validated.paymentMethod,
        reference: validated.reference || null,
        notes: validated.notes || null,
      },
      include: {
        quotation: true,
        customer: true,
        generatedBy: true,
      },
    })

    if (validated.amount >= Number(quotation.total)) {
      await prisma.quotation.update({
        where: { id: quotation.id },
        data: { status: "COMPLETED" },
      })
    }

    return NextResponse.json({ data: receipt }, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "Validation failed", details: err.errors }, { status: 400 })
    }

    console.error(err)
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to generate receipt" }, { status: 500 })
  }
}
