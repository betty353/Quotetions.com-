import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createReceiptSchema } from "@/lib/schemas"
import requireRole from "@/lib/roles"
import { ZodError } from "zod"
import { generateUniqueReceiptNumber } from "@/lib/receipts"
import { createActivityLog, createAuditLog, syncQuotationPaymentState } from "@/lib/finance"

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

    const quotation = await prisma.quotation.findUnique({
      where: { id: validated.quotationId },
      include: {
        customer: { include: { user: true } },
        payments: {
          where: {
            status: { in: ["PARTIAL", "COMPLETED"] },
          },
        },
        receipts: true,
      },
    })
    if (!quotation) return NextResponse.json({ error: "Quotation not found" }, { status: 404 })

    const totalPaid = quotation.payments.reduce((sum, payment) => sum + Number(payment.amount), 0)
    const totalReceipted = quotation.receipts.reduce((sum, receipt) => sum + Number(receipt.amount), 0)
    const receiptable = Math.max(0, totalPaid - totalReceipted)

    if (receiptable <= 0) {
      return NextResponse.json({ error: "No confirmed unreceipted payment is available for this quotation" }, { status: 409 })
    }

    if (validated.amount > receiptable + 0.005) {
      return NextResponse.json(
        { error: `Receipt exceeds unreceipted paid balance of ${receiptable.toFixed(2)}` },
        { status: 400 }
      )
    }

    const payment = await prisma.payment.findFirst({
      where: {
        quotationId: quotation.id,
        status: { in: ["PARTIAL", "COMPLETED"] },
      },
      orderBy: { paymentDate: "desc" },
    })

    const receiptNumber = await generateUniqueReceiptNumber()

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
        provider: "MANUAL",
        paymentId: payment?.id ?? null,
      },
      include: {
        quotation: true,
        customer: true,
        generatedBy: true,
      },
    })

    await syncQuotationPaymentState(quotation.id)
    await prisma.quotation.update({
      where: { id: quotation.id },
      data: {
        paymentProvider: "MANUAL",
        paymentMethod: validated.paymentMethod,
        paymentReference: validated.reference || null,
        receiptNumber,
      },
    })
    await createActivityLog({
      customerId: quotation.customerId,
      userId: session.user.id,
      activityType: "RECEIPT_GENERATED",
      description: `Receipt ${receipt.receiptNumber} generated for ${quotation.quotationNumber}`,
      details: {
        amount: Number(receipt.amount),
        paymentMethod: receipt.paymentMethod,
        receiptableBefore: receiptable,
      },
      quotationId: quotation.id,
      paymentId: payment?.id ?? null,
      receiptId: receipt.id,
    })
    await createAuditLog({
      userId: session.user.id,
      action: "CREATE",
      entity: "Receipt",
      entityId: receipt.id,
      changes: {
        receiptNumber: receipt.receiptNumber,
        quotationId: quotation.id,
        amount: Number(receipt.amount),
      },
    })
    await prisma.notification.create({
      data: {
        userId: quotation.customer.userId,
        type: "RECEIPT_GENERATED",
        title: "Receipt generated",
        message: `Receipt ${receipt.receiptNumber} was generated for ${quotation.quotationNumber}.`,
        relatedId: receipt.id,
        relatedModel: "Receipt",
        customerId: quotation.customerId,
        quotationId: quotation.id,
        paymentId: payment?.id ?? null,
        receiptId: receipt.id,
      },
    })

    return NextResponse.json({ data: receipt }, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "Validation failed", details: err.errors }, { status: 400 })
    }

    console.error(err)
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to generate receipt" }, { status: 500 })
  }
}
