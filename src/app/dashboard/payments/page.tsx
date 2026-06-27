import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency, formatDate } from "@/lib/utils"
import { CreditCard } from "lucide-react"
import ReconcileButton from "@/components/payments/ReconcileButton"
import { Badge } from "@/components/ui/badge"

export default async function PaymentsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/dashboard")

  const role = (session.user as any).role
  const where: any = {}
  if (role === "CUSTOMER") {
    const customer = await prisma.customer.findUnique({ where: { userId: session.user.id } })
    if (!customer) return <div className="text-center py-12">Customer profile not found</div>
    where.customerId = customer.id
  }

  const payments = await prisma.payment.findMany({
    where,
    orderBy: { paymentDate: "desc" },
    include: {
      quotation: true,
      customer: true,
      recordedBy: true,
    },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Payments</h1>
        <p className="text-sm text-muted-foreground mt-1">Track payment activity across quotations.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
          <CardDescription>Latest recorded payments.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {payments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CreditCard className="mx-auto mb-4 h-12 w-12 opacity-50" />
              <p>No payments have been recorded yet.</p>
            </div>
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="px-4 py-3">Number</th>
                  <th className="px-4 py-3">Quotation</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Provider</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Date</th>
                  {role !== "CUSTOMER" && <th className="px-4 py-3">Action</th>}
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3">{payment.paymentNumber}</td>
                    <td className="px-4 py-3">{payment.quotation?.quotationNumber || "-"}</td>
                    <td className="px-4 py-3">{payment.customer?.companyName || payment.customer?.contactPerson || "Customer"}</td>
                    <td className="px-4 py-3">{formatCurrency(payment.amount)}</td>
                    <td className="px-4 py-3">{payment.provider}</td>
                    <td className="px-4 py-3">{payment.method}</td>
                    <td className="px-4 py-3">{payment.reference || "-"}</td>
                    <td className="px-4 py-3">
                      <Badge variant={payment.status === "COMPLETED" ? "success" : payment.status === "FAILED" || payment.status === "CANCELLED" ? "destructive" : "default"}>
                        {payment.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">{formatDate(payment.paymentDate)}</td>
                    {role !== "CUSTOMER" && (
                      <td className="px-4 py-3">
                        <ReconcileButton paymentId={payment.id} />
                      </td>
                    )}
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
