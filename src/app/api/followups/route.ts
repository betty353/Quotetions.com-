import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createFollowUpSchema } from "@/lib/schemas"
import requireRole from "@/lib/roles"
import { ZodError } from "zod"
import { createActivityLog, createAuditLog } from "@/lib/finance"
import { isCompanyAdminRole } from "@/lib/tenant"

export async function GET(request: NextRequest) {
  const session = await requireRole("ADMIN", "EMPLOYEE", "CUSTOMER")
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const role = (session.user as any).role
  const companyId = (session.user as any).companyId as string | null
  const where: any = {}

  if (isCompanyAdminRole(role)) {
    if (companyId) where.companyId = companyId
  } else if (role === "EMPLOYEE") {
    const employee = await prisma.employee.findUnique({ where: { userId: session.user.id } })
    if (!employee) return NextResponse.json({ error: "Employee profile not found" }, { status: 404 })
    where.employeeId = employee.id
  }

  if (role === "CUSTOMER") {
    const customer = await prisma.customer.findUnique({ where: { userId: session.user.id } })
    if (!customer) return NextResponse.json({ error: "Customer profile not found" }, { status: 404 })
    where.customerId = customer.id
  }

  const followUps = await prisma.followUp.findMany({
    where,
    orderBy: { reminderDate: "asc" },
    include: {
      quotation: true,
      customer: true,
      employee: true,
      createdBy: true,
    },
  })

  return NextResponse.json({ data: followUps })
}

export async function POST(request: NextRequest) {
  const session = await requireRole("ADMIN", "EMPLOYEE")
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await request.json()
    const validated = createFollowUpSchema.parse(body)

    const quotation = await prisma.quotation.findUnique({ where: { id: validated.quotationId } })
    if (!quotation) return NextResponse.json({ error: "Quotation not found" }, { status: 404 })

    const customer = await prisma.customer.findUnique({ where: { id: validated.customerId } })
    if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 })
    if (quotation.customerId !== customer.id) return NextResponse.json({ error: "Customer does not match quotation" }, { status: 400 })

    const companyId = quotation.companyId || customer.companyId
    const sessionCompanyId = (session.user as any).companyId as string | null
    const role = (session.user as any).role
    if (isCompanyAdminRole(role) && sessionCompanyId && companyId !== sessionCompanyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    let employeeId = validated.employeeId
    if (!employeeId) {
      const employee = await prisma.employee.findUnique({ where: { userId: session.user.id } })
      employeeId = employee?.id
    }

    if (!employeeId) {
      return NextResponse.json({ error: "Employee is required for follow-up" }, { status: 400 })
    }

    const employee = await prisma.employee.findUnique({ where: { id: employeeId }, include: { user: true } })
    if (!employee || (companyId && employee.companyId !== companyId)) {
      return NextResponse.json({ error: "Employee does not belong to this company" }, { status: 403 })
    }

    const followUp = await prisma.followUp.create({
      data: {
        companyId,
        quotationId: validated.quotationId,
        customerId: validated.customerId,
        employeeId,
        createdById: session.user.id,
        status: "PENDING",
        type: validated.type,
        callNotes: validated.callNotes || null,
        meetingNotes: validated.meetingNotes || null,
        feedback: validated.feedback || null,
        nextFollowUpDate: validated.nextFollowUpDate || null,
        reminderDate: validated.reminderDate || null,
      },
      include: {
        quotation: true,
        customer: { include: { user: true } },
        employee: { include: { user: true } },
        createdBy: true,
      },
    })

    await createActivityLog({
      companyId,
      customerId: followUp.customerId,
      userId: session.user.id,
      employeeId,
      activityType: "FOLLOWUP_SCHEDULED",
      description: `${followUp.type} follow-up scheduled for ${followUp.customer?.companyName || followUp.customer?.contactPerson || "Customer"}`,
      details: {
        nextFollowUpDate: followUp.nextFollowUpDate,
        reminderDate: followUp.reminderDate,
        assignedTo: followUp.employee?.user?.email,
      },
      quotationId: followUp.quotationId,
      followUpId: followUp.id,
    })

    await createAuditLog({
      companyId,
      userId: session.user.id,
      action: "CREATE",
      entity: "FollowUp",
      entityId: followUp.id,
      changes: {
        type: followUp.type,
        status: followUp.status,
        employeeId,
        reminderDate: followUp.reminderDate,
      },
    })

    await prisma.notification.create({
      data: {
        companyId,
        userId: followUp.employee.userId,
        type: "FOLLOWUP_REMINDER",
        title: "Follow-up assigned",
        message: `${followUp.type} follow-up assigned for ${followUp.customer?.companyName || followUp.customer?.contactPerson || "Customer"}.`,
        relatedId: followUp.id,
        relatedModel: "FollowUp",
        customerId: followUp.customerId,
        quotationId: followUp.quotationId,
        followUpId: followUp.id,
      },
    })

    return NextResponse.json({ data: followUp }, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "Validation failed", details: err.errors }, { status: 400 })
    }

    console.error(err)
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to create follow-up" }, { status: 500 })
  }
}
