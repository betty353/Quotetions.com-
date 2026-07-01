import Link from "next/link"
import type { ReactNode } from "react"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { CheckCircle2, Clock3, PackageCheck, ShoppingCart, WalletCards } from "lucide-react"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isCompanyAdminRole } from "@/lib/tenant"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatCurrency, formatDate } from "@/lib/utils"
import OrderWorkflowActions from "@/components/orders/OrderWorkflowActions"

export default async function OrdersPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/dashboard")

  const role = (session.user as any).role
  const companyId = (session.user as any).companyId as string | null
  if (!isCompanyAdminRole(role) || !companyId) redirect("/dashboard")

  const orders = await prisma.quotation.findMany({
    where: {
      companyId,
      OR: [
        { status: { in: ["APPROVED", "PROCESSING", "READY", "COMPLETED"] } },
        { paymentStatus: { in: ["PARTIAL", "COMPLETED"] } },
      ],
    },
    include: {
      customer: { include: { user: true } },
      items: true,
      payments: { where: { status: { in: ["PARTIAL", "COMPLETED"] } } },
      receipts: true,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  })
  const accepted = orders.filter((order) => order.status === "APPROVED").length
  const paid = orders.filter((order) => order.paymentStatus === "COMPLETED").length
  const processing = orders.filter((order) => order.status === "PROCESSING").length
  const ready = orders.filter((order) => order.status === "READY").length
  const completed = orders.filter((order) => order.status === "COMPLETED").length

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Orders</h1>
          <p className="mt-1 text-sm text-muted-foreground">Purchase orders and customer order activity connected to quotations, payments, and receipts.</p>
        </div>
        <Link href="/dashboard/quotations/new?mode=purchase-order" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
          <ShoppingCart className="h-4 w-4" />
          Purchase Order
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <Metric title="Accepted" value={accepted} icon={<Clock3 className="h-4 w-4 text-blue-600" />} />
        <Metric title="Paid" value={paid} icon={<WalletCards className="h-4 w-4 text-green-600" />} />
        <Metric title="Processing" value={processing} icon={<ShoppingCart className="h-4 w-4 text-violet-600" />} />
        <Metric title="Ready" value={ready} icon={<PackageCheck className="h-4 w-4 text-amber-600" />} />
        <Metric title="Completed" value={completed} icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Order Register</CardTitle>
          <CardDescription>Open any order to record payments, receipts, and customer follow-up.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {orders.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <ShoppingCart className="mx-auto mb-4 h-12 w-12 opacity-50" />
              <p>No orders yet.</p>
            </div>
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Items</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3">Paid</th>
                  <th className="px-4 py-3">Receipts</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const paidAmount = order.payments.reduce((sum, payment) => sum + Number(payment.amount), 0)
                  return (
                    <tr key={order.id} className="border-b hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <Link href={`/dashboard/quotations/${order.id}`} className="font-medium text-blue-600 underline-offset-4 hover:underline">
                          {order.quotationNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{order.customer?.companyName || order.customer?.contactPerson || order.customer?.user.email || "Customer"}</td>
                      <td className="px-4 py-3">{order.items.length}</td>
                      <td className="px-4 py-3 font-semibold">{formatCurrency(order.total, order.currency)}</td>
                      <td className="px-4 py-3"><Badge variant={order.status === "COMPLETED" ? "success" : order.status === "READY" ? "warning" : "default"}>{order.status}</Badge></td>
                      <td className="px-4 py-3"><Badge variant={order.paymentStatus === "COMPLETED" ? "success" : order.paymentStatus === "PARTIAL" ? "warning" : "default"}>{order.paymentStatus}</Badge></td>
                      <td className="px-4 py-3">{formatCurrency(paidAmount, order.currency)}</td>
                      <td className="px-4 py-3">{order.receipts.length}</td>
                      <td className="px-4 py-3">{formatDate(order.createdAt)}</td>
                      <td className="px-4 py-3">
                        <OrderWorkflowActions quotationId={order.id} status={order.status} paymentStatus={order.paymentStatus} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Metric({ title, value, icon }: { title: string; value: number; icon: ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">{icon}{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  )
}
