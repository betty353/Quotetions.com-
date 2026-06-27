import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import bcrypt from "bcryptjs"
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

  const companyId = (session.user as any).companyId as string | null
  if (!companyId) redirect("/dashboard")

  const firstName = String(formData.get("firstName") || "").trim()
  const lastName = String(formData.get("lastName") || "").trim()
  const email = String(formData.get("email") || "").trim().toLowerCase()
  const phone = String(formData.get("phone") || "").trim()
  const password = String(formData.get("password") || "")
  const department = String(formData.get("department") || "").trim()
  const position = String(formData.get("position") || "").trim()
  const quotaTarget = Number(formData.get("quotaTarget") || 0)

  if (!firstName || !lastName || !email || password.length < 8) redirect("/dashboard/employees?error=missing-worker-fields")

  const existingUser = await prisma.user.findUnique({ where: { email }, include: { employee: true } })
  if (existingUser?.employee) redirect("/dashboard/employees?error=worker-exists")
  if (existingUser && existingUser.companyId && existingUser.companyId !== companyId) redirect("/dashboard/employees?error=email-in-use")

  const count = await prisma.employee.count()
  const passwordHash = await bcrypt.hash(password, 12)

  const employee = await prisma.$transaction(async (tx) => {
    const user = existingUser
      ? await tx.user.update({
          where: { id: existingUser.id },
          data: {
            companyId,
            firstName,
            lastName,
            phone: phone || null,
            role: "EMPLOYEE",
            isActive: true,
          },
        })
      : await tx.user.create({
          data: {
            companyId,
            email,
            password: passwordHash,
            firstName,
            lastName,
            phone: phone || null,
            role: "EMPLOYEE",
            isActive: true,
          },
        })

    return tx.employee.create({
      data: {
        userId: user.id,
        companyId,
        employeeId: generateEmployeeId(count + 1),
        department: department || null,
        position: position || null,
        phone: phone || null,
        quotaTarget: quotaTarget > 0 ? quotaTarget : null,
        status: "ACTIVE",
      },
    })
  })

  await prisma.auditLog.create({
    data: {
      companyId,
      userId: (session.user as any).id,
      action: "CREATE",
      entity: "Employee",
      entityId: employee.id,
      changes: JSON.stringify({ employeeId: employee.employeeId, email, department, position }),
    },
  })

  revalidatePath("/dashboard/employees")
  redirect("/dashboard/employees?created=1")
}

export default async function EmployeesPage({ searchParams }: { searchParams?: Promise<{ created?: string; error?: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/dashboard")
  if (!isCompanyAdminRole((session.user as any).role)) redirect("/dashboard")
  const params = await searchParams
  const companyId = (session.user as any).companyId as string | null
  if (!companyId) redirect("/dashboard")

  const employees = await prisma.employee.findMany({
      where: { companyId },
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
    })

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
          <CardTitle>Add Worker</CardTitle>
          <CardDescription>Create a staff account and assign the worker to a department.</CardDescription>
        </CardHeader>
        <CardContent>
          {params?.created && <p className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">Worker added successfully.</p>}
          {params?.error && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">Could not add worker. Check the email, password, and required fields.</p>}
          <form action={createEmployee} className="grid gap-4 lg:grid-cols-3">
            <div>
              <Label htmlFor="firstName">First Name</Label>
              <Input id="firstName" name="firstName" required placeholder="Emmanuel" />
            </div>
            <div>
              <Label htmlFor="lastName">Last Name</Label>
              <Input id="lastName" name="lastName" required placeholder="Inambao" />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required placeholder="worker@company.com" />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" placeholder="0770000000" />
            </div>
            <div>
              <Label htmlFor="password">Temporary Password</Label>
              <Input id="password" name="password" type="password" minLength={8} required />
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
            <div className="flex items-end">
              <Button type="submit" className="w-full">Add Worker</Button>
            </div>
          </form>
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
