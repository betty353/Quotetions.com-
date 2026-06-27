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
      customer: true,
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
  const session = await requireRole("ADMIN", "EMPLOYEE")
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

    if (validated.status) updateData.status = validated.status
    if (validated.rejectionReason) updateData.rejectionReason = validated.rejectionReason
    if (validated.notes !== undefined) updateData.notes = validated.notes
    if (validated.terms !== undefined) updateData.terms = validated.terms
    if (validated.validUntil !== undefined) updateData.validUntil = validated.validUntil
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
      customerId: existing.customerId,
      userId: session.user.id,
      activityType: "QUOTATION_UPDATED",
      description: `Quotation ${existing.quotationNumber} changed from ${existing.status} to ${updatedQuotation.status}`,
      details: updateData,
      quotationId: existing.id,
    })
    await createAuditLog({
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

    if (updatedQuotation.status === "APPROVED" || updatedQuotation.status === "REJECTED") {
      await prisma.notification.create({
        data: {
          userId: existing.customer.userId,
          type: updatedQuotation.status === "APPROVED" ? "QUOTATION_APPROVED" : "SYSTEM_ALERT",
          title: updatedQuotation.status === "APPROVED" ? "Quotation approved" : "Quotation rejected",
          message: `Quotation ${existing.quotationNumber} is now ${updatedQuotation.status}.`,
          relatedId: existing.id,
          relatedModel: "Quotation",
          customerId: existing.customerId,
          quotationId: existing.id,
        },
      })
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
