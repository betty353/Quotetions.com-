import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"
import { ReconciliationExportActions, ReconciliationPaymentActions } from "@/components/payments/ReconciliationActions"

export default async function ReconciliationPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/dashboard')

  const quotations = await prisma.quotation.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      customer: true,
      payments: {
        where: { status: { in: ["PARTIAL", "COMPLETED"] } },
      },
    },
    take: 200,
  })

  const rows = quotations.map((q) => {
    const paid = q.payments.reduce((s, p) => s + Number(p.amount), 0)
    const total = Number(q.total)
    const outstanding = Math.max(0, total - paid)
    return { id: q.id, number: q.quotationNumber, customer: q.customer, total, paid, outstanding, status: q.status }
  })

  const totals = rows.reduce((acc, r) => ({ total: acc.total + r.total, paid: acc.paid + r.paid, outstanding: acc.outstanding + r.outstanding }), { total: 0, paid: 0, outstanding: 0 })
  const exportRows = rows.map((r) => ({
    quotationId: r.id,
    quotationNumber: r.number,
    customer: r.customer?.companyName || r.customer?.contactPerson || "",
    total: r.total,
    paid: r.paid,
    outstanding: r.outstanding,
    status: r.status,
  }))
  const exportFilename = `reconciliation-${new Date().toISOString()}`

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Reconciliation</h1>
        <p className="text-sm text-muted-foreground mt-1">View outstanding balances and quickly record payments.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Outstanding Quotations</CardTitle>
          <CardDescription>Shows quotations with outstanding balances.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <ReconciliationExportActions rows={exportRows} filename={exportFilename} />

          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-4 py-3">Quotation#</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Paid</th>
                <th className="px-4 py-3">Outstanding</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3"><Link href={`/dashboard/quotations/${r.id}`} className="text-foreground underline-offset-4 hover:underline">{r.number}</Link></td>
                  <td className="px-4 py-3">{r.customer?.companyName || r.customer?.contactPerson || 'Customer'}</td>
                  <td className="px-4 py-3">{formatCurrency(r.total)}</td>
                  <td className="px-4 py-3">{formatCurrency(r.paid)}</td>
                  <td className="px-4 py-3">{formatCurrency(r.outstanding)}</td>
                  <td className="px-4 py-3">{r.status}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <ReconciliationPaymentActions quotationId={r.id} outstanding={r.outstanding} />
                      <Link href={`/dashboard/quotations/${r.id}`} className="text-sm text-foreground underline-offset-4 hover:underline">View</Link>
                    </div>
                  </td>
                </tr>
              ))}
              {/* Totals row */}
              <tr className="bg-slate-50 font-semibold">
                <td className="px-4 py-3">Totals</td>
                <td className="px-4 py-3"></td>
                <td className="px-4 py-3">{formatCurrency(totals.total)}</td>
                <td className="px-4 py-3">{formatCurrency(totals.paid)}</td>
                <td className="px-4 py-3">{formatCurrency(totals.outstanding)}</td>
                <td className="px-4 py-3"></td>
                <td className="px-4 py-3"></td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
