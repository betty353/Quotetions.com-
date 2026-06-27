import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatCurrency, formatDate } from "@/lib/utils"
import { TrendingUp, Users, FileText, CreditCard } from "lucide-react"
import { isCompanyAdminRole } from "@/lib/tenant"

async function getDashboardData(userId: string, userRole: string) {
  if (isCompanyAdminRole(userRole)) {
    // Admin Dashboard
    const [
      totalQuotations,
      totalRevenue,
      totalCustomers,
      quotationsByStatus,
      recentQuotations,
      topProducts,
      quotationConversion,
    ] = await Promise.all([
      prisma.quotation.count(),
      prisma.quotation.aggregate({
        _sum: { total: true },
      }),
      prisma.customer.count(),
      prisma.quotation.groupBy({
        by: ["status"],
        _count: true,
      }),
      prisma.quotation.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        include: {
          customer: { select: { companyName: true } },
        },
      }),
      prisma.quotationItem.groupBy({
        by: ["productId"],
        _sum: { total: true },
        _count: true,
        take: 5,
        orderBy: { _sum: { total: "desc" } },
      }),
      prisma.quotation.findMany({
        where: { status: "COMPLETED" },
        select: { id: true },
      }),
    ])

    return {
      totalQuotations,
      totalRevenue: totalRevenue._sum.total || 0,
      totalCustomers,
      quotationsByStatus,
      recentQuotations,
      topProducts,
      conversionRate: totalQuotations > 0 ? ((quotationConversion.length / totalQuotations) * 100).toFixed(1) : "0.0",
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
    })

    if (!customer) {
      return null
    }

    const [myQuotations, totalSpent, recentQuotations] = await Promise.all([
      prisma.quotation.count({
        where: { customerId: customer.id },
      }),
      prisma.quotation.aggregate({
        where: { customerId: customer.id },
        _sum: { total: true },
      }),
      prisma.quotation.findMany({
        where: { customerId: customer.id },
        take: 5,
        orderBy: { createdAt: "desc" },
      }),
    ])

    return {
      myQuotations,
      totalSpent: totalSpent._sum.total || 0,
      recentQuotations,
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
  const data = await getDashboardData(userId, userRole)
  const paymentSetup = isCompanyAdminRole(userRole)
    ? await prisma.companySetting.findFirst({
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
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-2">Welcome back. Here&apos;s your business overview.</p>
          <div className="mt-3 inline-flex items-center gap-2 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            <span className="text-slate-600">Payment setup:</span>
            <Badge variant={paymentSetup?.paymentSetupComplete && paymentSetup.paymentEnabled ? "success" : "warning"}>
              {paymentSetup?.paymentSetupComplete && paymentSetup.paymentEnabled ? "Ready" : "Incomplete"}
            </Badge>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Quotations</CardTitle>
              <FileText className="h-4 w-4 text-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{adminData.totalQuotations}</div>
              <p className="text-xs text-muted-foreground mt-1">Live quotation records</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(adminData.totalRevenue)}</div>
              <p className="text-xs text-muted-foreground mt-1">From recorded quotations</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
              <Users className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{adminData.totalCustomers}</div>
              <p className="text-xs text-muted-foreground mt-1">Live customer records</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
              <CreditCard className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{adminData.conversionRate}%</div>
              <p className="text-xs text-muted-foreground mt-1">Completed quotations only</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Quotations */}
        {adminData.recentQuotations && adminData.recentQuotations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Recent Quotations</CardTitle>
              <CardDescription>Your latest quotations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {adminData.recentQuotations.map((quotation: any) => (
                  <div key={quotation.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-slate-50 transition-colors">
                    <div>
                      <p className="font-medium text-sm">{quotation.quotationNumber}</p>
                      <p className="text-xs text-muted-foreground">{quotation.customer?.companyName}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant={quotation.status === "COMPLETED" ? "success" : quotation.status === "APPROVED" ? "info" : "default"}>
                        {quotation.status}
                      </Badge>
                      <p className="font-medium text-sm">{formatCurrency(quotation.total)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {adminData.recentQuotations && adminData.recentQuotations.length === 0 && (
          <Card className="text-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground mb-4">No quotations yet</p>
            <p className="text-sm text-muted-foreground">Start by creating your first quotation to see data here.</p>
          </Card>
        )}
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
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Quotations</h1>
        <p className="text-muted-foreground mt-2">Manage your quotations and orders</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
            <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
            <CreditCard className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(customerData.totalSpent)}</div>
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
              {customerData.recentQuotations.map((quotation: any) => (
                <div key={quotation.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div>
                    <p className="font-medium text-sm">{quotation.quotationNumber}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(quotation.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant={quotation.status === "COMPLETED" ? "success" : "info"}>
                      {quotation.status}
                    </Badge>
                    <p className="font-medium text-sm">{formatCurrency(quotation.total)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
