import { NextResponse, type NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

const adminPrefixes = [
  "/dashboard/products",
  "/dashboard/settings",
  "/dashboard/employees",
  "/dashboard/payment-setup",
  "/dashboard/reports",
  "/dashboard/company-profile",
  "/dashboard/users",
  "/dashboard/integrations",
  "/dashboard/activity-logs",
]

function isAdminRole(role?: unknown) {
  return role === "SUPER_ADMIN" || role === "COMPANY_ADMIN" || role === "ADMIN"
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })

  if (pathname.startsWith("/auth/login") || pathname.startsWith("/auth/register")) {
    if (token) return NextResponse.redirect(new URL("/dashboard", request.url))
    return NextResponse.next()
  }

  if (pathname.startsWith("/dashboard") || pathname.startsWith("/onboarding")) {
    if (!token) {
      const loginUrl = new URL("/auth/login", request.url)
      loginUrl.searchParams.set("callbackUrl", request.nextUrl.pathname + request.nextUrl.search)
      return NextResponse.redirect(loginUrl)
    }

    const needsAdmin = pathname.startsWith("/onboarding") || adminPrefixes.some((prefix) => pathname.startsWith(prefix))
    if (needsAdmin && !isAdminRole(token.role)) {
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/dashboard/:path*", "/onboarding/:path*", "/auth/login", "/auth/register"],
}
