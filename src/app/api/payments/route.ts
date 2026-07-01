import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createPaymentSchema } from "@/lib/schemas"
import requireRole from "@/lib/roles"
import { ZodError } from "zod"
import { createActivityLog, createAuditLog, finalizeConfirmedPayment } from "@/lib/finance"

export async function GET(request: NextRequest) {
  const session = await requireRole("ADMIN", "EMPLOYEE", "CUSTOMER")
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const role = (session.user as any).role
  const companyId = (session.user as any).companyId as string | null
  const where: any = {}

  if (role === "CUSTOMER") {
    const customer = await prisma.customer.findUnique({ where: { userId: session.user.id } })
    if (!customer) return NextResponse.json({ error: "Customer profile not found" }, { status: 404 })
    where.customerId = customer.id
  } else if (companyId) {
    where.companyId = companyId
  } else {
    return NextResponse.json({ error: "Company workspace required" }, { status: 400 })
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
  const companyId = (session.user as any).companyId as string | null
  if (!companyId) return NextResponse.json({ error: "Company workspace required" }, { status: 400 })

  try {
    const body = await request.json()
    const validated = createPaymentSchema.parse(body)

    const quotation = await prisma.quotation.findUnique({
      where: { id: validated.quotationId },
      include: {
        customer: { include: { user: true } },
        payments: {
          where: {
            status: { in: ["PARTIAL", "COMPLETED"] },
          },
        },
      },
    })
    if (!quotation) return NextResponse.json({ error: "Quotation not found" }, { status: 404 })
    if (quotation.companyId !== companyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const existingPaid = quotation.payments.reduce((sum, payment) => sum + Number(payment.amount), 0)
    const outstanding = Math.max(0, Number(quotation.total) - existingPaid)
    if (outstanding <= 0) {
      return NextResponse.json({ error: "This quotation is already fully paid" }, { status: 409 })
    }
    if (validated.amount > outstanding + 0.005) {
      return NextResponse.json(
        { error: `Payment exceeds outstanding balance of ${outstanding.toFixed(2)}` },
        { status: 400 }
      )
    }

    const count = await prisma.payment.count()
    const paymentNumber = `PM-${new Date().getFullYear()}-${String(count + 1).padStart(6, "0")}`
    const cumulativePaid = existingPaid + Number(validated.amount)
    const willComplete = cumulativePaid >= Number(quotation.total) - 0.005

    const payment = await prisma.payment.create({
      data: {
        companyId,
        paymentNumber,
        quotationId: validated.quotationId,
        customerId: quotation.customerId,
        recordedById: session.user.id,
        method: validated.method,
        amount: validated.amount,
        currency: quotation.currency,
        status: willComplete ? "COMPLETED" : "PARTIAL",
        provider: "MANUAL",
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

    await prisma.quotation.update({
      where: { id: quotation.id },
      data: {
        paymentProvider: "MANUAL",
        paymentMethod: validated.method,
        paymentReference: validated.reference || null,
      },
    })
    await createActivityLog({
      companyId,
      customerId: quotation.customerId,
      userId: session.user.id,
      activityType: "PAYMENT_RECORDED",
      description: `Payment ${payment.paymentNumber} recorded for ${quotation.quotationNumber}`,
      details: {
        amount: Number(payment.amount),
        method: payment.method,
        status: payment.status,
        outstandingBefore: outstanding,
      },
      quotationId: quotation.id,
      paymentId: payment.id,
    })
    const finalized = await finalizeConfirmedPayment({
      paymentId: payment.id,
      quotationId: quotation.id,
      actorUserId: session.user.id,
      receiptNotes: "Receipt generated automatically after staff-confirmed payment",
    })
    await createAuditLog({
      companyId,
      userId: session.user.id,
      action: "CREATE",
      entity: "Payment",
      entityId: payment.id,
      changes: {
        paymentNumber: payment.paymentNumber,
        quotationId: quotation.id,
        amount: Number(payment.amount),
        status: payment.status,
      },
    })
    await prisma.notification.create({
      data: {
        userId: quotation.customer.userId,
        type: "PAYMENT_RECORDED",
        title: "Payment recorded",
        message: `A payment of ${Number(payment.amount).toFixed(2)} was recorded for ${quotation.quotationNumber}.`,
        relatedId: payment.id,
        relatedModel: "Payment",
        customerId: quotation.customerId,
        quotationId: quotation.id,
        paymentId: payment.id,
      },
    })

    return NextResponse.json({ data: payment, receipt: finalized.receipt, stockMovements: finalized.movements }, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "Validation failed", details: err.errors }, { status: 400 })
    }

    console.error(err)
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to record payment" }, { status: 500 })
  }
}
