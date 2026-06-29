import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { Percent } from "lucide-react"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isCompanyAdminRole } from "@/lib/tenant"
import { formatCurrency, formatDateTime } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import DiscountRequestActions from "@/components/quotations/DiscountRequestActions"

export default async function DiscountRequestsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/dashboard")
  if (!isCompanyAdminRole((session.user as any).role)) redirect("/dashboard")
  const companyId = (session.user as any).companyId as string | null
  if (!companyId) redirect("/dashboard")

  const requests = await prisma.discountRequest.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    take: 100,
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Discount Requests</h1>
        <p className="mt-1 text-sm text-muted-foreground">Approve employee discount requests before discounted quotations are issued.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Percent className="h-5 w-5 text-blue-600" /> Approval Queue</CardTitle>
          <CardDescription>{requests.filter((request) => request.status === "PENDING").length} pending request(s).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {requests.length === 0 ? (
            <p className="py-10 text-center text-muted-foreground">No discount requests yet.</p>
          ) : requests.map((request) => (
            <div key={request.id} className="grid gap-4 rounded-xl border bg-white p-4 lg:grid-cols-[1fr_260px]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={request.status === "APPROVED" ? "success" : request.status === "REJECTED" ? "destructive" : "warning"}>{request.status}</Badge>
                  <span className="text-sm text-muted-foreground">{formatDateTime(request.createdAt)}</span>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div><p className="text-xs text-muted-foreground">Subtotal</p><p className="font-semibold">{formatCurrency(request.subtotal)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Discount</p><p className="font-semibold text-orange-700">{formatCurrency(request.discountAmount)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Total</p><p className="font-semibold">{formatCurrency(request.total)}</p></div>
                </div>
                {request.notes && <p className="mt-3 text-sm text-muted-foreground">{request.notes}</p>}
                {request.quotationId && <p className="mt-3 text-sm text-green-700">Created quotation: {request.quotationId}</p>}
              </div>
              <div>
                {request.status === "PENDING" ? (
                  <DiscountRequestActions id={request.id} />
                ) : (
                  <p className="text-sm text-muted-foreground">{request.status === "REJECTED" ? request.rejectionReason || "Rejected" : "Approved"}</p>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
