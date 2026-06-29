import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import requireRole from "@/lib/roles"
import { isCompanyAdminRole } from "@/lib/tenant"

const chatMessageSchema = z.object({
  message: z.string().trim().min(1, "Message is required").max(2000, "Message is too long"),
  recipientId: z.string().optional().nullable(),
})

function canUseInternalChat(role?: string | null) {
  return role === "EMPLOYEE" || isCompanyAdminRole(role)
}

async function getCompanyChatUsers(companyId: string) {
  return prisma.user.findMany({
    where: {
      companyId,
      isActive: true,
      role: { in: ["SUPER_ADMIN", "COMPANY_ADMIN", "ADMIN", "EMPLOYEE"] },
    },
    select: { id: true, firstName: true, lastName: true, email: true, role: true },
    orderBy: [{ role: "asc" }, { firstName: "asc" }],
  })
}

export async function GET(request: NextRequest) {
  const session = await requireRole("ADMIN", "EMPLOYEE")
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const role = (session.user as any).role as string
  if (!canUseInternalChat(role)) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })

  const companyId = (session.user as any).companyId as string | null
  const userId = (session.user as any).id as string
  if (!companyId || !userId) return NextResponse.json({ error: "Company workspace is required" }, { status: 400 })

  const recipientId = request.nextUrl.searchParams.get("recipientId") || null
  const users = await getCompanyChatUsers(companyId)

  if (recipientId && !users.some((user) => user.id === recipientId)) {
    return NextResponse.json({ error: "Recipient not found" }, { status: 404 })
  }

  const where = recipientId
    ? {
        companyId,
        OR: [
          { senderId: userId, recipientId },
          { senderId: recipientId, recipientId: userId },
        ],
      }
    : { companyId, recipientId: null }

  const messages = await prisma.internalChatMessage.findMany({
    where,
    orderBy: { createdAt: "asc" },
    take: 200,
    include: {
      sender: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
      recipient: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
    },
  })

  await prisma.internalChatMessage.updateMany({
    where: recipientId
      ? { companyId, senderId: recipientId, recipientId: userId, isRead: false }
      : { companyId, recipientId: null, senderId: { not: userId }, isRead: false },
    data: { isRead: true, readAt: new Date() },
  })

  return NextResponse.json({
    users,
    messages,
  })
}

export async function POST(request: NextRequest) {
  const session = await requireRole("ADMIN", "EMPLOYEE")
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const role = (session.user as any).role as string
  if (!canUseInternalChat(role)) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })

  const companyId = (session.user as any).companyId as string | null
  const senderId = (session.user as any).id as string
  if (!companyId || !senderId) return NextResponse.json({ error: "Company workspace is required" }, { status: 400 })

  const body = await request.json().catch(() => ({}))
  const parsed = chatMessageSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", details: parsed.error.errors }, { status: 400 })

  const recipientId = parsed.data.recipientId || null
  const users = await getCompanyChatUsers(companyId)
  if (recipientId && !users.some((user) => user.id === recipientId && user.id !== senderId)) {
    return NextResponse.json({ error: "Recipient not found" }, { status: 404 })
  }

  const message = await prisma.internalChatMessage.create({
    data: {
      companyId,
      senderId,
      recipientId,
      message: parsed.data.message,
    },
    include: {
      sender: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
      recipient: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
    },
  })

  const senderName = `${message.sender.firstName} ${message.sender.lastName}`.trim() || message.sender.email
  const notificationUsers = recipientId ? [recipientId] : users.filter((user) => user.id !== senderId).map((user) => user.id)

  if (notificationUsers.length > 0) {
    await prisma.notification.createMany({
      data: notificationUsers.map((userId) => ({
        companyId,
        userId,
        type: "SYSTEM_ALERT",
        title: recipientId ? "New direct chat message" : "New team chat message",
        message: `${senderName}: ${parsed.data.message.slice(0, 140)}`,
        relatedId: message.id,
        relatedModel: "InternalChatMessage",
      })),
    })
  }

  return NextResponse.json({ data: message }, { status: 201 })
}
