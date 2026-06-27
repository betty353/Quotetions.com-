import { prisma } from "@/lib/prisma"

export function getPaymentState(total: number, paid: number) {
  const normalizedTotal = Math.max(0, total)
  const normalizedPaid = Math.max(0, paid)
  const outstanding = Math.max(0, normalizedTotal - normalizedPaid)

  if (normalizedPaid <= 0) {
    return { paid: normalizedPaid, outstanding, paymentStatus: "PENDING" as const, quotationStatus: null }
  }

  if (outstanding <= 0.005) {
    return {
      paid: normalizedPaid,
      outstanding: 0,
      paymentStatus: "COMPLETED" as const,
      quotationStatus: "COMPLETED" as const,
    }
  }

  return { paid: normalizedPaid, outstanding, paymentStatus: "PARTIAL" as const, quotationStatus: null }
}

export async function syncQuotationPaymentState(quotationId: string) {
  const quotation = await prisma.quotation.findUnique({
    where: { id: quotationId },
    include: {
      payments: {
        where: {
          status: { in: ["PARTIAL", "COMPLETED"] },
        },
      },
    },
  })

  if (!quotation) return null

  const paid = quotation.payments.reduce((sum, payment) => sum + Number(payment.amount), 0)
  const state = getPaymentState(Number(quotation.total), paid)

  const updated = await prisma.quotation.update({
    where: { id: quotation.id },
    data: {
      paymentStatus: state.paymentStatus,
      status: state.quotationStatus ?? quotation.status,
      paidAt: state.paymentStatus === "COMPLETED" ? quotation.paidAt ?? new Date() : null,
    },
  })

  return { quotation: updated, ...state }
}

export async function createActivityLog(input: {
  customerId: string
  userId?: string | null
  employeeId?: string | null
  activityType: string
  description: string
  details?: unknown
  quotationId?: string | null
  paymentId?: string | null
  receiptId?: string | null
  followUpId?: string | null
}) {
  return prisma.activityLog.create({
    data: {
      customerId: input.customerId,
      userId: input.userId ?? null,
      employeeId: input.employeeId ?? null,
      activityType: input.activityType,
      description: input.description,
      details: input.details ? JSON.stringify(input.details) : null,
      quotationId: input.quotationId ?? null,
      paymentId: input.paymentId ?? null,
      receiptId: input.receiptId ?? null,
      followUpId: input.followUpId ?? null,
    },
  })
}

export async function createAuditLog(input: {
  userId: string
  action: string
  entity: string
  entityId: string
  changes?: unknown
}) {
  return prisma.auditLog.create({
    data: {
      userId: input.userId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      changes: input.changes ? JSON.stringify(input.changes) : null,
    },
  })
}
