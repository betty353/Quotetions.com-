import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { MessageCircle } from "lucide-react"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isCompanyAdminRole } from "@/lib/tenant"
import InternalChatPanel from "@/components/chat/InternalChatPanel"

export default async function InternalChatPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/dashboard")

  const role = (session.user as any).role as string
  if (!isCompanyAdminRole(role) && role !== "EMPLOYEE") redirect("/dashboard")

  const companyId = (session.user as any).companyId as string | null
  const userId = (session.user as any).id as string
  if (!companyId || !userId) redirect("/dashboard")

  const users = await prisma.user.findMany({
    where: {
      companyId,
      isActive: true,
      role: { in: ["SUPER_ADMIN", "COMPANY_ADMIN", "ADMIN", "EMPLOYEE"] },
    },
    select: { id: true, firstName: true, lastName: true, email: true, role: true },
    orderBy: [{ role: "asc" }, { firstName: "asc" }],
  })

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm font-semibold text-blue-700">
          <MessageCircle className="h-4 w-4" />
          Internal communication
        </div>
        <h1 className="mt-1 text-3xl font-bold">Team Chat</h1>
        <p className="mt-1 text-sm text-muted-foreground">Admins and workers can coordinate quotations, payments, customer follow-ups, and daily operations.</p>
      </div>

      <InternalChatPanel currentUserId={userId} initialUsers={users} />
    </div>
  )
}
