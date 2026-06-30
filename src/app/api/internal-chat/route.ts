import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import requireRole from "@/lib/roles"
import { isCompanyAdminRole } from "@/lib/tenant"

const sendMessageSchema = z.object({
  message: z.string().trim().max(2000, "Message is too long").optional().default(""),
  recipientId: z.string().optional().nullable(),
  roomId: z.string().optional().nullable(),
  replyToId: z.string().optional().nullable(),
  attachmentUrl: z.string().url().optional().nullable(),
  attachmentName: z.string().max(180).optional().nullable(),
  attachmentType: z.string().max(120).optional().nullable(),
  linkType: z.enum(["CUSTOMER", "QUOTATION", "PRODUCT", "INVOICE", "RECEIPT"]).optional().nullable(),
  linkId: z.string().optional().nullable(),
  linkLabel: z.string().max(180).optional().nullable(),
}).refine((value) => value.message || value.attachmentUrl || value.linkId, {
  message: "Message, attachment, or shared record is required",
})

const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("edit"), id: z.string(), message: z.string().trim().min(1).max(2000) }),
  z.object({ action: z.literal("delete"), id: z.string() }),
  z.object({ action: z.literal("pin"), id: z.string(), isPinned: z.boolean() }),
  z.object({ action: z.literal("profile"), profileImageUrl: z.string().url().nullable() }),
])

const createRoomSchema = z.object({
  name: z.string().trim().min(2, "Room name is required").max(80),
  description: z.string().trim().max(200).optional().nullable(),
  memberIds: z.array(z.string()).min(1, "Choose at least one member"),
})

function canUseInternalChat(role?: string | null) {
  return role === "EMPLOYEE" || role === "CUSTOMER" || isCompanyAdminRole(role)
}

function channelFor(recipientId?: string | null) {
  return recipientId ? `direct:${recipientId}` : "team"
}

function roomChannel(roomId?: string | null) {
  return roomId ? `room:${roomId}` : "team"
}

async function requireChatSession() {
  const session = await requireRole("ADMIN", "EMPLOYEE", "CUSTOMER")
  if (!session) return null
  const role = (session.user as any).role as string
  if (!canUseInternalChat(role)) return null
  const companyId = (session.user as any).companyId as string | null
  const userId = (session.user as any).id as string
  if (!companyId || !userId) return null
  return { session, role, companyId, userId }
}

async function getCompanyChatUsers(companyId: string, viewerId?: string, role?: string) {
  if (role === "CUSTOMER" && viewerId) {
    const customer = await prisma.customer.findUnique({ where: { userId: viewerId }, select: { id: true } })
    if (!customer) return []
    const quotations = await prisma.quotation.findMany({
      where: { customerId: customer.id, companyId },
      select: {
        createdById: true,
        assignedEmployee: { select: { userId: true } },
      },
      take: 50,
    })
    const staffIds = Array.from(new Set([
      ...quotations.map((quotation) => quotation.createdById),
      ...quotations.map((quotation) => quotation.assignedEmployee?.userId).filter(Boolean),
    ])) as string[]
    if (staffIds.length > 0) {
      const staff = await prisma.user.findMany({
        where: { id: { in: staffIds }, companyId, isActive: true, role: { in: ["SUPER_ADMIN", "COMPANY_ADMIN", "ADMIN", "EMPLOYEE"] } },
            select: { id: true, firstName: true, lastName: true, email: true, role: true, profileImageUrl: true },
        orderBy: [{ role: "asc" }, { firstName: "asc" }],
      })
      if (staff.length > 0) return staff
    }
    return prisma.user.findMany({
      where: { companyId, isActive: true, role: { in: ["SUPER_ADMIN", "COMPANY_ADMIN", "ADMIN"] } },
      select: { id: true, firstName: true, lastName: true, email: true, role: true, profileImageUrl: true },
      orderBy: [{ role: "asc" }, { firstName: "asc" }],
    })
  }

  return prisma.user.findMany({
    where: {
      companyId,
      isActive: true,
      role: { in: ["SUPER_ADMIN", "COMPANY_ADMIN", "ADMIN", "EMPLOYEE"] },
    },
    select: { id: true, firstName: true, lastName: true, email: true, role: true, profileImageUrl: true },
    orderBy: [{ role: "asc" }, { firstName: "asc" }],
  })
}

async function touchPresence(companyId: string, userId: string) {
  await prisma.internalChatPresence.upsert({
    where: { companyId_userId: { companyId, userId } },
    create: { companyId, userId, lastSeenAt: new Date() },
    update: { lastSeenAt: new Date() },
  })
}

