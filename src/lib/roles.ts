import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { isCompanyAdminRole, normalizeLegacyRole } from "@/lib/tenant"

function roleAllowed(userRole: string, allowedRoles: string[]) {
  const normalizedRole = normalizeLegacyRole(userRole)
  if (allowedRoles.includes(normalizedRole || userRole)) return true
  if (allowedRoles.includes("ADMIN") && isCompanyAdminRole(userRole)) return true
  if ((allowedRoles.includes("COMPANY_ADMIN") || allowedRoles.includes("SUPER_ADMIN")) && userRole === "ADMIN") return true
  return false
}

export async function requireRole(...allowedRoles: string[]) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null
  const role = (session.user as any).role as string
  return roleAllowed(role, allowedRoles) ? session : null
}

export function isRole(session: any, role: string) {
  if (!session?.user) return false
  return roleAllowed((session.user as any).role, [role])
}

export function isAdmin(session: any) {
  return isCompanyAdminRole((session?.user as any)?.role)
}

export default requireRole
