import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency, formatDateTime } from "@/lib/utils"
import { Receipt } from "lucide-react"
import DownloadReceiptPdf from "@/components/quotations/DownloadReceiptPdf"

export default async function ReceiptsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/dashboard")

  const role = (session.user as any).role
  const where: any = {}
  if (role === "CUSTOMER") {
    const customer = await prisma.customer.findUnique({ where: { userId: session.user.id } })
    if (!customer) return <div className="text-center py-12">Customer profile not found</div>
    where.customerId = customer.id
  }

  const receipts = await prisma.receipt.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      quotation: true,
      customer: true,
      generatedBy: true,
    },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Receipts</h1>
        <p className="text-sm text-muted-foreground mt-1">View generated receipts and confirmation history.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Receipt Log</CardTitle>
          <CardDescription>Latest receipts generated for payments.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {receipts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Receipt className="mx-auto mb-4 h-12 w-12 opacity-50" />
              <p>No receipts have been generated yet.</p>
            </div>
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="px-4 py-3">Receipt#</th>
                  <th className="px-4 py-3">Quotation</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {receipts.map((receipt) => (
                  <tr key={receipt.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3">{receipt.receiptNumber}</td>
                    <td className="px-4 py-3">{receipt.quotation?.quotationNumber || "—"}</td>
                    <td className="px-4 py-3">{receipt.customer?.companyName || receipt.customer?.contactPerson || "Customer"}</td>
                    <td className="px-4 py-3">{formatCurrency(receipt.amount)}</td>
                    <td className="px-4 py-3">{receipt.paymentMethod}</td>
                    <td className="px-4 py-3">{formatDateTime(receipt.createdAt)}</td>
                    <td className="px-4 py-3">
                      <DownloadReceiptPdf receiptId={receipt.id} />
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
