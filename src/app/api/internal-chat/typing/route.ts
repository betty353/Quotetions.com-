import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import requireRole from "@/lib/roles"
import { isCompanyAdminRole } from "@/lib/tenant"

const typingSchema = z.object({
  recipientId: z.string().optional().nullable(),
})

function channelFor(recipientId?: string | null) {
  return recipientId ? `direct:${recipientId}` : "team"
}

export async function POST(request: NextRequest) {
  const session = await requireRole("ADMIN", "EMPLOYEE", "CUSTOMER")
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const role = (session.user as any).role as string
  if (role !== "EMPLOYEE" && role !== "CUSTOMER" && !isCompanyAdminRole(role)) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })

  const companyId = (session.user as any).companyId as string | null
  const userId = (session.user as any).id as string
  if (!companyId || !userId) return NextResponse.json({ error: "Company workspace is required" }, { status: 400 })

  const parsed = typingSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: "Validation failed" }, { status: 400 })

  const recipientId = parsed.data.recipientId || null
  if (role === "CUSTOMER" && !recipientId) {
    return NextResponse.json({ error: "Choose a staff member to message" }, { status: 400 })
  }

  const channel = recipientId ? channelFor(recipientId) : "team"
  const expiresAt = new Date(Date.now() + 6000)

  await prisma.internalChatTyping.upsert({
    where: { companyId_userId_channel: { companyId, userId, channel } },
    create: { companyId, userId, channel, recipientId, expiresAt },
    update: { recipientId, expiresAt },
  })

  return NextResponse.json({ success: true })
}
