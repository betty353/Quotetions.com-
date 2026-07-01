import { prisma } from "@/lib/prisma"
import { generateUniqueReceiptNumberInTransaction } from "@/lib/receipts"
import type { PaymentMethod, PaymentProvider, Prisma } from "@prisma/client"

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
      quotationStatus: null,
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
  companyId?: string | null
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
      companyId: input.companyId ?? null,
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
  companyId?: string | null
  userId: string
  action: string
  entity: string
  entityId: string
  changes?: unknown
}) {
  return prisma.auditLog.create({
    data: {
      userId: input.userId,
      companyId: input.companyId ?? null,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      changes: input.changes ? JSON.stringify(input.changes) : null,
    },
  })
}

export async function ensureReceiptForPayment(input: {
  paymentId: string
  actorUserId?: string | null
  notes?: string | null
}) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { id: input.paymentId },
      include: {
        quotation: {
          include: {
            customer: { include: { user: true } },
          },
        },
      },
    })

    if (!payment) throw new Error("Payment not found")
    if (payment.status !== "PARTIAL" && payment.status !== "COMPLETED") return null

    const existingReceipt = await tx.receipt.findFirst({ where: { paymentId: payment.id } })
    if (existingReceipt) return existingReceipt

    const companyId = payment.companyId || payment.quotation.companyId
    if (!companyId) throw new Error("Payment company is missing")

    const setting = await tx.companySetting.findUnique({ where: { companyId } })
    const receiptNumber = await generateUniqueReceiptNumberInTransaction(tx, setting?.receiptPrefix || "RCT")
    const actorUserId = input.actorUserId || payment.recordedById

    const receipt = await tx.receipt.create({
      data: {
        companyId,
        receiptNumber,
        quotationId: payment.quotationId,
        customerId: payment.customerId,
        generatedById: actorUserId,
        paymentId: payment.id,
        amount: payment.amount,
        currency: payment.currency,
        paymentMethod: payment.method,
        reference: payment.reference,
        notes: input.notes || "Receipt generated automatically after confirmed payment",
        provider: payment.provider,
        signatureImageUrl: setting?.signatureImageUrl || null,
      },
    })

    await tx.payment.update({
      where: { id: payment.id },
      data: { receiptNumber },
    })

    await tx.quotation.update({
      where: { id: payment.quotationId },
      data: {
        receiptNumber,
        paymentProvider: payment.provider,
        paymentMethod: payment.method,
        paymentReference: payment.reference,
      },
    })

    await tx.activityLog.create({
      data: {
        companyId,
        customerId: payment.customerId,
        userId: actorUserId,
        activityType: "RECEIPT_GENERATED",
        description: `Receipt ${receipt.receiptNumber} generated for ${payment.quotation.quotationNumber}`,
        details: JSON.stringify({
          amount: Number(receipt.amount),
          paymentMethod: receipt.paymentMethod,
          provider: receipt.provider,
          automatic: true,
        }),
        quotationId: payment.quotationId,
        paymentId: payment.id,
        receiptId: receipt.id,
      },
    })

    await tx.auditLog.create({
      data: {
        companyId,
        userId: actorUserId,
        action: "CREATE",
        entity: "Receipt",
        entityId: receipt.id,
        changes: JSON.stringify({
          receiptNumber: receipt.receiptNumber,
          quotationId: payment.quotationId,
          paymentId: payment.id,
          amount: Number(receipt.amount),
          automatic: true,
        }),
      },
    })

    await tx.notification.create({
      data: {
        companyId,
        userId: payment.quotation.customer.userId,
        type: "RECEIPT_GENERATED",
        title: "Receipt ready",
        message: `Receipt ${receipt.receiptNumber} is ready for ${payment.quotation.quotationNumber}.`,
        relatedId: receipt.id,
        relatedModel: "Receipt",
        customerId: payment.customerId,
        quotationId: payment.quotationId,
        paymentId: payment.id,
        receiptId: receipt.id,
      },
    })

    return receipt
  })
}

