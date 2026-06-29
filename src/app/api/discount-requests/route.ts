import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import requireRole from "@/lib/roles"
import { discountRequestDecisionSchema } from "@/lib/schemas"
import { generateQuotationNumber } from "@/lib/utils"
import { createActivityLog, createAuditLog } from "@/lib/finance"

export async function GET() {
  const session = await requireRole("ADMIN")
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const companyId = (session.user as any).companyId as string | null
  if (!companyId) return NextResponse.json({ error: "Company workspace is required" }, { status: 400 })

  const requests = await prisma.discountRequest.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    take: 100,
  })
  return NextResponse.json({ data: requests })
}

export async function PATCH(request: NextRequest) {
  const session = await requireRole("ADMIN")
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const companyId = (session.user as any).companyId as string | null
  if (!companyId) return NextResponse.json({ error: "Company workspace is required" }, { status: 400 })

  const id = request.nextUrl.searchParams.get("id") || ""
  const parsed = discountRequestDecisionSchema.safeParse(await request.json().catch(() => ({})))
  if (!id || !parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 })

  const discountRequest = await prisma.discountRequest.findFirst({ where: { id, companyId } })
  if (!discountRequest) return NextResponse.json({ error: "Discount request not found" }, { status: 404 })
  if (discountRequest.status !== "PENDING") return NextResponse.json({ error: "Discount request already handled" }, { status: 400 })

  if (parsed.data.action === "REJECT") {
    const rejected = await prisma.discountRequest.update({
      where: { id },
      data: {
        status: "REJECTED",
        rejectedById: session.user.id,
        rejectedAt: new Date(),
        rejectionReason: parsed.data.rejectionReason || null,
      },
    })
    await createAuditLog({ companyId, userId: session.user.id, action: "REJECT", entity: "DiscountRequest", entityId: id })
    await prisma.notification.create({
      data: {
        companyId,
        userId: discountRequest.requestedById,
        type: "SYSTEM_ALERT",
        title: "Discount request rejected",
        message: parsed.data.rejectionReason || "Your discount request was rejected.",
        relatedId: id,
        relatedModel: "DiscountRequest",
        customerId: discountRequest.customerId,
      },
    })
    return NextResponse.json({ data: rejected })
  }

  const setting = await prisma.companySetting.findUnique({ where: { companyId }, select: { quotationPrefix: true, defaultCurrency: true } })
  const count = await prisma.quotation.count({ where: { companyId } })
  const quotationNumber = generateQuotationNumber(setting?.quotationPrefix || "QT", count + 1)
  const items = Array.isArray(discountRequest.items) ? discountRequest.items as any[] : []

  const quotation = await prisma.$transaction(async (tx) => {
    const created = await tx.quotation.create({
      data: {
        companyId,
        quotationNumber,
        customerId: discountRequest.customerId,
        createdById: discountRequest.requestedById,
        status: "SENT",
        notes: discountRequest.notes,
        terms: discountRequest.terms,
        validUntil: discountRequest.validUntil,
        subtotal: discountRequest.subtotal,
        taxAmount: 0,
        discountAmount: discountRequest.discountAmount,
        total: discountRequest.total,
        currency: setting?.defaultCurrency || "USD",
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
            discount: Number(item.discount || 0),
            tax: Number(item.tax || 0),
            total: Number(item.total),
          })),
        },
      },
      include: { customer: { include: { user: true } } },
    })

    await tx.discountRequest.update({
      where: { id },
      data: {
        status: "APPROVED",
        approvedById: session.user.id,
        approvedAt: new Date(),
        quotationId: created.id,
      },
    })
    return created
  })

  await createActivityLog({
    companyId,
    customerId: quotation.customerId,
    userId: session.user.id,
    activityType: "DISCOUNT_APPROVED",
    description: `Discount approved and quotation ${quotation.quotationNumber} created`,
    quotationId: quotation.id,
  })
  await createAuditLog({
    companyId,
    userId: session.user.id,
    action: "APPROVE",
    entity: "DiscountRequest",
    entityId: id,
    changes: { quotationId: quotation.id, quotationNumber: quotation.quotationNumber },
  })
  await prisma.notification.createMany({
    data: [
      {
        companyId,
        userId: quotation.customer.userId,
        type: "QUOTATION_CREATED",
        title: "Quotation created",
        message: `Quotation ${quotation.quotationNumber} has been created with approved discount.`,
        relatedId: quotation.id,
        relatedModel: "Quotation",
        customerId: quotation.customerId,
        quotationId: quotation.id,
      },
      {
        companyId,
        userId: discountRequest.requestedById,
        type: "SYSTEM_ALERT",
        title: "Discount request approved",
        message: `Quotation ${quotation.quotationNumber} was created.`,
        relatedId: quotation.id,
        relatedModel: "Quotation",
        customerId: quotation.customerId,
        quotationId: quotation.id,
      },
    ],
  })

  return NextResponse.json({ data: quotation })
}
