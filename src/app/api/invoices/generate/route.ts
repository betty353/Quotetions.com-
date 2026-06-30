import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import requireRole from "@/lib/roles"
import { createActivityLog, createAuditLog } from "@/lib/finance"
import { isCompanyAdminRole } from "@/lib/tenant"

const generateInvoiceSchema = z.object({
  quotationId: z.string().min(1, "Quotation is required"),
})

export async function POST(request: NextRequest) {
  const session = await requireRole("ADMIN")
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const role = (session.user as any).role as string
  if (!isCompanyAdminRole(role)) return NextResponse.json({ error: "Only admins can generate invoices" }, { status: 403 })

  try {
    const { quotationId } = generateInvoiceSchema.parse(await request.json())
    const companyId = (session.user as any).companyId as string | null
    if (!companyId) return NextResponse.json({ error: "Company workspace is required" }, { status: 400 })

    const quotation = await prisma.quotation.findFirst({
      where: { id: quotationId, companyId },
      include: { customer: { include: { user: true } } },
    })

    if (!quotation) return NextResponse.json({ error: "Quotation not found" }, { status: 404 })
    if (quotation.status === "REJECTED" || quotation.status === "EXPIRED") {
      return NextResponse.json({ error: "Rejected or expired quotations cannot be invoiced" }, { status: 400 })
    }

    const updated = await prisma.quotation.update({
      where: { id: quotation.id },
      data: {
        status: quotation.status === "COMPLETED" ? quotation.status : "APPROVED",
        approvedAt: quotation.approvedAt || new Date(),
      },
    })

    await createActivityLog({
      customerId: quotation.customerId,
      userId: session.user.id,
      activityType: "INVOICE_GENERATED",
      description: `Invoice generated from quotation ${quotation.quotationNumber}`,
      details: { quotationNumber: quotation.quotationNumber },
      quotationId: quotation.id,
    })

    await createAuditLog({
      companyId,
      userId: session.user.id,
      action: "GENERATE",
      entity: "Invoice",
      entityId: quotation.id,
      changes: { quotationNumber: quotation.quotationNumber, status: updated.status },
    })

    await prisma.notification.create({
      data: {
        companyId,
        userId: quotation.customer.userId,
        type: "QUOTATION_APPROVED",
        title: "Invoice generated",
        message: `Invoice ${quotation.quotationNumber} is ready for payment.`,
        relatedId: quotation.id,
        relatedModel: "Quotation",
        customerId: quotation.customerId,
        quotationId: quotation.id,
      },
    })

    return NextResponse.json({ data: updated, message: "Invoice generated" })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 })
    }
    console.error(error)
    return NextResponse.json({ error: "Failed to generate invoice" }, { status: 500 })
  }
}
