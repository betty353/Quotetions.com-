import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { Activity, ShieldCheck } from "lucide-react"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isCompanyAdminRole } from "@/lib/tenant"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatDateTime } from "@/lib/utils"

export default async function ActivityLogsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/dashboard")

  const role = (session.user as any).role
  if (!isCompanyAdminRole(role)) redirect("/dashboard")

  const companyId = (session.user as any).companyId as string | null
  if (!companyId) redirect("/dashboard")

  const [activityLogs, auditLogs] = await Promise.all([
    prisma.activityLog.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: 150,
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
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: 150,
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
      details: log.changes,
      createdAt: log.createdAt,
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Activity Logs</h1>
        <p className="mt-1 text-sm text-muted-foreground">Monitor user actions, customer activity, quotation changes, payments, receipts, follow-ups, and audit events.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Activity className="h-4 w-4 text-red-600" />Activity Events</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{activityLogs.length}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><ShieldCheck className="h-4 w-4 text-blue-600" />Audit Events</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{auditLogs.length}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Total Monitored</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{combined.length}</div></CardContent></Card>
      </div>

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
              {combined.map((log) => (
                <tr key={`${log.source}-${log.id}`} className="border-b hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3">{formatDateTime(log.createdAt)}</td>
                  <td className="px-4 py-3"><Badge variant={log.source === "Audit" ? "secondary" : "default"}>{log.source}</Badge></td>
                  <td className="px-4 py-3">{log.type}</td>
                  <td className="px-4 py-3">{log.user}</td>
                  <td className="px-4 py-3">{log.customer}</td>
                  <td className="px-4 py-3">{log.related}</td>
                  <td className="max-w-md truncate px-4 py-3 text-muted-foreground">{log.details || log.title}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
