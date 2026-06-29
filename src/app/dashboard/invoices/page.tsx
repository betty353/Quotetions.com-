import Link from "next/link"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { FileText } from "lucide-react"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatCurrency, formatDate } from "@/lib/utils"
import DownloadQuotationPdf from "@/components/quotations/DownloadQuotationPdf"

export default async function InvoicesPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/dashboard")

  const role = (session.user as any).role
  const companyId = (session.user as any).companyId as string | null

  const where: any = {}
  if (role === "CUSTOMER") {
    const customer = await prisma.customer.findUnique({ where: { userId: session.user.id } })
    if (!customer) redirect("/dashboard")
    where.customerId = customer.id
  } else if (companyId) {
    where.companyId = companyId
  } else {
    redirect("/dashboard")
  }

  const invoices = await prisma.quotation.findMany({
    where,
    include: {
      customer: { include: { user: true } },
      payments: { where: { status: { in: ["PARTIAL", "COMPLETED"] } } },
      receipts: true,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  })

  const rows = invoices.map((invoice) => {
    const paid = invoice.payments.reduce((sum, payment) => sum + Number(payment.amount), 0)
    return { invoice, paid, outstanding: Math.max(0, Number(invoice.total) - paid) }
  })
  const total = rows.reduce((sum, row) => sum + Number(row.invoice.total), 0)
  const paid = rows.reduce((sum, row) => sum + row.paid, 0)
  const outstanding = rows.reduce((sum, row) => sum + row.outstanding, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Invoices</h1>
        <p className="mt-1 text-sm text-muted-foreground">Quotation-based invoices, payment status, outstanding balances, and invoice PDF downloads.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Invoice Value</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(total)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Paid</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(paid)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Outstanding</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(outstanding)}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invoice Register</CardTitle>
          <CardDescription>Open any invoice to take payment, generate receipts, or download documents.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {rows.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <FileText className="mx-auto mb-4 h-12 w-12 opacity-50" />
              <p>No invoices yet.</p>
            </div>
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead className="border-b text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Invoice</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Paid</th>
                  <th className="px-4 py-3">Outstanding</th>
                  <th className="px-4 py-3">Receipts</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ invoice, paid, outstanding }) => (
                  <tr key={invoice.id} className="border-b hover:bg-slate-50">
                    <td className="px-4 py-3"><Link href={`/dashboard/quotations/${invoice.id}`} className="font-medium text-blue-600 hover:underline">{invoice.quotationNumber}</Link></td>
                    <td className="px-4 py-3">{invoice.customer?.companyName || invoice.customer?.contactPerson || invoice.customer?.user.email || "Customer"}</td>
                    <td className="px-4 py-3"><Badge variant={outstanding <= 0 ? "success" : invoice.paymentStatus === "PARTIAL" ? "warning" : "default"}>{outstanding <= 0 ? "PAID" : invoice.paymentStatus}</Badge></td>
                    <td className="px-4 py-3">{formatCurrency(invoice.total, invoice.currency)}</td>
                    <td className="px-4 py-3">{formatCurrency(paid, invoice.currency)}</td>
                    <td className="px-4 py-3">{formatCurrency(outstanding, invoice.currency)}</td>
                    <td className="px-4 py-3">{invoice.receipts.length}</td>
                    <td className="px-4 py-3">{formatDate(invoice.createdAt)}</td>
                    <td className="px-4 py-3"><DownloadQuotationPdf quotationId={invoice.id} /></td>
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
