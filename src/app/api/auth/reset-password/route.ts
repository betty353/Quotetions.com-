import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { resetPasswordSchema } from "@/lib/schemas"
import { auditAuthEvent } from "@/lib/audit"
import { rateLimit, getClientIp } from "@/lib/rate-limit"

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex")
}

function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin")
  if (!origin) return true
  const host = request.headers.get("host")
  return host ? new URL(origin).host === host : false
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 })
  }

  const ip = getClientIp(request)
  const limit = rateLimit(`reset:${ip}`, 10, 10 * 60_000)
  if (!limit.ok) {
    return NextResponse.json({ error: "Too many reset attempts. Please try again later." }, { status: 429 })
  }

  const body = await request.json().catch(() => null)
  const parsed = resetPasswordSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.errors }, { status: 400 })
  }

  const tokenHash = hashToken(parsed.data.token)
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  })

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
    return NextResponse.json({ error: "Invalid or expired reset token" }, { status: 400 })
  }

  const password = await bcrypt.hash(parsed.data.password, 12)
  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.userId },
      data: { password },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    }),
  ])

  await auditAuthEvent({
    action: "PASSWORD_RESET",
    userId: resetToken.userId,
    companyId: resetToken.user.companyId,
    email: resetToken.user.email,
    request,
  })

  return NextResponse.json({ message: "Password reset successfully" })
}
