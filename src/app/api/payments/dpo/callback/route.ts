import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyAndRecordDpoPayment } from "@/lib/dpo-payments"

function getToken(request: NextRequest) {
  const params = request.nextUrl.searchParams
  return params.get("TransactionToken") || params.get("TransToken") || params.get("token") || params.get("ID")
}

export async function GET(request: NextRequest) {
  const token = getToken(request)
  if (!token) {
    return NextResponse.json({ error: "Missing DPO transaction token" }, { status: 400 })
  }

  const origin = process.env.APP_BASE_URL || request.nextUrl.origin

  try {
    const result = await verifyAndRecordDpoPayment(token)
    return NextResponse.redirect(`${origin}/dashboard/quotations/${result.quotation.id}?payment=${result.paid ? "success" : "failed"}`)
  } catch (error) {
    console.error("DPO callback verification failed", error)
    const payment = await prisma.payment.findUnique({ where: { dpoTransactionToken: token } })
    if (payment) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: "FAILED", notes: error instanceof Error ? error.message : "DPO callback failed" },
      })
      await prisma.quotation.update({
        where: { id: payment.quotationId },
        data: { paymentStatus: "FAILED" },
      })
      return NextResponse.redirect(`${origin}/dashboard/quotations/${payment.quotationId}?payment=failed`)
    }

    return NextResponse.redirect(`${origin}/dashboard?payment=failed`)
  }
}