async function getUnreadSummary(companyId: string, userId: string, role?: string | null) {
  const [team, directRows] = await Promise.all([
    role === "CUSTOMER"
      ? Promise.resolve(0)
      : prisma.internalChatMessage.count({
          where: { companyId, recipientId: null, senderId: { not: userId }, isRead: false, deletedAt: null },
        }),
    prisma.internalChatMessage.groupBy({
      by: ["senderId"],
      where: { companyId, recipientId: userId, isRead: false, deletedAt: null },
      _count: { _all: true },
    }),
  ])

  const directByUserId = directRows.reduce<Record<string, number>>((acc, row) => {
    acc[row.senderId] = row._count._all
    return acc
  }, {})

  return {
    total: team + directRows.reduce((sum, row) => sum + row._count._all, 0),
    team,
    directByUserId,
  }
}

async function getRooms(companyId: string, userId: string, role?: string | null) {
  if (role === "CUSTOMER") return []
  return prisma.internalChatRoom.findMany({
    where: {
      companyId,
      members: { some: { userId } },
    },
    orderBy: { updatedAt: "desc" },
    include: {
      members: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true, role: true, profileImageUrl: true } },
        },
      },
    },
  })
}

async function getReplyMap(messages: Array<{ replyToId: string | null }>) {
  const replyIds = Array.from(new Set(messages.map((message) => message.replyToId).filter(Boolean))) as string[]
  if (replyIds.length === 0) return {}

  const replies = await prisma.internalChatMessage.findMany({
    where: { id: { in: replyIds } },
    select: {
      id: true,
      message: true,
      attachmentName: true,
      linkLabel: true,
      deletedAt: true,
      sender: { select: { id: true, firstName: true, lastName: true, email: true, role: true, profileImageUrl: true } },
    },
  })

  return replies.reduce<Record<string, unknown>>((acc, reply) => {
    acc[reply.id] = reply
    return acc
  }, {})
}

async function getLinkables(companyId: string) {
  const [customers, quotations, products] = await Promise.all([
    prisma.customer.findMany({
      where: { companyId, status: "ACTIVE" },
      take: 30,
      orderBy: { updatedAt: "desc" },
      include: { user: true },
    }),
    prisma.quotation.findMany({
      where: { companyId },
      take: 30,
      orderBy: { updatedAt: "desc" },
      select: { id: true, quotationNumber: true, total: true, currency: true, status: true },
    }),
    prisma.product.findMany({
      where: { companyId, status: "ACTIVE" },
      take: 30,
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true, sku: true, unitPrice: true, currency: true },
    }),
  ])

  return [
    ...customers.map((customer) => ({
      type: "CUSTOMER",
      id: customer.id,
      label: customer.companyName || customer.contactPerson || `${customer.user.firstName} ${customer.user.lastName}`.trim() || customer.user.email,
      href: `/dashboard/customers/${customer.id}`,
    })),
    ...quotations.map((quotation) => ({
      type: "QUOTATION",
      id: quotation.id,
      label: `${quotation.quotationNumber} - ${quotation.status}`,
      href: `/dashboard/quotations/${quotation.id}`,
    })),
    ...products.map((product) => ({
      type: "PRODUCT",
      id: product.id,
      label: `${product.name}${product.sku ? ` (${product.sku})` : ""}`,
      href: `/dashboard/products/${product.id}`,
    })),
  ]
}

async function assertLinkedRecord(companyId: string, linkType?: string | null, linkId?: string | null) {
  if (!linkType || !linkId) return true
  if (linkType === "CUSTOMER") return Boolean(await prisma.customer.findFirst({ where: { id: linkId, companyId }, select: { id: true } }))
  if (linkType === "QUOTATION") return Boolean(await prisma.quotation.findFirst({ where: { id: linkId, companyId }, select: { id: true } }))
  if (linkType === "PRODUCT") return Boolean(await prisma.product.findFirst({ where: { id: linkId, companyId }, select: { id: true } }))
  return true
}

