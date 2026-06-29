import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import requireRole from "@/lib/roles"
import { isCompanyAdminRole } from "@/lib/tenant"

function canUseInternalChat(role?: string | null) {
  return role === "EMPLOYEE" || role === "CUSTOMER" || isCompanyAdminRole(role)
}

export async function GET() {
  const session = await requireRole("ADMIN", "EMPLOYEE", "CUSTOMER")
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const role = (session.user as any).role as string
  if (!canUseInternalChat(role)) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })

  const companyId = (session.user as any).companyId as string | null
  const userId = (session.user as any).id as string
  if (!companyId || !userId) return NextResponse.json({ total: 0, team: 0, directByUserId: {} })

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

  return NextResponse.json({
    total: team + directRows.reduce((sum, row) => sum + row._count._all, 0),
    team,
    directByUserId,
  })
}
