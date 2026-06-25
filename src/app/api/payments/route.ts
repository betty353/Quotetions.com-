import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createPaymentSchema } from "@/lib/schemas"
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

  const payments = await prisma.payment.findMany({
    where,
    orderBy: { paymentDate: "desc" },
    include: {
      quotation: true,
      customer: true,
      recordedBy: true,
    },
  })

  return NextResponse.json({ data: payments })
}

export async function POST(request: NextRequest) {
  const session = await requireRole("ADMIN", "EMPLOYEE")
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await request.json()
    const validated = createPaymentSchema.parse(body)

    const quotation = await prisma.quotation.findUnique({ where: { id: validated.quotationId } })
    if (!quotation) return NextResponse.json({ error: "Quotation not found" }, { status: 404 })

    const customer = await prisma.customer.findUnique({ where: { id: quotation.customerId } })
    if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 })

    const count = await prisma.payment.count()
    const paymentNumber = `PM-${new Date().getFullYear()}-${String(count + 1).padStart(6, "0")}`

    const payment = await prisma.payment.create({
      data: {
        paymentNumber,
        quotationId: validated.quotationId,
        customerId: quotation.customerId,
        recordedById: session.user.id,
        method: validated.method,
        amount: validated.amount,
        currency: quotation.currency,
        status: validated.amount >= Number(quotation.total) ? "COMPLETED" : "PARTIAL",
        reference: validated.reference || null,
        notes: validated.notes || null,
        paymentDate: validated.paymentDate,
      },
      include: {
        quotation: true,
        customer: true,
        recordedBy: true,
      },
    })

    if (validated.amount >= Number(quotation.total)) {
      await prisma.quotation.update({
        where: { id: quotation.id },
        data: { status: "COMPLETED" },
      })
    }

    return NextResponse.json({ data: payment }, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "Validation failed", details: err.errors }, { status: 400 })
    }

    console.error(err)
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to record payment" }, { status: 500 })
  }
}
