import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { MessageCircle } from "lucide-react"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isCompanyAdminRole } from "@/lib/tenant"
import InternalChatPanel from "@/components/chat/InternalChatPanel"

interface InternalChatPageProps {
  searchParams?: Promise<{ recipientId?: string; roomId?: string }>
}

async function getCustomerChatUsers(companyId: string, userId: string) {
  const customer = await prisma.customer.findUnique({ where: { userId }, select: { id: true } })
  if (!customer) return []

  const quotations = await prisma.quotation.findMany({
    where: { companyId, customerId: customer.id },
    select: {
      createdById: true,
      assignedEmployee: { select: { userId: true } },
    },
    take: 50,
  })
  const staffIds = Array.from(new Set([
    ...quotations.map((quotation) => quotation.createdById),
    ...quotations.map((quotation) => quotation.assignedEmployee?.userId).filter(Boolean),
  ])) as string[]

  if (staffIds.length > 0) {
    const staff = await prisma.user.findMany({
      where: { id: { in: staffIds }, companyId, isActive: true, role: { in: ["SUPER_ADMIN", "COMPANY_ADMIN", "ADMIN", "EMPLOYEE"] } },
      select: { id: true, firstName: true, lastName: true, email: true, role: true, profileImageUrl: true },
      orderBy: [{ role: "asc" }, { firstName: "asc" }],
    })
    if (staff.length > 0) return staff
  }

  return prisma.user.findMany({
    where: { companyId, isActive: true, role: { in: ["SUPER_ADMIN", "COMPANY_ADMIN", "ADMIN"] } },
    select: { id: true, firstName: true, lastName: true, email: true, role: true, profileImageUrl: true },
    orderBy: [{ role: "asc" }, { firstName: "asc" }],
  })
}

export default async function InternalChatPage({ searchParams }: InternalChatPageProps) {
  const resolvedSearchParams = await searchParams
  const session = await getServerSession(authOptions)
  if (!session) redirect("/dashboard")

  const role = (session.user as any).role as string
  if (!isCompanyAdminRole(role) && role !== "EMPLOYEE" && role !== "CUSTOMER") redirect("/dashboard")

  const companyId = (session.user as any).companyId as string | null
  const userId = (session.user as any).id as string
  if (!companyId || !userId) redirect("/dashboard")

  const users = role === "CUSTOMER"
    ? await getCustomerChatUsers(companyId, userId)
    : await prisma.user.findMany({
        where: {
          companyId,
          isActive: true,
          role: { in: ["SUPER_ADMIN", "COMPANY_ADMIN", "ADMIN", "EMPLOYEE"] },
        },
        select: { id: true, firstName: true, lastName: true, email: true, role: true, profileImageUrl: true },
        orderBy: [{ role: "asc" }, { firstName: "asc" }],
      })

  const requestedRecipientId = resolvedSearchParams?.recipientId
  const requestedRoomId = resolvedSearchParams?.roomId || ""
  const initialRecipientId = role === "CUSTOMER"
    ? users.find((user) => user.id === requestedRecipientId)?.id || users[0]?.id || ""
    : users.find((user) => user.id === requestedRecipientId)?.id || ""

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm font-semibold text-blue-700">
          <MessageCircle className="h-4 w-4" />
          {role === "CUSTOMER" ? "Customer support" : "Internal communication"}
        </div>
        <h1 className="mt-1 text-3xl font-bold">{role === "CUSTOMER" ? "Message Support" : "Team Chat"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {role === "CUSTOMER"
            ? "Talk to the worker or admin handling your quotations, payments, and receipts."
            : "Admins and workers can coordinate quotations, payments, customer follow-ups, and daily operations."}
        </p>
      </div>

      <InternalChatPanel
        currentUserId={userId}
        initialUsers={users}
        userRole={role}
        allowTeam={role !== "CUSTOMER"}
        initialRecipientId={initialRecipientId}
        initialRoomId={role === "CUSTOMER" ? "" : requestedRoomId}
      />
    </div>
  )
}
