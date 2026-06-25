import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createFollowUpSchema } from "@/lib/schemas"
import requireRole from "@/lib/roles"
import { ZodError } from "zod"

export async function GET(request: NextRequest) {
  const session = await requireRole("ADMIN", "EMPLOYEE", "CUSTOMER")
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const role = (session.user as any).role
  const where: any = {}

  if (role === "EMPLOYEE") {
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

    let employeeId = validated.employeeId
    if (!employeeId) {
      const employee = await prisma.employee.findUnique({ where: { userId: session.user.id } })
      employeeId = employee?.id
    }

    if (!employeeId) {
      return NextResponse.json({ error: "Employee is required for follow-up" }, { status: 400 })
    }

    const followUp = await prisma.followUp.create({
      data: {
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
        customer: true,
        employee: true,
        createdBy: true,
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
