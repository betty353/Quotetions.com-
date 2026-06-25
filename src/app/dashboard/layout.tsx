import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { DashboardLayout } from "@/components/layout/DashboardLayout"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/auth/login")
  }

  return <DashboardLayout>{children}</DashboardLayout>
}
