import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import requireRole from "@/lib/roles"
import { verifyDpoPaymentSchema } from "@/lib/schemas"
import { verifyAndRecordDpoPayment } from "@/lib/dpo-payments"
import { ZodError } from "zod"

export async function POST(request: NextRequest) {
  const session = await requireRole("ADMIN", "EMPLOYEE", "CUSTOMER")
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await request.json()
    const validated = verifyDpoPaymentSchema.parse(body)

    let token = validated.transactionToken
    if (!token && validated.quotationId) {
      const quotation = await prisma.quotation.findUnique({ where: { id: validated.quotationId } })
      token = quotation?.dpoTransactionToken || undefined
    }

    if (!token) {
      return NextResponse.json({ error: "DPO transaction token not found" }, { status: 404 })
    }

    const payment = await prisma.payment.findUnique({
      where: { dpoTransactionToken: token },
      include: { quotation: true },
    })
    if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 })

    const role = (session.user as any).role
    if (role === "CUSTOMER") {
      const customer = await prisma.customer.findUnique({ where: { userId: session.user.id } })
      if (!customer || customer.id !== payment.customerId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
      }
    }

    const result = await verifyAndRecordDpoPayment(token)
    return NextResponse.json({
      data: {
        paid: result.paid,
        quotation: result.quotation,
        payment: result.payment,
        receipt: result.receipt,
        dpo: result.result,
      },
    })
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "Validation failed", details: err.errors }, { status: 400 })
    }

    console.error("DPO manual verification failed", err)
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to verify DPO payment" }, { status: 500 })
  }
}
