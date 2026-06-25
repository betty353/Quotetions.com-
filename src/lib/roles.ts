import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function requireRole(...allowedRoles: string[]) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null
  const role = (session.user as any).role as string
  return allowedRoles.includes(role) ? session : null
}

export function isRole(session: any, role: string) {
  if (!session?.user) return false
  return (session.user as any).role === role
}

export function isAdmin(session: any) {
  return isRole(session, "ADMIN")
}

export default requireRole
