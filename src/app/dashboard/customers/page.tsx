import Link from "next/link"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"
import { ArrowRight, Users } from "lucide-react"
import { isCompanyAdminRole } from "@/lib/tenant"
import CreateCustomerForm from "@/components/customers/CreateCustomerForm"

export default async function CustomersPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/dashboard")

  const role = (session.user as any).role
  if (!isCompanyAdminRole(role) && role !== "EMPLOYEE") redirect("/dashboard")
  const companyId = (session.user as any).companyId as string | null
  if (!companyId) redirect("/dashboard")

  const customers = await prisma.customer.findMany({
    where: { companyId },
    orderBy: { updatedAt: "desc" },
    include: {
      user: true,
      quotations: {
        include: {
          payments: {
            where: { status: { in: ["PARTIAL", "COMPLETED"] } },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  })

  const rows = customers.map((customer) => {
    const quoted = customer.quotations.reduce((sum, quotation) => sum + Number(quotation.total), 0)
    const paid = customer.quotations.reduce(
      (sum, quotation) => sum + quotation.payments.reduce((paymentSum, payment) => paymentSum + Number(payment.amount), 0),
      0
    )
    const latestQuotation = customer.quotations[0]

    return {
      customer,
      quoted,
      paid,
      outstanding: Math.max(0, quoted - paid),
      quotationCount: customer.quotations.length,
      latestQuotation,
    }
  })

  const totals = rows.reduce(
    (acc, row) => ({
      customers: acc.customers + 1,
      quoted: acc.quoted + row.quoted,
      paid: acc.paid + row.paid,
      outstanding: acc.outstanding + row.outstanding,
    }),
    { customers: 0, quoted: 0, paid: 0, outstanding: 0 }
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Customers</h1>
        <p className="text-sm text-muted-foreground mt-1">Customer accounts, balances, and recent quotation activity.</p>
      </div>

      <CreateCustomerForm />

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Customers</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{totals.customers}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Quoted</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatCurrency(totals.quoted)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Paid</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatCurrency(totals.paid)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Outstanding</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatCurrency(totals.outstanding)}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Customer Ledger</CardTitle>
          <CardDescription>Clean customer list with financial position. Open a customer to view contact details, follow-ups, and activity.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {rows.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="mx-auto mb-4 h-12 w-12 opacity-50" />
              <p>No customers yet.</p>
            </div>
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Quotations</th>
                  <th className="px-4 py-3">Quoted</th>
                  <th className="px-4 py-3">Paid</th>
                  <th className="px-4 py-3">Outstanding</th>
                  <th className="px-4 py-3">Last Quotation</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Open</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ customer, quotationCount, quoted, paid, outstanding, latestQuotation }) => (
                  <tr key={customer.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/customers/${customer.id}`} className="font-medium text-foreground underline-offset-4 hover:underline">
                        {customer.companyName || customer.contactPerson || `${customer.user.firstName} ${customer.user.lastName}`}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{quotationCount}</td>
                    <td className="px-4 py-3">{formatCurrency(quoted)}</td>
                    <td className="px-4 py-3">{formatCurrency(paid)}</td>
                    <td className="px-4 py-3">{formatCurrency(outstanding)}</td>
                    <td className="px-4 py-3">
                      {latestQuotation ? (
                        <Link href={`/dashboard/quotations/${latestQuotation.id}`} className="text-blue-600 hover:underline">
                          {latestQuotation.quotationNumber}
                        </Link>
                      ) : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={customer.status === "ACTIVE" ? "success" : "warning"}>{customer.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/dashboard/customers/${customer.id}`} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-input bg-card px-3 text-xs font-medium transition-all hover:-translate-y-px hover:bg-accent">
                        Open <ArrowRight className="h-4 w-4" />
                      </Link>
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
