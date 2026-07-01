import { getServerSession } from "next-auth"
import type { ReactNode } from "react"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatCurrency, formatDate } from "@/lib/utils"
import Link from "next/link"
import { ArrowRight, CalendarClock, CreditCard, FilePlus2, FileText, PackageMinus, Receipt, ShoppingCart, Store, TrendingUp, Users } from "lucide-react"
import { isCompanyAdminRole } from "@/lib/tenant"
import CustomerProfileForm from "@/components/customers/CustomerProfileForm"

async function getDashboardData(userId: string, userRole: string, companyId?: string | null) {
  if (isCompanyAdminRole(userRole)) {
    const companyWhere = companyId ? { companyId } : {}
    const [
      quotations,
      payments,
      totalCustomers,
      quotationsByStatus,
      recentQuotations,
      dueFollowUps,
      lowStockProducts,
      recentActivity,
    ] = await Promise.all([
      prisma.quotation.findMany({
        where: companyWhere,
        select: {
          id: true,
          status: true,
          paymentStatus: true,
          total: true,
          payments: {
            where: { status: { in: ["PARTIAL", "COMPLETED"] } },
            select: { amount: true },
          },
        },
      }),
      prisma.payment.findMany({
        where: { ...companyWhere, status: { in: ["PARTIAL", "COMPLETED"] } },
        select: { amount: true },
      }),
      prisma.customer.count({ where: companyWhere }),
      prisma.quotation.groupBy({
        where: companyWhere,
        by: ["status"],
        _count: true,
      }),
      prisma.quotation.findMany({
        where: companyWhere,
        take: 5,
        orderBy: { createdAt: "desc" },
        include: {
          customer: { select: { companyName: true } },
        },
      }),
      prisma.followUp.count({
        where: {
          ...companyWhere,
          status: "PENDING",
          reminderDate: { lte: new Date() },
        },
      }),
      prisma.product.findMany({
        where: { ...companyWhere, reorderLevel: { not: null } },
        select: { stock: true, reorderLevel: true },
      }),
      prisma.activityLog.findMany({
        where: companyWhere,
        take: 6,
        orderBy: { createdAt: "desc" },
        include: { user: true, customer: true, quotation: true },
      }),
    ])

    const totalRevenue = payments.reduce((sum, payment) => sum + Number(payment.amount), 0)
    const outstanding = quotations.reduce((sum, quotation) => {
      const paid = quotation.payments.reduce((paymentSum, payment) => paymentSum + Number(payment.amount), 0)
      return sum + Math.max(0, Number(quotation.total) - paid)
    }, 0)
    const completedCount = quotations.filter((quotation) => quotation.status === "COMPLETED").length
    const activeOrders = quotations.filter((quotation) => ["APPROVED", "PROCESSING", "READY"].includes(quotation.status)).length

    return {
      totalQuotations: quotations.length,
      totalRevenue,
      outstanding,
      totalCustomers,
      quotationsByStatus,
      recentQuotations,
      dueFollowUps,
      lowStockProducts: lowStockProducts.filter((product) => product.reorderLevel !== null && product.stock <= product.reorderLevel).length,
      recentActivity,
      activeOrders,
      conversionRate: quotations.length > 0 ? ((completedCount / quotations.length) * 100).toFixed(1) : "0.0",
    }
  } else if (userRole === "EMPLOYEE") {
    // Employee Dashboard
    const employee = await prisma.employee.findUnique({
      where: { userId },
    })

    if (!employee) {
      return null
    }

    const [assignedQuotations, followUpsNeeded, recentActivity] = await Promise.all([
      prisma.quotation.count({
        where: { assignedEmployeeId: employee.id },
      }),
      prisma.followUp.count({
        where: {
          employeeId: employee.id,
          status: "PENDING",
        },
      }),
      prisma.activityLog.findMany({
        where: { employeeId: employee.id },
        take: 10,
        orderBy: { createdAt: "desc" },
      }),
    ])

    return {
      assignedQuotations,
      followUpsNeeded,
      recentActivity,
    }
  } else {
    // Customer Dashboard
    const customer = await prisma.customer.findUnique({
      where: { userId },
      include: { user: true },
    })

    if (!customer) {
      return null
    }

    const [myQuotations, openQuotations, totalQuoted, totalPaid, recentQuotations, paymentCount, receiptCount, company] = await Promise.all([
      prisma.quotation.count({
        where: { customerId: customer.id },
      }),
      prisma.quotation.count({
        where: {
          customerId: customer.id,
          paymentStatus: { not: "COMPLETED" },
          status: { in: ["SENT", "VIEWED", "APPROVED"] },
        },
      }),
      prisma.quotation.aggregate({
        where: { customerId: customer.id },
        _sum: { total: true },
      }),
      prisma.payment.aggregate({
        where: {
          customerId: customer.id,
          status: { in: ["PARTIAL", "COMPLETED"] },
        },
        _sum: { amount: true },
      }),
      prisma.quotation.findMany({
        where: {
          customerId: customer.id,
          OR: [
            { validUntil: null },
            { validUntil: { gte: new Date() } },
            { paymentStatus: "COMPLETED" },
            { status: "COMPLETED" },
          ],
        },
        take: 5,
        orderBy: { createdAt: "desc" },
      }),
      prisma.payment.count({
        where: { customerId: customer.id },
      }),
      prisma.receipt.count({
        where: { customerId: customer.id },
      }),
      customer.companyId
        ? prisma.company.findUnique({
            where: { id: customer.companyId },
            select: { name: true, slug: true },
          })
        : null,
    ])

    return {
      myQuotations,
      openQuotations,
      totalSpent: totalPaid._sum.amount || 0,
      outstanding: Math.max(0, Number(totalQuoted._sum.total || 0) - Number(totalPaid._sum.amount || 0)),
      recentQuotations,
      paymentCount,
      receiptCount,
      company,
      customer,
    }
  }
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return null
  }

  const userRole = (session.user as any).role
  const userId = (session.user as any).id
  const companyId = (session.user as any).companyId as string | null
  const data = await getDashboardData(userId, userRole, companyId)
  const paymentSetup = isCompanyAdminRole(userRole)
    ? await prisma.companySetting.findFirst({
        where: companyId ? { companyId } : {},
        select: { paymentSetupComplete: true, paymentEnabled: true },
      })
    : null

  if (!data) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Unable to load dashboard data</p>
      </div>
    )
  }

  // Admin Dashboard
  if (isCompanyAdminRole(userRole)) {
    const adminData = data as any
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{new Date().toLocaleDateString("en-ZM", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">Business Dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">Financial position, sales pipeline, and work requiring attention.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/quotations/new" className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">
              <FilePlus2 className="h-4 w-4" />New quotation
            </Link>
            <Link href="/dashboard/customers" className="inline-flex h-10 items-center gap-2 rounded-lg border border-input bg-card px-4 text-sm font-medium hover:bg-accent">
              <Users className="h-4 w-4 text-blue-600" />Customers
            </Link>
            <Link href="/dashboard/reports" className="inline-flex h-10 items-center gap-2 rounded-lg border border-input bg-card px-4 text-sm font-medium hover:bg-accent">
              <TrendingUp className="h-4 w-4 text-green-600" />Reports
            </Link>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <DashboardMetric title="Revenue" value={formatCurrency(adminData.totalRevenue)} detail="Confirmed payments" icon={<TrendingUp className="h-5 w-5 text-green-600" />} />
          <DashboardMetric title="Outstanding" value={formatCurrency(adminData.outstanding)} detail="Open customer balance" icon={<CreditCard className="h-5 w-5 text-amber-600" />} />
          <DashboardMetric title="Active Orders" value={String(adminData.activeOrders)} detail="Accepted, processing, or ready" icon={<ShoppingCart className="h-5 w-5 text-blue-600" />} />
          <DashboardMetric title="Customers" value={String(adminData.totalCustomers)} detail={`${adminData.conversionRate}% conversion`} icon={<Users className="h-5 w-5 text-violet-600" />} />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Link href="/dashboard/followups" className="rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent">
            <div className="flex items-center justify-between">
              <CalendarClock className="h-5 w-5 text-red-600" />
              <Badge variant={adminData.dueFollowUps > 0 ? "destructive" : "success"}>{adminData.dueFollowUps}</Badge>
            </div>
            <p className="mt-3 text-sm font-semibold">Due follow-ups</p>
            <p className="mt-1 text-xs text-muted-foreground">Customer reminders requiring attention</p>
          </Link>
          <Link href="/dashboard/inventory" className="rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent">
            <div className="flex items-center justify-between">
              <PackageMinus className="h-5 w-5 text-amber-600" />
              <Badge variant={adminData.lowStockProducts > 0 ? "warning" : "success"}>{adminData.lowStockProducts}</Badge>
            </div>
            <p className="mt-3 text-sm font-semibold">Low-stock products</p>
            <p className="mt-1 text-xs text-muted-foreground">Items at or below reorder level</p>
          </Link>
          <Link href="/dashboard/payment-setup" className="rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent">
            <div className="flex items-center justify-between">
              <CreditCard className="h-5 w-5 text-blue-600" />
              <Badge variant={paymentSetup?.paymentSetupComplete && paymentSetup.paymentEnabled ? "success" : "warning"}>
                {paymentSetup?.paymentSetupComplete && paymentSetup.paymentEnabled ? "Ready" : "Setup"}
              </Badge>
            </div>
            <p className="mt-3 text-sm font-semibold">Online payments</p>
            <p className="mt-1 text-xs text-muted-foreground">DPO and settlement configuration</p>
          </Link>
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <Card>
            <CardHeader>
              <CardTitle>Sales Pipeline</CardTitle>
              <CardDescription>{adminData.totalQuotations} quotations across all stages.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {adminData.quotationsByStatus.map((row: any) => (
                <div key={row.status} className="flex items-center justify-between border-b border-border pb-3">
                  <Badge variant={row.status === "COMPLETED" ? "success" : row.status === "REJECTED" ? "destructive" : "default"}>{row.status}</Badge>
                  <span className="text-sm font-semibold">{row._count}</span>
                </div>
              ))}
              <Link href="/dashboard/quotations" className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline">
                View pipeline <ArrowRight className="h-4 w-4" />
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>Recent Quotations</CardTitle>
                <CardDescription>Latest customer activity.</CardDescription>
              </div>
              <Link href="/dashboard/quotations" className="text-sm font-medium text-blue-600 hover:underline">View all</Link>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b text-muted-foreground">
                  <tr><th className="px-3 py-2">Quotation</th><th className="px-3 py-2">Customer</th><th className="px-3 py-2">Status</th><th className="px-3 py-2 text-right">Amount</th></tr>
                </thead>
                <tbody>
                  {adminData.recentQuotations.map((quotation: any) => (
                    <tr key={quotation.id} className="border-b hover:bg-accent">
                      <td className="px-3 py-3"><Link href={`/dashboard/quotations/${quotation.id}`} className="font-medium text-blue-600 hover:underline">{quotation.quotationNumber}</Link></td>
                      <td className="px-3 py-3">{quotation.customer?.companyName || "Customer"}</td>
                      <td className="px-3 py-3"><Badge variant={quotation.status === "COMPLETED" ? "success" : "default"}>{quotation.status}</Badge></td>
                      <td className="px-3 py-3 text-right font-semibold">{formatCurrency(quotation.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest actions across your workspace.</CardDescription>
            </div>
            <Link href="/dashboard/activity-logs" className="text-sm font-medium text-blue-600 hover:underline">View logs</Link>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              {adminData.recentActivity.map((activity: any) => (
                <div key={activity.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium">{activity.description}</p>
                    <p className="text-xs text-muted-foreground">{activity.user ? `${activity.user.firstName} ${activity.user.lastName}` : "System"} · {activity.customer?.companyName || activity.customer?.contactPerson || "Customer"}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{formatDate(activity.createdAt)}</p>
                </div>
              ))}
              {adminData.recentActivity.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No recent activity.</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Employee Dashboard
  if (userRole === "EMPLOYEE") {
    const employeeData = data as any
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Dashboard</h1>
          <p className="text-muted-foreground mt-2">Track your quotations and follow-ups</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Assigned Quotations</CardTitle>
              <FileText className="h-4 w-4 text-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{employeeData.assignedQuotations}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Follow-ups</CardTitle>
              <TrendingUp className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{employeeData.followUpsNeeded}</div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Customer Dashboard
  const customerData = data as any
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Customer Portal</h1>
          <p className="text-muted-foreground mt-2">View your quotations, payments, receipts, and company catalog.</p>
        </div>
        {customerData.company?.slug && (
          <Link href={`/store/${customerData.company.slug}`} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Store className="h-4 w-4" />
            Browse store
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">My Quotations</CardTitle>
            <FileText className="h-4 w-4 text-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customerData.myQuotations}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open</CardTitle>
            <FileText className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customerData.openQuotations}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paid</CardTitle>
            <CreditCard className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(customerData.totalSpent)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
            <CreditCard className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(customerData.outstanding)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receipts</CardTitle>
            <Receipt className="h-4 w-4 text-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customerData.receiptCount}</div>
            <p className="mt-1 text-xs text-muted-foreground">{customerData.paymentCount} payments</p>
          </CardContent>
        </Card>
      </div>

      {customerData.recentQuotations && customerData.recentQuotations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Quotations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {customerData.recentQuotations.map((quotation: any) => {
                const isPaid = quotation.paymentStatus === "COMPLETED" || quotation.status === "COMPLETED"
                const actionText = isPaid ? "View receipt" : quotation.status === "APPROVED" ? "Pay now" : quotation.status === "REJECTED" ? "View" : "Review"
                return (
                <div key={quotation.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div>
                    <Link href={`/dashboard/quotations/${quotation.id}`} className="font-medium text-sm underline-offset-4 hover:underline">{quotation.quotationNumber}</Link>
                    <p className="text-xs text-muted-foreground">{formatDate(quotation.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant={quotation.status === "COMPLETED" ? "success" : "info"}>
                      {quotation.status}
                    </Badge>
                    <p className="font-medium text-sm">{formatCurrency(quotation.total)}</p>
                    <Link href={`/dashboard/quotations/${quotation.id}`} className="rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-accent">
                      {actionText}
                    </Link>
                  </div>
                </div>
              )})}
            </div>
          </CardContent>
        </Card>
      )}
      {customerData.customer && (
        <CustomerProfileForm customer={customerData.customer} />
      )}
      {customerData.recentQuotations?.length === 0 && (
        <Card className="text-center py-12">
          <Store className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <p className="text-muted-foreground mb-4">You do not have any quotations yet.</p>
          {customerData.company?.slug ? (
            <Link href={`/store/${customerData.company.slug}`} className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              Browse catalog
            </Link>
          ) : (
            <p className="text-sm text-muted-foreground">Open a company store link to request your first quotation.</p>
          )}
        </Card>
      )}
    </div>
  )
}

function DashboardMetric({ title, value, detail, icon }: { title: string; value: string; detail: string; icon: ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  )
}
