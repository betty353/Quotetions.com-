import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import requireRole from "@/lib/roles"
import { createActivityLog, createAuditLog } from "@/lib/finance"
import { isCompanyAdminRole } from "@/lib/tenant"

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await requireRole("ADMIN", "EMPLOYEE")
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await request.json()
    const updateData: any = {}
    if (body.status) updateData.status = body.status
    if (body.feedback !== undefined) updateData.feedback = body.feedback

    const existing = await prisma.followUp.findUnique({
      where: { id },
      include: {
        customer: { include: { user: true } },
        employee: true,
        quotation: true,
      },
    })
    if (!existing) return NextResponse.json({ error: "Follow-up not found" }, { status: 404 })

    const role = (session.user as any).role
    const sessionCompanyId = (session.user as any).companyId as string | null
    if (isCompanyAdminRole(role)) {
      if (sessionCompanyId && existing.companyId !== sessionCompanyId) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    } else {
      const employee = await prisma.employee.findUnique({ where: { userId: session.user.id } })
      if (!employee || employee.id !== existing.employeeId) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const updated = await prisma.followUp.update({ where: { id }, data: updateData, include: { customer: { include: { user: true } } } })

    await createActivityLog({
      companyId: existing.companyId,
      customerId: existing.customerId,
      userId: session.user.id,
      employeeId: existing.employeeId,
      activityType: "FOLLOWUP_UPDATED",
      description: `Follow-up changed from ${existing.status} to ${updated.status}`,
      details: updateData,
      quotationId: existing.quotationId,
      followUpId: existing.id,
    })

    await createAuditLog({
      companyId: existing.companyId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "FollowUp",
      entityId: existing.id,
      changes: { fromStatus: existing.status, toStatus: updated.status, ...updateData },
    })

    if (updated.status === "COMPLETED") {
      await prisma.notification.create({
        data: {
          companyId: existing.companyId,
          userId: existing.customer.userId,
          type: "SYSTEM_ALERT",
          title: "Follow-up completed",
          message: `A ${existing.type} follow-up for ${existing.quotation?.quotationNumber || "your quotation"} was completed.`,
          relatedId: existing.id,
          relatedModel: "FollowUp",
          customerId: existing.customerId,
          quotationId: existing.quotationId,
          followUpId: existing.id,
        },
      })
    }

    return NextResponse.json({ data: updated })
  } catch (err: unknown) {
    console.error(err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to update follow-up' }, { status: 500 })
  }
}
