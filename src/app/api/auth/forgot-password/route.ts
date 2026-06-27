import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { prisma } from "@/lib/prisma"
import { forgotPasswordSchema } from "@/lib/schemas"
import { auditAuthEvent } from "@/lib/audit"
import { getClientIp, rateLimit } from "@/lib/rate-limit"
import { getAppBaseUrl, sendPasswordResetEmail } from "@/lib/email"

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

  const body = await request.json().catch(() => null)
  const parsed = forgotPasswordSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.errors }, { status: 400 })
  }

  const email = parsed.data.email
  const ip = getClientIp(request)
  const limit = rateLimit(`forgot:${ip}:${email}`, 5, 10 * 60_000)
  if (!limit.ok) {
    return NextResponse.json({ message: "If that email exists, a reset link will be sent." })
  }

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, companyId: true, email: true, firstName: true } })
  if (user) {
    const token = crypto.randomBytes(32).toString("base64url")
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 1000 * 60 * 30),
      },
    })
    await auditAuthEvent({ action: "PASSWORD_RESET_REQUEST", userId: user.id, companyId: user.companyId, email, request })

    const resetUrl = new URL("/auth/reset-password", getAppBaseUrl())
    resetUrl.searchParams.set("token", token)

    try {
      await sendPasswordResetEmail({ to: user.email, firstName: user.firstName, resetUrl: resetUrl.toString() })
    } catch (error) {
      console.error("Password reset email failed:", error instanceof Error ? error.message : "Unknown email error")
    }
  }

  return NextResponse.json({ message: "If that email exists, a reset link will be sent." })
}
