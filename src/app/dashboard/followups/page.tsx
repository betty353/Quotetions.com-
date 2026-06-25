import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/utils"
import { CalendarCheck } from "lucide-react"

export default async function FollowupsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/dashboard')

  const role = (session.user as any).role
  const where: any = {}
  if (role === 'EMPLOYEE') {
    const employee = await prisma.employee.findUnique({ where: { userId: session.user.id } })
    if (employee) where.employeeId = employee.id
  }
  if (role === 'CUSTOMER') {
    const customer = await prisma.customer.findUnique({ where: { userId: session.user.id } })
    if (customer) where.customerId = customer.id
  }

  const followUps = await prisma.followUp.findMany({
    where,
    orderBy: { reminderDate: 'asc' },
    include: { quotation: true, customer: true, employee: { include: { user: true } }, createdBy: true },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Follow-Ups</h1>
        <p className="text-sm text-muted-foreground mt-1">Track and manage customer follow-up actions and reminders.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Follow-Up List</CardTitle>
          <CardDescription>Upcoming reminders and assigned actions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {followUps.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CalendarCheck className="mx-auto mb-4 h-12 w-12 opacity-50" />
              <p>No follow-ups scheduled.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {followUps.map((f) => (
                <div key={f.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">{f.type} — {f.quotation?.quotationNumber || 'No Quotation'}</p>
                      <p className="text-xs text-slate-600">Customer: {f.customer?.companyName || f.customer?.contactPerson || 'Customer'}</p>
                    </div>
                    <div className="text-right">
                      <Badge variant={f.status === 'COMPLETED' ? 'success' : f.status === 'CANCELLED' ? 'destructive' : 'default'}>{f.status}</Badge>
                      <p className="text-xs text-slate-500 mt-1">Next: {f.nextFollowUpDate ? formatDate(f.nextFollowUpDate) : 'N/A'}</p>
                    </div>
                  </div>
                  {f.feedback && <p className="mt-3 text-sm">{f.feedback}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
