import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import requireRole from "@/lib/roles"
import { createDpoPaymentSchema } from "@/lib/schemas"
import { createDpoToken, getDpoCredentials, getDpoPaymentUrl } from "@/lib/dpo"
import { DPO_SETTLEMENT_NOTE } from "@/lib/dpo-payments"
import { ZodError } from "zod"

function getBaseUrl(request: NextRequest) {
  return process.env.APP_BASE_URL || new URL(request.url).origin
}

export async function POST(request: NextRequest) {
  const session = await requireRole("ADMIN", "EMPLOYEE", "CUSTOMER")
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await request.json()
    const { quotationId } = createDpoPaymentSchema.parse(body)

    const setting = await prisma.companySetting.findFirst()
    if (!setting?.paymentSetupComplete || !setting.paymentEnabled) {
      return NextResponse.json({ error: "Payment setup is not complete" }, { status: 400 })
    }

    const quotation = await prisma.quotation.findUnique({
      where: { id: quotationId },
      include: {
        customer: { include: { user: true } },
      },
    })
    if (!quotation) return NextResponse.json({ error: "Quotation not found" }, { status: 404 })

    const role = (session.user as any).role
    if (role === "CUSTOMER") {
      const customer = await prisma.customer.findUnique({ where: { userId: session.user.id } })
      if (!customer || customer.id !== quotation.customerId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
      }
    }

    if (quotation.paymentStatus === "COMPLETED" || quotation.status === "COMPLETED") {
      return NextResponse.json({ error: "This quotation is already paid" }, { status: 409 })
    }

    const existingPayment = await prisma.payment.findFirst({
      where: {
        quotationId,
        provider: "DPO",
        status: "PENDING",
        dpoTransactionToken: { not: null },
      },
      orderBy: { createdAt: "desc" },
    })

    if (existingPayment?.dpoTransactionToken) {
      return NextResponse.json({
        data: {
          transactionToken: existingPayment.dpoTransactionToken,
          redirectUrl: getDpoPaymentUrl(existingPayment.dpoTransactionToken),
        },
      })
    }

    const { companyToken, serviceType } = getDpoCredentials(setting)
    const baseUrl = getBaseUrl(request)
    const callbackUrl = setting.dpoCallbackUrl || `${baseUrl}/api/payments/dpo/callback`
    const returnUrl = setting.dpoReturnUrl || `${baseUrl}/dashboard/quotations/${quotation.id}`
    const amount = Number(quotation.total)
    const companyRef = `${quotation.quotationNumber}-${Date.now()}`

    const dpo = await createDpoToken({
      amount,
      currency: quotation.currency,
      companyRef,
      description: `Payment for ${quotation.quotationNumber}`,
      redirectUrl: `${callbackUrl}?quotationId=${encodeURIComponent(quotation.id)}`,
      backUrl: returnUrl,
      companyToken,
      serviceType,
    })

    const count = await prisma.payment.count()
    const paymentNumber = `PM-${new Date().getFullYear()}-${String(count + 1).padStart(6, "0")}`

    await prisma.payment.create({
      data: {
        paymentNumber,
        quotationId: quotation.id,
        customerId: quotation.customerId,
        recordedById: session.user.id,
        method: "OTHER",
        amount,
        currency: quotation.currency,
        status: "PENDING",
        provider: "DPO",
        reference: dpo.transactionReference || companyRef,
        notes: "DPO payment transaction created",
        dpoTransactionToken: dpo.transactionToken,
        paymentDate: new Date(),
      },
    })

    await prisma.quotation.update({
      where: { id: quotation.id },
      data: {
        paymentStatus: "PENDING",
        paymentProvider: "DPO",
        dpoTransactionToken: dpo.transactionToken,
        paymentReference: dpo.transactionReference || companyRef,
        settlementNote: DPO_SETTLEMENT_NOTE,
      },
    })

    return NextResponse.json({
      data: {
        transactionToken: dpo.transactionToken,
        redirectUrl: dpo.paymentUrl,
      },
    })
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "Validation failed", details: err.errors }, { status: 400 })
    }

    console.error("DPO create payment error", err)
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to create DPO payment" }, { status: 500 })
  }
}