export async function GET(request: NextRequest) {
  const auth = await requireChatSession()
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { companyId, userId, role } = auth
  await touchPresence(companyId, userId)

  const recipientId = request.nextUrl.searchParams.get("recipientId") || null
  const roomId = request.nextUrl.searchParams.get("roomId") || null
  const search = request.nextUrl.searchParams.get("q")?.trim() || ""
  const [users, rooms] = await Promise.all([
    getCompanyChatUsers(companyId, userId, role),
    getRooms(companyId, userId, role),
  ])

  if (recipientId && !users.some((user) => user.id === recipientId)) {
    return NextResponse.json({ error: "Recipient not found" }, { status: 404 })
  }
  const activeRoom = roomId ? rooms.find((room) => room.id === roomId) : null
  if (roomId && !activeRoom) return NextResponse.json({ error: "Room not found" }, { status: 404 })

  if (role === "CUSTOMER" && !recipientId) {
    const unread = await getUnreadSummary(companyId, userId, role)
    const presences = await prisma.internalChatPresence.findMany({ where: { companyId }, select: { userId: true, lastSeenAt: true } })
    return NextResponse.json({
      users,
      rooms,
      messages: [],
      pinnedMessages: [],
      unread,
      presences,
      typingUserIds: [],
      linkables: [],
    })
  }

  const baseWhere = recipientId
    ? {
        companyId,
        roomId: null,
        OR: [
          { senderId: userId, recipientId },
          { senderId: recipientId, recipientId: userId },
        ],
      }
    : roomId
      ? { companyId, roomId, recipientId: null }
      : { companyId, roomId: null, recipientId: null }

  const where = search
    ? { ...baseWhere, deletedAt: null, message: { contains: search, mode: "insensitive" as const } }
    : baseWhere

  const messages = await prisma.internalChatMessage.findMany({
    where,
    orderBy: { createdAt: "asc" },
    take: 250,
    include: {
      sender: { select: { id: true, firstName: true, lastName: true, email: true, role: true, profileImageUrl: true } },
      recipient: { select: { id: true, firstName: true, lastName: true, email: true, role: true, profileImageUrl: true } },
    },
  })

  await prisma.internalChatMessage.updateMany({
    where: recipientId
      ? { companyId, senderId: recipientId, recipientId: userId, isRead: false, deletedAt: null }
      : { companyId, recipientId: null, senderId: { not: userId }, isRead: false, deletedAt: null },
    data: { isRead: true, readAt: new Date() },
  })

  const channel = recipientId ? channelFor(userId) : roomChannel(roomId)
  const now = new Date()
  await prisma.internalChatTyping.deleteMany({ where: { expiresAt: { lt: now } } })

  const [unread, replyMap, presences, typing, pinnedMessages, linkables] = await Promise.all([
    getUnreadSummary(companyId, userId, role),
    getReplyMap(messages),
    prisma.internalChatPresence.findMany({ where: { companyId }, select: { userId: true, lastSeenAt: true } }),
    prisma.internalChatTyping.findMany({
      where: { companyId, channel, userId: { not: userId }, expiresAt: { gt: now } },
      select: { userId: true },
    }),
    prisma.internalChatMessage.findMany({
      where: { ...baseWhere, isPinned: true, deletedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 8,
      include: {
        sender: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
      },
    }),
    role === "CUSTOMER" ? Promise.resolve([]) : getLinkables(companyId),
  ])

  return NextResponse.json({
    users,
    rooms,
    messages: messages.map((message) => ({ ...message, replyTo: message.replyToId ? replyMap[message.replyToId] || null : null })),
    pinnedMessages,
    unread,
    presences,
    typingUserIds: typing.map((item) => item.userId),
    linkables,
  })
}

export async function POST(request: NextRequest) {
  const auth = await requireChatSession()
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { companyId, userId: senderId, role } = auth
  await touchPresence(companyId, senderId)

  const body = await request.json().catch(() => ({}))
  const parsed = sendMessageSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", details: parsed.error.errors }, { status: 400 })

  const input = parsed.data
  const recipientId = input.recipientId || null
  const roomId = input.roomId || null
  if (role === "CUSTOMER" && !recipientId) {
    return NextResponse.json({ error: "Choose a staff member to message" }, { status: 400 })
  }
  if (recipientId && roomId) return NextResponse.json({ error: "Choose either a room or direct recipient" }, { status: 400 })

  const users = await getCompanyChatUsers(companyId, senderId, role)
  if (recipientId && !users.some((user) => user.id === recipientId && user.id !== senderId)) {
    return NextResponse.json({ error: "Recipient not found" }, { status: 404 })
  }
  const rooms = await getRooms(companyId, senderId, role)
  const activeRoom = roomId ? rooms.find((room) => room.id === roomId) : null
  if (roomId && !activeRoom) return NextResponse.json({ error: "Room not found" }, { status: 404 })

  if (input.replyToId) {
    const reply = await prisma.internalChatMessage.findFirst({ where: { id: input.replyToId, companyId }, select: { id: true } })
    if (!reply) return NextResponse.json({ error: "Reply message not found" }, { status: 404 })
  }

  if (role === "CUSTOMER" && input.linkId) {
    return NextResponse.json({ error: "Customers cannot share internal records" }, { status: 403 })
  }

  if (!(await assertLinkedRecord(companyId, input.linkType, input.linkId))) {
    return NextResponse.json({ error: "Shared record not found" }, { status: 404 })
  }

  const message = await prisma.internalChatMessage.create({
    data: {
      companyId,
      roomId,
      senderId,
      recipientId,
      message: input.message || "",
      replyToId: input.replyToId || null,
      attachmentUrl: input.attachmentUrl || null,
      attachmentName: input.attachmentName || null,
      attachmentType: input.attachmentType || null,
      linkType: input.linkType || null,
      linkId: input.linkId || null,
      linkLabel: input.linkLabel || null,
    },
    include: {
      sender: { select: { id: true, firstName: true, lastName: true, email: true, role: true, profileImageUrl: true } },
      recipient: { select: { id: true, firstName: true, lastName: true, email: true, role: true, profileImageUrl: true } },
    },
  })

  const senderName = `${message.sender.firstName} ${message.sender.lastName}`.trim() || message.sender.email
  const preview = input.message || input.attachmentName || input.linkLabel || "Sent an attachment"
  const notificationUsers = recipientId
    ? [recipientId]
    : activeRoom
      ? activeRoom.members.length > 0
        ? activeRoom.members.map((member) => member.userId).filter((id) => id !== senderId)
        : users.filter((user) => user.id !== senderId).map((user) => user.id)
      : users.filter((user) => user.id !== senderId).map((user) => user.id)

  if (notificationUsers.length > 0) {
    await prisma.notification.createMany({
      data: notificationUsers.map((notifyUserId) => ({
        companyId,
        userId: notifyUserId,
        type: "SYSTEM_ALERT",
        title: recipientId ? "New direct chat message" : activeRoom ? `New message in ${activeRoom.name}` : "New team chat message",
        message: `${senderName}: ${preview.slice(0, 140)}`,
        relatedId: roomId || message.id,
        relatedModel: roomId ? "InternalChatRoom" : "InternalChatMessage",
      })),
    })
  }

  return NextResponse.json({ data: message }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const auth = await requireChatSession()
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { companyId, userId, role } = auth
  const body = await request.json().catch(() => ({}))
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", details: parsed.error.errors }, { status: 400 })

  if (parsed.data.action === "profile") {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { profileImageUrl: parsed.data.profileImageUrl },
      select: { id: true, profileImageUrl: true },
    })
    return NextResponse.json({ data: updated })
  }

  const existing = await prisma.internalChatMessage.findFirst({ where: { id: parsed.data.id, companyId } })
  if (!existing) return NextResponse.json({ error: "Message not found" }, { status: 404 })

  if (parsed.data.action === "edit") {
    if (existing.senderId !== userId || existing.deletedAt) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    const updated = await prisma.internalChatMessage.update({
      where: { id: existing.id },
      data: { message: parsed.data.message, editedAt: new Date() },
    })
    return NextResponse.json({ data: updated })
  }

  if (parsed.data.action === "delete") {
    if (existing.senderId !== userId && !isCompanyAdminRole(role)) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    const updated = await prisma.internalChatMessage.update({
      where: { id: existing.id },
      data: { deletedAt: new Date(), deletedById: userId, isPinned: false },
    })
    return NextResponse.json({ data: updated })
  }

  if (existing.senderId !== userId && !isCompanyAdminRole(role)) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  const updated = await prisma.internalChatMessage.update({
    where: { id: existing.id },
    data: { isPinned: parsed.data.isPinned },
  })
  return NextResponse.json({ data: updated })
}

