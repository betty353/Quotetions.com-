import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"
import ExportXlsxButton from "@/components/export/ExportXlsxButton"
import { isCompanyAdminRole } from "@/lib/tenant"

export default async function ReportsPage({ searchParams }: { searchParams?: Promise<{ from?: string; to?: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/dashboard")

  const role = (session.user as any).role
  if (!isCompanyAdminRole(role) && role !== "EMPLOYEE") redirect("/dashboard")
  const companyId = (session.user as any).companyId as string | null
  if (!companyId) redirect("/dashboard")

  const params = await searchParams
  const from = params?.from ? new Date(params.from) : null
  const to = params?.to ? new Date(params.to) : null
  if (to) to.setHours(23, 59, 59, 999)
  const createdAt = from || to ? { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } : undefined
  const dateLabel = `${params?.from || "Start"} to ${params?.to || "Today"}`

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
      where: { companyId, ...(createdAt ? { createdAt } : {}) },
      include: {
        customer: true,
        payments: { where: { status: { in: ["PARTIAL", "COMPLETED"] } } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.payment.findMany({
      where: { companyId, status: { in: ["PARTIAL", "COMPLETED"] }, ...(createdAt ? { paymentDate: createdAt } : {}) },
      include: { customer: true },
    }),
    prisma.receipt.findMany({ where: { companyId, ...(createdAt ? { createdAt } : {}) } }),
    prisma.quotation.groupBy({ by: ["status"], where: { companyId, ...(createdAt ? { createdAt } : {}) }, _count: true }),
    prisma.quotationItem.groupBy({
      by: ["productId"],
      where: { quotation: { companyId, ...(createdAt ? { createdAt } : {}) } },
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
          where: createdAt ? { createdAt } : undefined,
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
      where: { companyId, ...(createdAt ? { createdAt } : {}) },
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
  const quotedTotal = quotations.reduce((sum, quotation) => sum + Number(quotation.total), 0)
  const outstandingTotal = quotations.reduce((sum, quotation) => {
    const paid = quotation.payments.reduce((paymentSum, payment) => paymentSum + Number(payment.amount), 0)
    return sum + Math.max(0, Number(quotation.total) - paid)
  }, 0)
  const completedCount = quotations.filter((quotation) => quotation.status === "COMPLETED").length
  const conversionRate = quotations.length ? (completedCount / quotations.length) * 100 : 0
  const stockValue = products.reduce((sum, product) => sum + product.stock * Number(product.unitPrice), 0)
  const totalStock = products.reduce((sum, product) => sum + product.stock, 0)
  const stockIn = stockMovements.filter((movement) => movement.type === "STOCK_IN").reduce((sum, movement) => sum + movement.quantity, 0)
  const stockOut = stockMovements.filter((movement) => movement.type === "STOCK_OUT").reduce((sum, movement) => sum + movement.quantity, 0)
  const damaged = stockMovements.filter((movement) => movement.type === "DAMAGED").reduce((sum, movement) => sum + movement.quantity, 0)
  const lost = stockMovements.filter((movement) => movement.type === "LOST").reduce((sum, movement) => sum + movement.quantity, 0)
  const lowStockProducts = products
    .filter((product) => product.reorderLevel !== null && product.reorderLevel !== undefined && product.stock <= product.reorderLevel)
    .slice(0, 12)

  const monthlyMap = new Map<string, number>()
  for (let i = 5; i >= 0; i -= 1) {
    const date = new Date()
    date.setMonth(date.getMonth() - i)
    monthlyMap.set(date.toISOString().slice(0, 7), 0)
  }
  payments.forEach((payment) => {
    const key = payment.paymentDate.toISOString().slice(0, 7)
    if (monthlyMap.has(key)) monthlyMap.set(key, (monthlyMap.get(key) || 0) + Number(payment.amount))
  })
  const monthlyRows = Array.from(monthlyMap.entries()).map(([month, revenue]) => ({ month, revenue }))

  const bestCustomersMap = new Map<string, { customer: string; paid: number; payments: number }>()
  payments.forEach((payment) => {
    const customerName = payment.customer?.companyName || payment.customer?.contactPerson || "Customer"
    const row = bestCustomersMap.get(payment.customerId) || { customer: customerName, paid: 0, payments: 0 }
    row.paid += Number(payment.amount)
    row.payments += 1
    bestCustomersMap.set(payment.customerId, row)
  })
  const bestCustomers = Array.from(bestCustomersMap.values()).sort((a, b) => b.paid - a.paid).slice(0, 10)

  const customerRows = quotations.slice(0, 50).map((quotation) => {
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

  const exportRows = [
    ...customerRows.map((row) => ({ section: "Quotations", ...row })),
    ...employeeRows.map((row) => ({ section: "Employees", ...row })),
    ...bestCustomers.map((row) => ({ section: "Best Customers", ...row })),
    ...monthlyRows.map((row) => ({ section: "Monthly Revenue", ...row })),
    ...lowStockProducts.map((product) => ({
      section: "Low Stock",
      product: product.name,
      sku: product.sku,
      stock: product.stock,
      reorderLevel: product.reorderLevel,
      value: Number(product.unitPrice) * product.stock,
    })),
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Reports</h1>
          <p className="text-sm text-muted-foreground mt-1">Revenue, outstanding balances, orders, products, inventory, and employee performance. Period: {dateLabel}</p>
        </div>
        <div className="flex flex-col gap-2 xl:items-end">
          <form className="flex flex-wrap items-end gap-2" method="get">
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              From
              <input type="date" name="from" defaultValue={params?.from || ""} className="h-9 rounded-lg border border-input bg-card px-3 text-sm text-foreground" />
            </label>
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              To
              <input type="date" name="to" defaultValue={params?.to || ""} className="h-9 rounded-lg border border-input bg-card px-3 text-sm text-foreground" />
            </label>
            <button className="h-9 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground" type="submit">Apply</button>
          </form>
          <ExportXlsxButton rows={exportRows} filename={`business-report-${new Date().toISOString()}`} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Metric title="Revenue" value={formatCurrency(paidTotal)} detail="Confirmed payments" />
        <Metric title="Quoted Value" value={formatCurrency(quotedTotal)} detail={`${quotations.length} quotations`} />
        <Metric title="Outstanding" value={formatCurrency(outstandingTotal)} detail="Unpaid quotation balance" />
        <Metric title="Conversion" value={`${conversionRate.toFixed(1)}%`} detail="Completed quotations" />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Metric title="Receipts" value={String(receipts.length)} detail={formatCurrency(receiptedTotal)} />
        <Metric title="Stock Value" value={formatCurrency(stockValue, "ZMW")} detail={`${totalStock} units`} />
        <Metric title="Stock In / Out" value={`${stockIn} / ${stockOut}`} detail="Movement history" />
        <Metric title="Damaged / Lost" value={`${damaged} / ${lost}`} detail="Inventory exceptions" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Monthly Revenue</CardTitle>
            <CardDescription>Confirmed payments across the last six months.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {monthlyRows.map((row) => {
              const max = Math.max(...monthlyRows.map((item) => item.revenue), 1)
              return (
                <div key={row.month} className="grid gap-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>{row.month}</span>
                    <span className="font-semibold">{formatCurrency(row.revenue)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div className="h-2 rounded-full bg-blue-600" style={{ width: `${Math.max(3, (row.revenue / max) * 100)}%` }} />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Best Customers</CardTitle>
            <CardDescription>Customers ranked by confirmed payments.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Payments</th><th className="px-4 py-3">Paid</th></tr>
              </thead>
              <tbody>
                {bestCustomers.map((row) => (
                  <tr key={row.customer} className="border-b border-slate-100">
                    <td className="px-4 py-3">{row.customer}</td>
                    <td className="px-4 py-3">{row.payments}</td>
                    <td className="px-4 py-3 font-semibold">{formatCurrency(row.paid)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quotation Status</CardTitle>
            <CardDescription>Pipeline and order distribution by status.</CardDescription>
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
          <CardTitle>Low Stock</CardTitle>
          <CardDescription>Products at or below reorder level.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {lowStockProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No low-stock products.</p>
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr><th className="px-4 py-3">Product</th><th className="px-4 py-3">SKU</th><th className="px-4 py-3">Stock</th><th className="px-4 py-3">Reorder</th><th className="px-4 py-3">Value</th></tr>
              </thead>
              <tbody>
                {lowStockProducts.map((product) => (
                  <tr key={product.id} className="border-b border-slate-100">
                    <td className="px-4 py-3">{product.name}</td>
                    <td className="px-4 py-3">{product.sku}</td>
                    <td className="px-4 py-3"><Badge variant={product.stock < 0 ? "destructive" : "warning"}>{product.stock}</Badge></td>
                    <td className="px-4 py-3">{product.reorderLevel}</td>
                    <td className="px-4 py-3">{formatCurrency(Number(product.unitPrice) * product.stock, product.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

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

function Metric({ title, value, detail }: { title: string; value: string; detail?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
      </CardContent>
    </Card>
  )
}
