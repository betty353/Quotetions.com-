import { prisma } from "@/lib/prisma"

export async function auditAuthEvent(input: {
  action: "REGISTER" | "LOGIN" | "LOGIN_FAILED" | "LOGOUT" | "PASSWORD_RESET_REQUEST" | "PASSWORD_RESET"
  userId?: string | null
  companyId?: string | null
  email?: string | null
  request?: Request
  metadata?: Record<string, unknown>
}) {
  const ipAddress = input.request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || input.request?.headers.get("x-real-ip")
    || null
  const userAgent = input.request?.headers.get("user-agent") || null

  return prisma.auditLog.create({
    data: {
      userId: input.userId ?? null,
      companyId: input.companyId ?? null,
      action: input.action,
      entity: "Auth",
      entityId: input.userId ?? input.email ?? "anonymous",
      ipAddress,
      userAgent,
      changes: JSON.stringify({
        email: input.email ?? undefined,
        ...input.metadata,
      }),
    },
  })
}