export async function PUT(request: NextRequest) {
  const auth = await requireChatSession()
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { companyId, userId, role } = auth
  if (!isCompanyAdminRole(role)) return NextResponse.json({ error: "Only admins can create rooms" }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const parsed = createRoomSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", details: parsed.error.errors }, { status: 400 })

  const memberIds = Array.from(new Set([userId, ...parsed.data.memberIds]))
  const validUsers = await prisma.user.findMany({
    where: { id: { in: memberIds }, companyId, isActive: true, role: { in: ["SUPER_ADMIN", "COMPANY_ADMIN", "ADMIN", "EMPLOYEE"] } },
    select: { id: true },
  })
  const validIds = validUsers.map((user) => user.id)
  if (validIds.length === 0) return NextResponse.json({ error: "No valid room members found" }, { status: 400 })

  const room = await prisma.internalChatRoom.create({
    data: {
      companyId,
      name: parsed.data.name,
      description: parsed.data.description || null,
      createdById: userId,
      members: {
        createMany: {
          data: validIds.map((memberId) => ({ companyId, userId: memberId, addedById: userId })),
          skipDuplicates: true,
        },
      },
    },
    include: {
      members: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true, role: true, profileImageUrl: true } },
        },
      },
    },
  })

  return NextResponse.json({ data: room }, { status: 201 })
}
