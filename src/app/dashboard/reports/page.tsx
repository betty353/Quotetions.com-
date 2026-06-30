import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"
import ExportXlsxButton from "@/components/export/ExportXlsxButton"
import { isCompanyAdminRole } from "@/lib/tenant"

export default async function ReportsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/dashboard")

  const role = (session.user as any).role
  if (!isCompanyAdminRole(role) && role !== "EMPLOYEE") redirect("/dashboard")
  const companyId = (session.user as any).companyId as string | null
  if (!companyId) redirect("/dashboard")

  const [
    quotations,
    payments,
    receipts,
    quotationStatuses,
    topProductRows,
    employees,
    products,
    stockMovements,
  ] = await Promise.all([
    prisma.quotation.findMany({
      where: { companyId },
      include: {
        customer: true,
        payments: { where: { status: { in: ["PARTIAL", "COMPLETED"] } } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.payment.findMany({ where: { companyId, status: { in: ["PARTIAL", "COMPLETED"] } } }),
    prisma.receipt.findMany({ where: { companyId } }),
    prisma.quotation.groupBy({ by: ["status"], where: { companyId }, _count: true }),
    prisma.quotationItem.groupBy({
      by: ["productId"],
      where: { quotation: { companyId } },
      _sum: { quantity: true, total: true },
      _count: true,
      orderBy: { _sum: { total: "desc" } },
      take: 10,
    }),
    prisma.employee.findMany({
      where: { companyId },
      include: {
        user: true,
        quotations: {
          include: { payments: { where: { status: { in: ["PARTIAL", "COMPLETED"] } } } },
        },
        followUps: true,
      },
      orderBy: { employeeId: "asc" },
    }),
    prisma.product.findMany({
      where: { companyId },
      include: { category: true },
      orderBy: { name: "asc" },
    }),
    prisma.productStockMovement.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ])

  const productIds = topProductRows.map((row) => row.productId)
  const topProducts = await prisma.product.findMany({
    where: { companyId, id: { in: productIds } },
    include: { category: true },
  })
  const productMap = new Map(topProducts.map((product) => [product.id, product]))

  const paidTotal = payments.reduce((sum, payment) => sum + Number(payment.amount), 0)
  const receiptedTotal = receipts.reduce((sum, receipt) => sum + Number(receipt.amount), 0)
  const completedCount = quotations.filter((quotation) => quotation.status === "COMPLETED").length
  const conversionRate = quotations.length ? (completedCount / quotations.length) * 100 : 0
  const stockValue = products.reduce((sum, product) => sum + product.stock * Number(product.unitPrice), 0)
  const totalStock = products.reduce((sum, product) => sum + product.stock, 0)
  const stockIn = stockMovements.filter((movement) => movement.type === "STOCK_IN").reduce((sum, movement) => sum + movement.quantity, 0)
  const stockOut = stockMovements.filter((movement) => movement.type === "STOCK_OUT").reduce((sum, movement) => sum + movement.quantity, 0)
  const damaged = stockMovements.filter((movement) => movement.type === "DAMAGED").reduce((sum, movement) => sum + movement.quantity, 0)
  const lost = stockMovements.filter((movement) => movement.type === "LOST").reduce((sum, movement) => sum + movement.quantity, 0)

  const customerRows = quotations.slice(0, 20).map((quotation) => {
    const paid = quotation.payments.reduce((sum, payment) => sum + Number(payment.amount), 0)
    return {
      quotationNumber: quotation.quotationNumber,
      customer: quotation.customer?.companyName || quotation.customer?.contactPerson || "Customer",
      status: quotation.status,
      total: Number(quotation.total),
      paid,
      outstanding: Math.max(0, Number(quotation.total) - paid),
    }
  })

  const employeeRows = employees.map((employee) => {
    const assigned = employee.quotations.reduce((sum, quotation) => sum + Number(quotation.total), 0)
    const collected = employee.quotations.reduce(
      (sum, quotation) => sum + quotation.payments.reduce((paymentSum, payment) => paymentSum + Number(payment.amount), 0),
      0
    )
    return {
      employee: `${employee.user.firstName} ${employee.user.lastName}`,
      assigned,
      collected,
      quotations: employee.quotations.length,
      followUps: employee.followUps.length,
      target: Number(employee.quotaTarget || 0),
      achievement: Number(employee.quotaTarget || 0) > 0 ? (collected / Number(employee.quotaTarget)) * 100 : 0,
    }
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Reports</h1>
          <p className="text-sm text-muted-foreground mt-1">Revenue, conversion, product, inventory, and employee performance.</p>
        </div>
        <ExportXlsxButton rows={customerRows} filename={`quotation-report-${new Date().toISOString()}`} />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Revenue</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(paidTotal)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Receipts Issued</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{receipts.length}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Receipted</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(receiptedTotal)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Conversion</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{conversionRate.toFixed(1)}%</div><p className="text-xs text-muted-foreground mt-1">Completed quotations</p></CardContent></Card>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Total Stock</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{totalStock}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Stock Value</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(stockValue, "ZMW")}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Stock In / Out</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stockIn} / {stockOut}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Damaged / Lost</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{damaged} / {lost}</div></CardContent></Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quotation Status</CardTitle>
            <CardDescription>Pipeline distribution by status.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {quotationStatuses.map((row) => (
              <div key={row.status} className="flex items-center justify-between border-b border-slate-100 pb-3">
                <Badge variant={row.status === "COMPLETED" ? "success" : row.status === "REJECTED" ? "destructive" : "default"}>{row.status}</Badge>
                <span className="font-semibold">{row._count}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Products</CardTitle>
            <CardDescription>Highest-value quotation line items.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr><th className="px-4 py-3">Product</th><th className="px-4 py-3">Qty</th><th className="px-4 py-3">Value</th></tr>
              </thead>
              <tbody>
                {topProductRows.map((row) => {
                  const product = productMap.get(row.productId)
                  return (
                    <tr key={row.productId} className="border-b border-slate-100">
                      <td className="px-4 py-3"><div className="font-medium">{product?.name || row.productId}</div><div className="text-xs text-slate-500">{product?.category?.name || ""}</div></td>
                      <td className="px-4 py-3">{row._sum.quantity || 0}</td>
                      <td className="px-4 py-3">{formatCurrency(row._sum.total || 0)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Employee Performance</CardTitle>
          <CardDescription>Assigned revenue, payments, targets, and follow-up activity by employee.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr><th className="px-4 py-3">Employee</th><th className="px-4 py-3">Quotations</th><th className="px-4 py-3">Assigned</th><th className="px-4 py-3">Collected</th><th className="px-4 py-3">Target</th><th className="px-4 py-3">Achieved</th><th className="px-4 py-3">Follow-Ups</th></tr>
            </thead>
            <tbody>
              {employeeRows.map((row) => (
                <tr key={row.employee} className="border-b border-slate-100">
                  <td className="px-4 py-3">{row.employee}</td>
                  <td className="px-4 py-3">{row.quotations}</td>
                  <td className="px-4 py-3">{formatCurrency(row.assigned)}</td>
                  <td className="px-4 py-3">{formatCurrency(row.collected)}</td>
                  <td className="px-4 py-3">{row.target > 0 ? formatCurrency(row.target) : "-"}</td>
                  <td className="px-4 py-3">{row.target > 0 ? `${row.achievement.toFixed(1)}%` : "-"}</td>
                  <td className="px-4 py-3">{row.followUps}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