export async function syncCompletedQuotationStock(input: {
  quotationId: string
  actorUserId?: string | null
}) {
  return prisma.$transaction(async (tx) => {
    const quotation = await tx.quotation.findUnique({
      where: { id: input.quotationId },
      include: {
        items: { include: { product: true } },
        payments: {
          where: { status: { in: ["PARTIAL", "COMPLETED"] } },
        },
      },
    })

    if (!quotation) throw new Error("Quotation not found")

    const paid = quotation.payments.reduce((sum, payment) => sum + Number(payment.amount), 0)
    const fullyPaid = paid >= Number(quotation.total) - 0.005
    if (!fullyPaid) return []

    const companyId = quotation.companyId
    if (!companyId) throw new Error("Quotation company is missing")

    const reference = `SALE:${quotation.id}`
    const existingMovements = await tx.productStockMovement.findMany({
      where: { companyId, reference },
      select: { productId: true },
    })
    const alreadySynced = new Set(existingMovements.map((movement) => movement.productId))

    const quantities = new Map<string, { quantity: number; product: typeof quotation.items[number]["product"] }>()
    for (const item of quotation.items) {
      const current = quantities.get(item.productId)
      quantities.set(item.productId, {
        product: item.product,
        quantity: (current?.quantity || 0) + item.quantity,
      })
    }

    const movements = []
    for (const [productId, item] of quantities) {
      if (alreadySynced.has(productId)) continue

      const product = await tx.product.findUnique({ where: { id: productId } })
      if (!product) continue

      const previousStock = product.stock
      const newStock = previousStock - item.quantity

      await tx.product.update({
        where: { id: product.id },
        data: { stock: newStock },
      })

      const movement = await tx.productStockMovement.create({
        data: {
          companyId,
          productId: product.id,
          userId: input.actorUserId || quotation.createdById,
          type: "STOCK_OUT",
          quantity: item.quantity,
          previousStock,
          newStock,
          unitCost: product.unitPrice,
          reason: `Sold through quotation ${quotation.quotationNumber}`,
          reference,
        },
      })
      movements.push(movement)

      if (newStock < 0 || (product.reorderLevel !== null && product.reorderLevel !== undefined && newStock <= product.reorderLevel)) {
        const admins = await tx.user.findMany({
          where: { companyId, role: { in: ["SUPER_ADMIN", "COMPANY_ADMIN", "ADMIN"] }, isActive: true },
          select: { id: true },
        })

        if (admins.length > 0) {
          await tx.notification.createMany({
            data: admins.map((admin) => ({
              companyId,
              userId: admin.id,
              type: "SYSTEM_ALERT",
              title: newStock < 0 ? "Stock oversold" : "Low stock alert",
              message: `${product.name} stock is now ${newStock} after ${quotation.quotationNumber}.`,
              relatedId: product.id,
              relatedModel: "Product",
              quotationId: quotation.id,
            })),
          })
        }
      }
    }

    if (movements.length > 0) {
      await tx.auditLog.create({
        data: {
          companyId,
          userId: input.actorUserId || quotation.createdById,
          action: "CREATE",
          entity: "ProductStockMovement",
          entityId: quotation.id,
          changes: JSON.stringify({
            quotationNumber: quotation.quotationNumber,
            reference,
            movementCount: movements.length,
            automatic: true,
          }),
        },
      })
    }

    await tx.quotation.update({
      where: { id: quotation.id },
      data: {
        paymentStatus: "COMPLETED",
        paidAt: quotation.paidAt || new Date(),
      },
    })

    return movements
  })
}

export async function finalizeConfirmedPayment(input: {
  paymentId: string
  quotationId: string
  actorUserId?: string | null
  receiptNotes?: string | null
  paymentMethod?: PaymentMethod
  paymentProvider?: PaymentProvider
}) {
  const state = await syncQuotationPaymentState(input.quotationId)
  const receipt = await ensureReceiptForPayment({
    paymentId: input.paymentId,
    actorUserId: input.actorUserId,
    notes: input.receiptNotes,
  })
  const movements = state?.paymentStatus === "COMPLETED"
    ? await syncCompletedQuotationStock({
      quotationId: input.quotationId,
      actorUserId: input.actorUserId,
    })
    : []

  return { state, receipt, movements }
}
