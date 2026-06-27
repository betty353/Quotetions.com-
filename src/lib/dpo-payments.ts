import { prisma } from "@/lib/prisma"
import { getDpoCredentials, isDpoPaymentSuccessful, verifyDpoToken, type DpoVerifyResult } from "@/lib/dpo"
import type { Prisma } from "@prisma/client"

export const DPO_SETTLEMENT_NOTE =
  "DPO processes the real money and settles funds to your registered merchant bank/mobile money account. This system only records and verifies payment status."

function toPaymentMethod(value?: string | null) {
  const normalized = (value || "").toLowerCase()
  if (normalized.includes("airtel")) return "AIRTEL_MONEY"
  if (normalized.includes("mtn")) return "MTN_MOBILE_MONEY"
  if (normalized.includes("zamtel") || normalized.includes("kwacha")) return "ZAMTEL_KWACHA"
  if (normalized.includes("mobile") || normalized.includes("money")) return "MOBILE_MONEY"
  if (normalized.includes("card") || normalized.includes("visa") || normalized.includes("mastercard")) return "CARD"
  if (normalized.includes("bank")) return "BANK_TRANSFER"
  return "OTHER"
}

async function generateReceiptNumber(tx: Prisma.TransactionClient) {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "")
  const dayStart = new Date()
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(dayStart)
  dayEnd.setDate(dayEnd.getDate() + 1)
  const count = await tx.receipt.count({
    where: {
      createdAt: {
        gte: dayStart,
        lt: dayEnd,
      },
    },
  })
  return `RCT-${datePart}-${String(count + 1).padStart(6, "0")}`
}

export async function verifyAndRecordDpoPayment(transactionToken: string) {
  const setting = await prisma.companySetting.findFirst()
  if (!setting || !setting.paymentSetupComplete || !setting.paymentEnabled) {
    throw new Error("Payment setup is not complete")
  }

  const { companyToken } = getDpoCredentials(setting)
  const result = await verifyDpoToken(companyToken, transactionToken)
  const successful = isDpoPaymentSuccessful(result)

  const payment = await prisma.payment.findUnique({
    where: { dpoTransactionToken: transactionToken },
    include: {
      quotation: true,
      customer: true,
    },
  })

  if (!payment) {
    throw new Error("DPO payment transaction was not found")
  }

  const amountFromDpo = Number(result.transactionAmount || payment.amount)
  const expectedAmount = Number(payment.quotation.total)
  const amountMatches = Math.abs(amountFromDpo - expectedAmount) < 0.01
  const currencyMatches = !result.transactionCurrency || result.transactionCurrency === payment.quotation.currency

  if (successful && (!amountMatches || !currencyMatches)) {
    console.error("DPO amount/currency mismatch", {
      transactionToken,
      expectedAmount,
      expectedCurrency: payment.quotation.currency,
      dpoAmount: result.transactionAmount,
      dpoCurrency: result.transactionCurrency,
    })
  }

  const paid = successful && amountMatches && currencyMatches
  const paymentMethod = toPaymentMethod(result.paymentMethod)
  const reference = result.paymentReference || result.transactionApproval || payment.reference || transactionToken

  const updated = await prisma.$transaction(async (tx) => {
    if (!paid) {
      const failedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: "FAILED",
          reference,
          notes: result.resultExplanation || "DPO payment verification failed",
        },
      })

      const failedQuotation = await tx.quotation.update({
        where: { id: payment.quotationId },
        data: {
          paymentStatus: "FAILED",
          paymentProvider: "DPO",
          paymentMethod,
          paymentReference: reference,
          settlementNote: DPO_SETTLEMENT_NOTE,
        },
      })

      return { payment: failedPayment, quotation: failedQuotation, receipt: null }
    }

    const existingReceipt = await tx.receipt.findFirst({
      where: {
        OR: [
          { paymentId: payment.id },
          { receiptNumber: payment.receiptNumber || undefined },
        ],
      },
    })

    const receiptNumber = existingReceipt?.receiptNumber || await generateReceiptNumber(tx)

    const paidPayment = await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: "COMPLETED",
        method: paymentMethod,
        reference,
        notes: result.resultExplanation || "DPO payment verified",
        receiptNumber,
        paymentDate: new Date(),
      },
    })

    const paidQuotation = await tx.quotation.update({
      where: { id: payment.quotationId },
      data: {
        status: "COMPLETED",
        paymentStatus: "COMPLETED",
        paymentProvider: "DPO",
        paymentMethod,
        paymentReference: reference,
        paidAt: new Date(),
        receiptNumber,
        settlementNote: DPO_SETTLEMENT_NOTE,
      },
    })

    const receipt = existingReceipt || await tx.receipt.create({
      data: {
        receiptNumber,
        quotationId: payment.quotationId,
        customerId: payment.customerId,
        generatedById: payment.recordedById,
        paymentId: payment.id,
        amount: payment.amount,
        currency: payment.currency,
        paymentMethod,
        reference,
        notes: "DPO payment verified and receipt generated",
        provider: "DPO",
      },
    })

    return { payment: paidPayment, quotation: paidQuotation, receipt }
  })

  return {
    paid,
    result,
    ...updated,
  }
}

export function getDpoFailureStatus(result: DpoVerifyResult) {
  const text = `${result.resultExplanation} ${result.result}`.toLowerCase()
  if (text.includes("cancel")) return "CANCELLED"
  return "FAILED"
}
