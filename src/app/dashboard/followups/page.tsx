import Link from "next/link"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import type { ReactNode } from "react"
import { CalendarCheck, Clock, MapPin, Pin } from "lucide-react"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isCompanyAdminRole } from "@/lib/tenant"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatDate, formatDateTime } from "@/lib/utils"
import FollowUpActions from "@/components/followups/FollowUpActions"

function startOfDay(date: Date) {
  const value = new Date(date)
  value.setHours(0, 0, 0, 0)
  return value
}

function dateKey(date: Date | string | null) {
  if (!date) return "unscheduled"
  return new Date(date).toISOString().slice(0, 10)
}

function monthDays(anchor = new Date()) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)
  const days: Date[] = []
  for (let day = 1; day <= last.getDate(); day += 1) {
    days.push(new Date(anchor.getFullYear(), anchor.getMonth(), day))
  }
  const padding = first.getDay()
  return { days, padding, label: anchor.toLocaleDateString("en-US", { month: "long", year: "numeric" }) }
}

export default async function FollowupsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/dashboard")

  const role = (session.user as any).role
  const companyId = (session.user as any).companyId as string | null
  const where: any = {}

  if (isCompanyAdminRole(role)) {
    if (!companyId) redirect("/dashboard")
    where.companyId = companyId
  } else if (role === "EMPLOYEE") {
    const employee = await prisma.employee.findUnique({ where: { userId: session.user.id } })
    if (employee) where.employeeId = employee.id
    else where.employeeId = "__none__"
  } else if (role === "CUSTOMER") {
    const customer = await prisma.customer.findUnique({ where: { userId: session.user.id } })
    if (customer) where.customerId = customer.id
    else where.customerId = "__none__"
  }

  const followUps = await prisma.followUp.findMany({
    where,
    orderBy: [{ reminderDate: "asc" }, { nextFollowUpDate: "asc" }, { createdAt: "desc" }],
    include: {
      quotation: true,
      customer: { include: { user: true } },
      employee: { include: { user: true } },
      createdBy: true,
    },
  })

  const today = startOfDay(new Date())
  const due = followUps.filter((followUp) => followUp.status === "PENDING" && followUp.reminderDate && new Date(followUp.reminderDate) <= new Date())
  const upcoming = followUps.filter((followUp) => followUp.status === "PENDING" && followUp.nextFollowUpDate && new Date(followUp.nextFollowUpDate) >= today)
  const { days, padding, label } = monthDays()
  const byDay = new Map<string, typeof followUps>()
  for (const followUp of followUps) {
    const key = dateKey(followUp.nextFollowUpDate || followUp.reminderDate)
    byDay.set(key, [...(byDay.get(key) || []), followUp])
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Follow-Ups</h1>
          <p className="mt-1 text-sm text-muted-foreground">Calendar reminders, customer pins, and assigned follow-up actions.</p>
        </div>
        <Badge variant={due.length > 0 ? "destructive" : "success"}>{due.length} due reminder{due.length === 1 ? "" : "s"}</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Metric title="Due Now" value={String(due.length)} icon={<Clock className="h-5 w-5 text-red-600" />} />
        <Metric title="Upcoming" value={String(upcoming.length)} icon={<CalendarCheck className="h-5 w-5 text-blue-600" />} />
        <Metric title="Total Follow-Ups" value={String(followUps.length)} icon={<Pin className="h-5 w-5 text-amber-600" />} />
      </div>

      {due.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle>Reminder Alerts</CardTitle>
            <CardDescription>These follow-ups are due now. They also appear as pop-up notifications in the dashboard.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {due.map((followUp) => (
              <FollowUpCard key={followUp.id} followUp={followUp} urgent canManage={role !== "CUSTOMER"} />
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{label} Calendar</CardTitle>
          <CardDescription>Customer follow-ups pinned to their scheduled day.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-muted-foreground">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <div key={day}>{day}</div>)}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-2">
            {Array.from({ length: padding }).map((_, index) => <div key={`pad-${index}`} className="min-h-28 rounded-xl border border-dashed bg-slate-50" />)}
            {days.map((day) => {
              const items = byDay.get(dateKey(day)) || []
              const isToday = dateKey(day) === dateKey(today)
              return (
                <div key={day.toISOString()} className={`min-h-28 rounded-xl border bg-white p-2 ${isToday ? "border-blue-400 ring-2 ring-blue-100" : "border-slate-200"}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{day.getDate()}</span>
                    {items.length > 0 && <MapPin className="h-4 w-4 text-amber-600" />}
                  </div>
                  <div className="mt-2 space-y-1">
                    {items.slice(0, 3).map((followUp) => (
                      <Link key={followUp.id} href={`/dashboard/quotations/${followUp.quotationId}`} className="block truncate rounded-md bg-amber-50 px-2 py-1 text-left text-[11px] text-amber-900 hover:bg-amber-100">
                        {followUp.customer?.companyName || followUp.customer?.contactPerson || followUp.customer?.user.email || "Customer"}
                      </Link>
                    ))}
                    {items.length > 3 && <p className="text-[11px] text-muted-foreground">+{items.length - 3} more</p>}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Follow-Up List</CardTitle>
          <CardDescription>Upcoming reminders and assigned actions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {followUps.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <CalendarCheck className="mx-auto mb-4 h-12 w-12 opacity-50" />
              <p>No follow-ups scheduled.</p>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {followUps.map((followUp) => (
                <FollowUpCard key={followUp.id} followUp={followUp} canManage={role !== "CUSTOMER"} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Metric({ title, value, icon }: { title: string; value: string; icon: ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm">{icon}{title}</CardTitle></CardHeader>
      <CardContent><div className="text-2xl font-bold">{value}</div></CardContent>
    </Card>
  )
}

function FollowUpCard({ followUp, urgent = false, canManage = false }: { followUp: any; urgent?: boolean; canManage?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${urgent ? "border-red-200 bg-white" : "border-slate-200 bg-slate-50"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{followUp.type} - {followUp.quotation?.quotationNumber || "No quotation"}</p>
          <p className="text-xs text-slate-600">Customer: {followUp.customer?.companyName || followUp.customer?.contactPerson || followUp.customer?.user.email || "Customer"}</p>
          <p className="text-xs text-slate-600">Assigned: {followUp.employee?.user ? `${followUp.employee.user.firstName} ${followUp.employee.user.lastName}` : "Unassigned"}</p>
        </div>
        <Badge variant={followUp.status === "COMPLETED" ? "success" : followUp.status === "CANCELLED" ? "destructive" : urgent ? "destructive" : "default"}>{followUp.status}</Badge>
      </div>
      <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
        <p>Next: {followUp.nextFollowUpDate ? formatDate(followUp.nextFollowUpDate) : "N/A"}</p>
        <p>Reminder: {followUp.reminderDate ? formatDateTime(followUp.reminderDate) : "N/A"}</p>
      </div>
      {(followUp.feedback || followUp.callNotes || followUp.meetingNotes) && (
        <p className="mt-3 text-sm text-slate-700">{followUp.feedback || followUp.callNotes || followUp.meetingNotes}</p>
      )}
      <Link href={`/dashboard/quotations/${followUp.quotationId}`} className="mt-3 inline-flex text-sm font-medium text-blue-600 hover:underline">
        Open quotation
      </Link>
      {canManage && <FollowUpActions followUpId={followUp.id} disabled={followUp.status === "COMPLETED" || followUp.status === "CANCELLED"} />}
    </div>
  )
}
