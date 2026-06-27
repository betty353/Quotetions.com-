import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatCurrency, formatDate } from "@/lib/utils"
import { FileText, PlusCircle } from "lucide-react"
import { isCompanyAdminRole } from "@/lib/tenant"

export default async function QuotationsPage() {
  const session = await getServerSession(authOptions)
  if (!session) return null
  const role = (session.user as any).role
  const companyId = (session.user as any).companyId as string | null
  const customer = role === "CUSTOMER"
    ? await prisma.customer.findUnique({ where: { userId: session.user.id } })
    : null
  const where = role === "CUSTOMER"
    ? customer ? { customerId: customer.id } : { id: "__none__" }
    : companyId ? { companyId } : {}

  const [quotations, statusGroups] = await Promise.all([
    prisma.quotation.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        customer: true,
        createdBy: true,
      },
    }),
    prisma.quotation.groupBy({
      where,
      by: ["status"],
      _count: { status: true },
    }),
  ])

  const statusCounts = Object.fromEntries(
    statusGroups.map((group) => [group.status, group._count.status])
  ) as Record<string, number>

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">{role === "CUSTOMER" ? "My Quotations" : "Quotations"}</h1>
          <p className="text-sm text-muted-foreground mt-1">{role === "CUSTOMER" ? "View quotation requests, approval status, and payment progress." : "Manage your quotation pipeline, approvals, and customer follow-up."}</p>
        </div>
        <div className="flex items-center gap-3">
          {(role === "CUSTOMER" || isCompanyAdminRole(role) || role === "EMPLOYEE") && (
            <Link href="/dashboard/quotations/new" className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              <PlusCircle size={16} /> {role === "CUSTOMER" ? "Request Quotation" : "Create Quotation"}
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 xl:grid-cols-5 gap-4">
        {[
          { title: "Sent", value: statusCounts.SENT || 0 },
          { title: "Approved", value: statusCounts.APPROVED || 0 },
          { title: "Completed", value: statusCounts.COMPLETED || 0 },
          { title: "Viewed", value: statusCounts.VIEWED || 0 },
          { title: "Rejected", value: statusCounts.REJECTED || 0 },
        ].map((card) => (
          <Card key={card.title}>
            <CardContent>
              <p className="text-sm text-muted-foreground">{card.title}</p>
              <p className="mt-2 text-2xl font-semibold">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{role === "CUSTOMER" ? "Your Quotation Requests" : "Quotation List"}</CardTitle>
          <CardDescription>{role === "CUSTOMER" ? "Only quotations linked to your customer account are shown." : "Latest quotations for this company."}</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {quotations.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="mx-auto mb-4 h-12 w-12 opacity-50" />
              <p>No quotations available yet. Create your first quotation to get started.</p>
            </div>
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="px-4 py-3">Quotation#</th>
                  {role !== "CUSTOMER" && <th className="px-4 py-3">Customer</th>}
                  {role !== "CUSTOMER" && <th className="px-4 py-3">Created By</th>}
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {quotations.map((quotation) => (
                  <tr key={quotation.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 text-foreground underline-offset-4 hover:underline">
                      <Link href={`/dashboard/quotations/${quotation.id}`}>{quotation.quotationNumber}</Link>
                    </td>
                    {role !== "CUSTOMER" && <td className="px-4 py-3">{quotation.customer?.companyName || quotation.customer?.contactPerson || "Customer"}</td>}
                    {role !== "CUSTOMER" && <td className="px-4 py-3">{quotation.createdBy ? `${quotation.createdBy.firstName} ${quotation.createdBy.lastName}` : "System"}</td>}
                    <td className="px-4 py-3 font-semibold">{formatCurrency(quotation.total)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={quotation.status === "COMPLETED" ? "success" : quotation.status === "APPROVED" ? "secondary" : quotation.status === "REJECTED" ? "destructive" : quotation.status === "VIEWED" ? "outline" : "default"}>
                        {quotation.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">{formatDate(quotation.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
