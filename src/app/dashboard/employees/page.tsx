import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatCurrency, generateEmployeeId } from "@/lib/utils"
import { UserCog } from "lucide-react"
import { isCompanyAdminRole } from "@/lib/tenant"

async function createEmployee(formData: FormData) {
  "use server"

  const session = await getServerSession(authOptions)
  if (!session || !isCompanyAdminRole((session.user as any).role)) redirect("/dashboard")

  const userId = String(formData.get("userId") || "")
  const department = String(formData.get("department") || "")
  const position = String(formData.get("position") || "")
  const quotaTarget = Number(formData.get("quotaTarget") || 0)

  if (!userId) return

  const existing = await prisma.employee.findUnique({ where: { userId } })
  if (existing) return

  const count = await prisma.employee.count()
  const employee = await prisma.employee.create({
    data: {
      userId,
      employeeId: generateEmployeeId(count + 1),
      department: department || null,
      position: position || null,
      quotaTarget: quotaTarget > 0 ? quotaTarget : null,
      status: "ACTIVE",
    },
  })

  await prisma.user.update({
    where: { id: userId },
    data: { role: "EMPLOYEE" },
  })

  await prisma.auditLog.create({
    data: {
      userId: (session.user as any).id,
      action: "CREATE",
      entity: "Employee",
      entityId: employee.id,
      changes: JSON.stringify({ userId, employeeId: employee.employeeId, department, position }),
    },
  })

  revalidatePath("/dashboard/employees")
}

export default async function EmployeesPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/dashboard")
  if (!isCompanyAdminRole((session.user as any).role)) redirect("/dashboard")

  const [employees, eligibleUsers] = await Promise.all([
    prisma.employee.findMany({
      orderBy: { employeeId: "asc" },
      include: {
        user: true,
        quotations: {
          include: {
            payments: {
              where: { status: { in: ["PARTIAL", "COMPLETED"] } },
            },
          },
        },
        followUps: true,
      },
    }),
    prisma.user.findMany({
      where: {
        role: { in: ["CUSTOMER", "EMPLOYEE"] },
        employee: null,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ])

  const rows = employees.map((employee) => {
    const assignedValue = employee.quotations.reduce((sum, quotation) => sum + Number(quotation.total), 0)
    const collected = employee.quotations.reduce(
      (sum, quotation) => sum + quotation.payments.reduce((paymentSum, payment) => paymentSum + Number(payment.amount), 0),
      0
    )
    const pendingFollowUps = employee.followUps.filter((followUp) => followUp.status === "PENDING").length

    return { employee, assignedValue, collected, pendingFollowUps }
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Employees</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage employee records, assignments, quotas, and follow-up workload.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add Employee</CardTitle>
          <CardDescription>Convert an existing account into an employee profile.</CardDescription>
        </CardHeader>
        <CardContent>
          {eligibleUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No eligible user accounts are available.</p>
          ) : (
            <form action={createEmployee} className="grid gap-4 lg:grid-cols-[1.2fr_1fr_1fr_1fr_auto] lg:items-end">
              <div>
                <Label htmlFor="userId">User</Label>
                <select id="userId" name="userId" className="mt-2 w-full rounded border p-2">
                  {eligibleUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.firstName} {user.lastName} - {user.email}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="department">Department</Label>
                <Input id="department" name="department" placeholder="Sales" />
              </div>
              <div>
                <Label htmlFor="position">Position</Label>
                <Input id="position" name="position" placeholder="Sales Rep" />
              </div>
              <div>
                <Label htmlFor="quotaTarget">Quota Target</Label>
                <Input id="quotaTarget" name="quotaTarget" type="number" min="0" step="0.01" />
              </div>
              <Button type="submit">Add</Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Employee Performance</CardTitle>
          <CardDescription>Assignment value, collections, and pending follow-ups.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {rows.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <UserCog className="mx-auto mb-4 h-12 w-12 opacity-50" />
              <p>No employees yet.</p>
            </div>
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Assigned Quotes</th>
                  <th className="px-4 py-3">Assigned Value</th>
                  <th className="px-4 py-3">Collected</th>
                  <th className="px-4 py-3">Quota</th>
                  <th className="px-4 py-3">Pending Follow-Ups</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ employee, assignedValue, collected, pendingFollowUps }) => (
                  <tr key={employee.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-medium">{employee.user.firstName} {employee.user.lastName}</div>
                      <div className="text-xs text-slate-500">{employee.employeeId} - {employee.user.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div>{employee.position || "-"}</div>
                      <div className="text-xs text-slate-500">{employee.department || ""}</div>
                    </td>
                    <td className="px-4 py-3">{employee.quotations.length}</td>
                    <td className="px-4 py-3">{formatCurrency(assignedValue)}</td>
                    <td className="px-4 py-3">{formatCurrency(collected)}</td>
                    <td className="px-4 py-3">{employee.quotaTarget ? formatCurrency(employee.quotaTarget) : "-"}</td>
                    <td className="px-4 py-3">{pendingFollowUps}</td>
                    <td className="px-4 py-3">
                      <Badge variant={employee.status === "ACTIVE" ? "success" : "warning"}>{employee.status}</Badge>
                    </td>
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
