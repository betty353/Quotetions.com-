import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import requireRole from "@/lib/roles"
import { isCompanyAdminRole } from "@/lib/tenant"
import { createDueFollowUpReminders } from "@/lib/followup-reminders"

export async function GET(request: NextRequest) {
  const session = await requireRole("ADMIN", "EMPLOYEE", "CUSTOMER")
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const role = (session.user as any).role
  const userId = (session.user as any).id
  const companyId = (session.user as any).companyId as string | null
  if (isCompanyAdminRole(role) && companyId) {
    await createDueFollowUpReminders({ companyId })
  } else if (role === "EMPLOYEE") {
    const employee = await prisma.employee.findUnique({ where: { userId } })
    if (employee) await createDueFollowUpReminders({ employeeId: employee.id })
  } else if (role === "CUSTOMER") {
    const customer = await prisma.customer.findUnique({ where: { userId } })
    if (customer) await createDueFollowUpReminders({ customerId: customer.id })
  }
  const unreadOnly = request.nextUrl.searchParams.get("unread") === "true"
  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") || "20"), 100)

  const where: any = unreadOnly ? { isRead: false } : {}
  if (isCompanyAdminRole(role)) {
    if (companyId) where.companyId = companyId
  } else {
    where.userId = userId
  }

  const notifications = await prisma.notification.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      customer: true,
      quotation: true,
      payment: true,
      receipt: true,
      followUp: true,
    },
  })

  const unread = await prisma.notification.count({
    where: { ...where, isRead: false },
  })

  return NextResponse.json({ data: notifications, unread })
}

export async function PATCH(request: NextRequest) {
  const session = await requireRole("ADMIN", "EMPLOYEE", "CUSTOMER")
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const id = String(body.id || "")
  if (!id) return NextResponse.json({ error: "Notification id is required" }, { status: 400 })

  const role = (session.user as any).role
  const userId = (session.user as any).id
  const companyId = (session.user as any).companyId as string | null
  const notification = await prisma.notification.findUnique({ where: { id } })
  if (!notification) return NextResponse.json({ error: "Notification not found" }, { status: 404 })

  const allowed = isCompanyAdminRole(role)
    ? !companyId || notification.companyId === companyId
    : notification.userId === userId

  if (!allowed) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })

  await prisma.notification.update({
    where: { id },
    data: { isRead: true, readAt: new Date() },
  })

  return NextResponse.json({ success: true })
}
