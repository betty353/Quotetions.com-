"use client"

import { useSession } from "next-auth/react"
import { UserRole } from "@prisma/client"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { isCompanyAdminRole } from "@/lib/tenant"

export function useAuth() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login")
    }
  }, [status, router])

  return {
    user: session?.user,
    isLoading: status === "loading",
    isAuthenticated: status === "authenticated",
  }
}

export function useRequireRole(...roles: UserRole[]) {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && user) {
      if (!roles.includes((user as any).role)) {
        router.push("/dashboard")
      }
    }
  }, [isLoading, user, router, roles])

  return { user, isLoading }
}

export function useAdmin() {
  return useRequireRole(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN, UserRole.ADMIN)
}

export function useEmployee() {
  return useRequireRole(UserRole.EMPLOYEE, UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN, UserRole.ADMIN)
}

export function useCustomer() {
  return useRequireRole(UserRole.CUSTOMER)
}

export function useCanEditQuotation(createdById: string, userId?: string) {
  const { user } = useAuth()
  const currentUserId = userId || (user as any)?.id

  return isCompanyAdminRole((user as any)?.role) || createdById === currentUserId
}
