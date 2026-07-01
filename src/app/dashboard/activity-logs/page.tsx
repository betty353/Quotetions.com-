import Link from "next/link"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { Activity, ShieldCheck } from "lucide-react"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isCompanyAdminRole } from "@/lib/tenant"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatDateTime } from "@/lib/utils"
import ExportXlsxButton from "@/components/export/ExportXlsxButton"

function relatedHref(log: { source: string; relatedModel?: string | null; related?: string; quotationId?: string | null; customerId?: string | null }) {
  if (log.quotationId) return `/dashboard/quotations/${log.quotationId}`
  if (log.customerId) return `/dashboard/customers/${log.customerId}`
  if (log.source === "Audit" && log.relatedModel === "Quotation" && log.related) return `/dashboard/quotations/${log.related}`
  if (log.source === "Audit" && log.relatedModel === "Customer" && log.related) return `/dashboard/customers/${log.related}`
  return null
}

export default async function ActivityLogsPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; source?: string; type?: string; from?: string; to?: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/dashboard")

  const role = (session.user as any).role
  if (!isCompanyAdminRole(role)) redirect("/dashboard")

  const companyId = (session.user as any).companyId as string | null
  if (!companyId) redirect("/dashboard")
  const params = await searchParams
  const q = (params?.q || "").trim().toLowerCase()
  const sourceFilter = params?.source || "ALL"
  const typeFilter = (params?.type || "").trim().toLowerCase()
  const from = params?.from ? new Date(params.from) : null
  const to = params?.to ? new Date(params.to) : null
  if (to) to.setHours(23, 59, 59, 999)
  const createdAt = from || to ? { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } : undefined

  const [activityLogs, auditLogs] = await Promise.all([
    prisma.activityLog.findMany({
      where: { companyId, ...(createdAt ? { createdAt } : {}) },
      orderBy: { createdAt: "desc" },
      take: 300,
      include: {
        customer: { include: { user: true } },
        user: true,
        employee: { include: { user: true } },
        quotation: true,
        payment: true,
        receipt: true,
        followUp: true,
      },
    }),
    prisma.auditLog.findMany({
      where: { companyId, ...(createdAt ? { createdAt } : {}) },
      orderBy: { createdAt: "desc" },
      take: 300,
      include: { user: true },
    }),
  ])

  const combined = [
    ...activityLogs.map((log) => ({
      id: log.id,
      source: "Activity",
      type: log.activityType,
      title: log.description,
      user: log.user ? `${log.user.firstName} ${log.user.lastName}` : log.employee?.user ? `${log.employee.user.firstName} ${log.employee.user.lastName}` : "System",
      customer: log.customer?.companyName || log.customer?.contactPerson || log.customer?.user?.email || "-",
      related: log.quotation?.quotationNumber || log.payment?.paymentNumber || log.receipt?.receiptNumber || log.followUpId || "-",
      relatedModel: log.quotation ? "Quotation" : log.payment ? "Payment" : log.receipt ? "Receipt" : log.followUp ? "FollowUp" : null,
      quotationId: log.quotationId,
      customerId: log.customerId,
      details: log.details,
      createdAt: log.createdAt,
    })),
    ...auditLogs.map((log) => ({
      id: log.id,
      source: "Audit",
      type: `${log.action} ${log.entity}`,
      title: `${log.action} ${log.entity}`,
      user: log.user ? `${log.user.firstName} ${log.user.lastName}` : "System",
      customer: "-",
      related: log.entityId,
      relatedModel: log.entity,
      quotationId: log.entity === "Quotation" ? log.entityId : null,
      customerId: log.entity === "Customer" ? log.entityId : null,
      details: log.changes,
      createdAt: log.createdAt,
    })),
  ]
    .filter((log) => sourceFilter === "ALL" || log.source === sourceFilter)
    .filter((log) => !typeFilter || log.type.toLowerCase().includes(typeFilter))
    .filter((log) => {
      if (!q) return true
      const haystack = [log.type, log.title, log.user, log.customer, log.related, log.details || ""].join(" ").toLowerCase()
      return haystack.includes(q)
    })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

  const exportRows = combined.map((log) => ({
    time: log.createdAt.toISOString(),
    source: log.source,
    type: log.type,
    user: log.user,
    customer: log.customer,
    related: log.related,
    details: log.details || log.title,
  }))

  const activityCount = combined.filter((log) => log.source === "Activity").length
  const auditCount = combined.filter((log) => log.source === "Audit").length

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Activity Logs</h1>
          <p className="mt-1 text-sm text-muted-foreground">Monitor user actions, customer activity, quotation changes, payments, receipts, follow-ups, and audit events.</p>
        </div>
        <ExportXlsxButton rows={exportRows} filename={`activity-logs-${new Date().toISOString()}`} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Activity className="h-4 w-4 text-red-600" />Activity Events</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{activityCount}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><ShieldCheck className="h-4 w-4 text-blue-600" />Audit Events</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{auditCount}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Total Monitored</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{combined.length}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Search by user, customer, action, related record, or details.</CardDescription>
        </CardHeader>
        <CardContent>
          <form method="get" className="grid gap-3 lg:grid-cols-6">
            <input name="q" defaultValue={params?.q || ""} placeholder="Search logs..." className="h-10 rounded-lg border border-input bg-card px-3 text-sm lg:col-span-2" />
            <select name="source" defaultValue={sourceFilter} className="h-10 rounded-lg border border-input bg-card px-3 text-sm">
              <option value="ALL">All sources</option>
              <option value="Activity">Activity</option>
              <option value="Audit">Audit</option>
            </select>
            <input name="type" defaultValue={params?.type || ""} placeholder="Type/action" className="h-10 rounded-lg border border-input bg-card px-3 text-sm" />
            <input type="date" name="from" defaultValue={params?.from || ""} className="h-10 rounded-lg border border-input bg-card px-3 text-sm" />
            <input type="date" name="to" defaultValue={params?.to || ""} className="h-10 rounded-lg border border-input bg-card px-3 text-sm" />
            <button type="submit" className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground lg:col-span-6 xl:col-span-1">Apply</button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>System Monitoring Stream</CardTitle>
          <CardDescription>Latest events across everyone using this company workspace.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Related</th>
                <th className="px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody>
              {combined.map((log) => {
                const href = relatedHref(log)
                return (
                  <tr key={`${log.source}-${log.id}`} className="border-b hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3">{formatDateTime(log.createdAt)}</td>
                    <td className="px-4 py-3"><Badge variant={log.source === "Audit" ? "secondary" : "default"}>{log.source}</Badge></td>
                    <td className="px-4 py-3">{log.type}</td>
                    <td className="px-4 py-3">{log.user}</td>
                    <td className="px-4 py-3">{log.customer}</td>
                    <td className="px-4 py-3">
                      {href ? <Link href={href} className="font-medium text-blue-600 hover:underline">{log.related}</Link> : log.related}
                    </td>
                    <td className="max-w-md truncate px-4 py-3 text-muted-foreground">{log.details || log.title}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
