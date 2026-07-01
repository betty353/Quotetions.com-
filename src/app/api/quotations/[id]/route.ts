import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import requireRole from "@/lib/roles"
import { updateQuotationStatusSchema } from "@/lib/schemas"
import { ZodError } from "zod"
import { createActivityLog, createAuditLog } from "@/lib/finance"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await requireRole("ADMIN", "EMPLOYEE", "CUSTOMER")
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const quotation = await prisma.quotation.findUnique({
    where: { id },
    include: {
      company: { include: { settings: true } },
      customer: {
        include: {
          user: true,
          quotations: {
            orderBy: { createdAt: "desc" },
            take: 8,
            select: { quotationNumber: true, status: true, total: true, currency: true, createdAt: true },
          },
          payments: {
            orderBy: { paymentDate: "desc" },
            take: 8,
            select: { paymentNumber: true, status: true, amount: true, currency: true, paymentDate: true },
          },
          receipts: {
            orderBy: { createdAt: "desc" },
            take: 8,
            select: { receiptNumber: true, amount: true, currency: true, createdAt: true },
          },
        },
      },
      createdBy: true,
      assignedEmployee: true,
      items: { include: { product: true } },
      payments: true,
      receipts: true,
      followUps: true,
    },
  })

  if (!quotation) {
    return NextResponse.json({ error: "Quotation not found" }, { status: 404 })
  }

  const role = (session.user as any).role
  if (role === "CUSTOMER") {
    const customer = await prisma.customer.findUnique({ where: { userId: session.user.id } })
    if (!customer || customer.id !== quotation.customerId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }
  }

  return NextResponse.json({ data: quotation })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await requireRole("ADMIN", "EMPLOYEE", "CUSTOMER")
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await request.json()
    const validated = updateQuotationStatusSchema.parse(body)
    const updateData: any = {}
    const existing = await prisma.quotation.findUnique({
      where: { id },
      include: { customer: { include: { user: true } } },
    })

    if (!existing) {
      return NextResponse.json({ error: "Quotation not found" }, { status: 404 })
    }

    const role = (session.user as any).role
    if (role === "CUSTOMER") {
      const customer = await prisma.customer.findUnique({ where: { userId: session.user.id } })
      if (!customer || customer.id !== existing.customerId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
      }
      if (validated.status !== "APPROVED" && validated.status !== "REJECTED") {
        return NextResponse.json({ error: "Customers can only accept or reject quotations" }, { status: 403 })
      }
      if (existing.status === "COMPLETED" || existing.paymentStatus === "COMPLETED") {
        return NextResponse.json({ error: "Paid quotations cannot be changed" }, { status: 409 })
      }
      if (existing.status === "EXPIRED") {
        return NextResponse.json({ error: "Expired quotations cannot be changed" }, { status: 409 })
      }
      if (existing.validUntil && existing.validUntil < new Date()) {
        return NextResponse.json({ error: "This quotation has expired" }, { status: 409 })
      }
    } else {
      const companyId = (session.user as any).companyId as string | null
      if (companyId && existing.companyId !== companyId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
      }
    }

    if (validated.status) updateData.status = validated.status
    if (validated.rejectionReason) updateData.rejectionReason = validated.rejectionReason
    if (role !== "CUSTOMER") {
      if (validated.notes !== undefined) updateData.notes = validated.notes
      if (validated.terms !== undefined) updateData.terms = validated.terms
      if (validated.validUntil !== undefined) updateData.validUntil = validated.validUntil
    }
    if (validated.status === "VIEWED" && !existing.viewedAt) updateData.viewedAt = new Date()
    if (validated.status === "APPROVED" && !existing.approvedAt) updateData.approvedAt = new Date()
    if (validated.status === "REJECTED" && !existing.rejectedAt) updateData.rejectedAt = new Date()

    const updatedQuotation = await prisma.quotation.update({
      where: { id },
      data: updateData,
      include: {
        customer: true,
        items: { include: { product: true } },
        payments: true,
        receipts: true,
        followUps: true,
      },
    })

    await createActivityLog({
      companyId: existing.companyId,
      customerId: existing.customerId,
      userId: session.user.id,
      activityType: "QUOTATION_UPDATED",
      description: `Quotation ${existing.quotationNumber} changed from ${existing.status} to ${updatedQuotation.status}`,
      details: updateData,
      quotationId: existing.id,
    })
    await createAuditLog({
      companyId: existing.companyId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "Quotation",
      entityId: existing.id,
      changes: {
        fromStatus: existing.status,
        toStatus: updatedQuotation.status,
        ...updateData,
      },
    })

    if (["APPROVED", "PROCESSING", "READY", "COMPLETED", "REJECTED"].includes(updatedQuotation.status)) {
      if (role === "CUSTOMER") {
        const companyUsers = await prisma.user.findMany({
          where: {
            companyId: existing.companyId,
            role: { in: ["SUPER_ADMIN", "COMPANY_ADMIN", "ADMIN", "EMPLOYEE"] },
            isActive: true,
          },
          select: { id: true },
        })
        if (companyUsers.length > 0) {
          await prisma.notification.createMany({
            data: companyUsers.map((user) => ({
              companyId: existing.companyId,
              userId: user.id,
              type: updatedQuotation.status === "APPROVED" ? "QUOTATION_APPROVED" : "SYSTEM_ALERT",
              title: updatedQuotation.status === "APPROVED" ? "Customer accepted quotation" : "Customer rejected quotation",
              message: `${existing.customer.companyName || existing.customer.contactPerson || "Customer"} ${updatedQuotation.status === "APPROVED" ? "accepted" : "rejected"} ${existing.quotationNumber}.`,
              relatedId: existing.id,
              relatedModel: "Quotation",
              customerId: existing.customerId,
              quotationId: existing.id,
            })),
          })
        }
      } else {
        const customerTitle =
          updatedQuotation.status === "APPROVED" ? "Quotation approved" :
          updatedQuotation.status === "PROCESSING" ? "Order processing" :
          updatedQuotation.status === "READY" ? "Order ready" :
          updatedQuotation.status === "COMPLETED" ? "Order completed" :
          "Quotation rejected"

        await prisma.notification.create({
          data: {
            companyId: existing.companyId,
            userId: existing.customer.userId,
            type: updatedQuotation.status === "APPROVED" ? "QUOTATION_APPROVED" : "SYSTEM_ALERT",
            title: customerTitle,
            message: `${existing.quotationNumber} is now ${updatedQuotation.status}.`,
            relatedId: existing.id,
            relatedModel: "Quotation",
            customerId: existing.customerId,
            quotationId: existing.id,
          },
        })
      }
    }

    return NextResponse.json({ data: updatedQuotation })
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "Validation failed", details: err.errors }, { status: 400 })
    }

    console.error(err)
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to update quotation" }, { status: 500 })
  }
}
