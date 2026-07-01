import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MessageCircle } from "lucide-react"
import PaymentForm from "@/components/quotations/PaymentForm"
import ReceiptForm from "@/components/quotations/ReceiptForm"
import FollowUpForm from "@/components/quotations/FollowUpForm"
import QuotationStatusForm from "@/components/quotations/QuotationStatusForm"
import DownloadQuotationPdf from "@/components/quotations/DownloadQuotationPdf"
import DownloadReceiptPdf from "@/components/quotations/DownloadReceiptPdf"
import ReconcileButton from "@/components/payments/ReconcileButton"
import DpoPayButton from "@/components/payments/DpoPayButton"
import CustomerQuotationActions from "@/components/quotations/CustomerQuotationActions"

interface QuotationPageProps {
  params: Promise<{ id: string }>
}

export default async function QuotationDetailPage({ params }: QuotationPageProps) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) redirect("/dashboard")

  const quotation = await prisma.quotation.findUnique({
    where: { id },
    include: {
      customer: { include: { user: true } },
      createdBy: true,
      assignedEmployee: { include: { user: true } },
      items: { include: { product: true } },
      payments: true,
      receipts: true,
      followUps: true,
    },
  })

  if (!quotation) {
    return <div className="text-center py-12">Quotation not found</div>
  }

  const role = (session.user as any).role
  const companyId = (session.user as any).companyId as string | null
  if (role === "CUSTOMER") {
    const customer = await prisma.customer.findUnique({ where: { userId: session.user.id } })
    if (!customer || customer.id !== quotation.customerId) {
      redirect("/dashboard")
    }
  } else if (companyId && quotation.companyId !== companyId) {
    redirect("/dashboard")
  }

  const employees = role === "CUSTOMER" ? [] : await prisma.employee.findMany({
    where: companyId ? { companyId } : {},
    orderBy: { employeeId: "asc" },
    include: { user: true },
  })
  const paymentSetup = await prisma.companySetting.findFirst({
    where: quotation.companyId ? { companyId: quotation.companyId } : {},
    select: {
      paymentSetupComplete: true,
      paymentEnabled: true,
    },
  })
  const canUseOnlinePayments = Boolean(paymentSetup?.paymentSetupComplete && paymentSetup.paymentEnabled)
  const isPaid = quotation.paymentStatus === "COMPLETED" || quotation.status === "COMPLETED"
  const customerCanPay = role !== "CUSTOMER" || quotation.status === "APPROVED"
  const paidReceipt = quotation.receipts.find((receipt) => receipt.receiptNumber === quotation.receiptNumber) || quotation.receipts[0]
  const confirmedPaid = quotation.payments
    .filter((payment) => payment.status === "PARTIAL" || payment.status === "COMPLETED")
    .reduce((sum, payment) => sum + Number(payment.amount), 0)
  const receipted = quotation.receipts.reduce((sum, receipt) => sum + Number(receipt.amount), 0)
  const outstanding = Math.max(0, Number(quotation.total) - confirmedPaid)
  const receiptable = Math.max(0, confirmedPaid - receipted)
  const quotationContactUserId = quotation.assignedEmployee?.userId || quotation.createdById

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">{quotation.quotationNumber}</h1>
          <p className="text-sm text-muted-foreground mt-1">Quotation details, payments, receipts, and follow-up actions.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase text-slate-500">Status</p>
            <Badge className="mt-2" variant={quotation.status === "COMPLETED" ? "success" : quotation.status === "APPROVED" ? "secondary" : quotation.status === "REJECTED" ? "destructive" : "default"}>
              {quotation.status}
            </Badge>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase text-slate-500">Total</p>
            <p className="mt-2 text-xl font-semibold">{formatCurrency(quotation.total)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase text-slate-500">Payment</p>
            <Badge className="mt-2" variant={isPaid ? "success" : quotation.paymentStatus === "FAILED" || quotation.paymentStatus === "CANCELLED" ? "destructive" : "default"}>
              {isPaid ? "PAID" : quotation.paymentStatus}
            </Badge>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase text-slate-500">Customer</p>
            <p className="mt-2 font-medium">{quotation.customer?.companyName || quotation.customer?.contactPerson || "Customer"}</p>
            <p className="text-xs text-slate-500">{quotation.customer?.user.email || ""}</p>
          </div>
          <div className="flex items-center gap-2">
            <DownloadQuotationPdf quotationId={quotation.id} />
          </div>
          {role === "CUSTOMER" && quotationContactUserId && (
            <Link
              href={`/dashboard/chat?recipientId=${quotationContactUserId}`}
              className="inline-flex items-center justify-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm font-semibold text-neutral-900 transition-colors hover:bg-slate-50"
            >
              <MessageCircle className="h-4 w-4 text-blue-600" />
              Message staff
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Quotation Summary</CardTitle>
              <CardDescription>Line items and terms.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Created By</p>
                  <p className="font-medium">{quotation.createdBy ? `${quotation.createdBy.firstName} ${quotation.createdBy.lastName}` : "System"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Created At</p>
                  <p className="font-medium">{formatDateTime(quotation.createdAt)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Valid Until</p>
                  <p className="font-medium">{quotation.validUntil ? formatDate(quotation.validUntil) : "N/A"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Assigned Employee</p>
                  <p className="font-medium">{quotation.assignedEmployee?.user ? `${quotation.assignedEmployee.user.firstName} ${quotation.assignedEmployee.user.lastName}` : "Unassigned"}</p>
                </div>
              </div>

              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Item</th>
                      <th className="px-4 py-3">Qty</th>
                      <th className="px-4 py-3">Unit Price</th>
                      <th className="px-4 py-3">Discount</th>
                      <th className="px-4 py-3">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotation.items.map((item) => (
                      <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-3">{item.product?.name || item.productId}</td>
                        <td className="px-4 py-3">{item.quantity}</td>
                        <td className="px-4 py-3">{formatCurrency(item.unitPrice)}</td>
                        <td className="px-4 py-3">{formatCurrency(item.discount)}</td>
                        <td className="px-4 py-3">{formatCurrency(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {quotation.notes && (
                <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs text-muted-foreground">Notes</p>
                  <p className="mt-2 text-sm">{quotation.notes}</p>
                </div>
              )}
              {quotation.terms && (
                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs text-muted-foreground">Terms</p>
                  <p className="mt-2 text-sm">{quotation.terms}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Payments</CardTitle>
                <CardDescription>Pay online through DPO or record staff-confirmed payments. Receipts are generated automatically for confirmed payments.</CardDescription>
              </CardHeader>
              <CardContent>
                {!isPaid && (
                  <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm text-slate-700">
                      DPO processes the real money and settles funds to your registered merchant bank/mobile money account. This system only records and verifies payment status.
                    </p>
                    <div className="mt-4">
                      <DpoPayButton
                        quotationId={quotation.id}
                        disabled={!canUseOnlinePayments || !customerCanPay}
                        transactionToken={quotation.dpoTransactionToken}
                      />
                    </div>
                    {!canUseOnlinePayments && (
                      <p className="mt-2 text-sm text-amber-700">Online payments are not available until the administrator completes Payment Setup.</p>
                    )}
                    {role === "CUSTOMER" && !customerCanPay && (
                      <p className="mt-2 text-sm text-blue-700">Accept this quotation first to unlock online payment.</p>
                    )}
                  </div>
                )}

                {isPaid && paidReceipt && (
                  <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4">
                    <p className="font-semibold text-green-800">Payment verified</p>
                    <div className="mt-3 grid gap-2 text-sm text-green-900 sm:grid-cols-2">
                      <p>Receipt number: {paidReceipt.receiptNumber}</p>
                      <p>Amount: {formatCurrency(paidReceipt.amount, paidReceipt.currency)}</p>
                      <p>Method: {paidReceipt.paymentMethod}</p>
                      <p>Reference: {paidReceipt.reference || quotation.paymentReference || "-"}</p>
                      <p>Paid date: {quotation.paidAt ? formatDateTime(quotation.paidAt) : formatDateTime(paidReceipt.createdAt)}</p>
                    </div>
                    <div className="mt-4">
                      <DownloadReceiptPdf receiptId={paidReceipt.id} />
                    </div>
                  </div>
                )}

                {role !== "CUSTOMER" && (
                  outstanding > 0 ? (
                    <PaymentForm quotationId={quotation.id} quotationTotal={outstanding} customerId={quotation.customerId} />
                  ) : (
                    <p className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">This quotation has no outstanding balance.</p>
                  )
                )}
                {quotation.payments.length > 0 ? (
                  <div className="mt-6 overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="border-b border-slate-200 text-slate-500">
                        <tr>
                          <th className="px-4 py-3">Payment #</th>
                          <th className="px-4 py-3">Receipt #</th>
                          <th className="px-4 py-3">Amount</th>
                          <th className="px-4 py-3">Provider</th>
                          <th className="px-4 py-3">Reference</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Date</th>
                          {role !== "CUSTOMER" && <th className="px-4 py-3">Action</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {quotation.payments.map((payment) => (
                          <tr key={payment.id} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="px-4 py-3">{payment.paymentNumber}</td>
                            <td className="px-4 py-3">{payment.receiptNumber || "-"}</td>
                            <td className="px-4 py-3">{formatCurrency(payment.amount)}</td>
                            <td className="px-4 py-3">{payment.provider}</td>
                            <td className="px-4 py-3">{payment.reference || "-"}</td>
                            <td className="px-4 py-3">{payment.status}</td>
                            <td className="px-4 py-3">{formatDate(payment.paymentDate)}</td>
                            {role !== "CUSTOMER" && (
                              <td className="px-4 py-3">
                                <ReconcileButton paymentId={payment.id} />
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground mt-4">No payments recorded yet.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Receipts</CardTitle>
                <CardDescription>Confirmed payments now create receipts automatically. Use manual receipt generation only for older payments without receipts.</CardDescription>
              </CardHeader>
              <CardContent>
                {role !== "CUSTOMER" && (
                  receiptable > 0 ? (
                    <ReceiptForm quotationId={quotation.id} quotationTotal={receiptable} customerId={quotation.customerId} />
                  ) : (
                    <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">No confirmed unreceipted payment is available.</p>
                  )
                )}
                {quotation.receipts.length > 0 ? (
                  <div className="mt-6 overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="border-b border-slate-200 text-slate-500">
                        <tr>
                          <th className="px-4 py-3">Receipt#</th>
                          <th className="px-4 py-3">Amount</th>
                          <th className="px-4 py-3">Payment Method</th>
                          <th className="px-4 py-3">Created</th>
                        </tr>
                      </thead>
                      <tbody>
                        {quotation.receipts.map((receipt) => (
                            <tr key={receipt.id} className="border-b border-slate-100 hover:bg-slate-50">
                              <td className="px-4 py-3">{receipt.receiptNumber}</td>
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
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground mt-4">No receipts generated yet.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="space-y-6">
          {role !== "CUSTOMER" && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Update Status</CardTitle>
                  <CardDescription>Change quotation workflow state.</CardDescription>
                </CardHeader>
                <CardContent>
                  <QuotationStatusForm quotationId={quotation.id} currentStatus={quotation.status} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Follow Ups</CardTitle>
                  <CardDescription>Track follow-up actions for this customer.</CardDescription>
                </CardHeader>
                <CardContent>
                  <FollowUpForm
                    quotationId={quotation.id}
                    customerId={quotation.customerId}
                    employees={employees.map((employee) => ({
                      id: employee.id,
                      user: { name: `${employee.user.firstName} ${employee.user.lastName}` },
                    }))}
                  />
                  {quotation.followUps.length > 0 ? (
                    <div className="mt-6 space-y-3">
                      {quotation.followUps.map((followUp) => (
                        <div key={followUp.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold">{followUp.type}</p>
                            <Badge variant={followUp.status === "COMPLETED" ? "success" : followUp.status === "CANCELLED" ? "destructive" : "default"}>
                              {followUp.status}
                            </Badge>
                          </div>
                          <p className="mt-2 text-sm text-slate-700">{followUp.feedback || followUp.callNotes || followUp.meetingNotes || "No notes added."}</p>
                          <p className="mt-2 text-xs text-slate-500">Next follow-up: {followUp.nextFollowUpDate ? formatDate(followUp.nextFollowUpDate) : "Not scheduled"}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground mt-4">No follow-ups scheduled yet.</p>
                  )}
                </CardContent>
              </Card>
            </>
          )}
          {role === "CUSTOMER" && (
            <Card>
              <CardHeader>
                <CardTitle>Your Actions</CardTitle>
                <CardDescription>Accept the quotation before paying. You can download the quotation or receipt anytime.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <CustomerQuotationActions quotationId={quotation.id} status={quotation.status} paymentStatus={quotation.paymentStatus} />
                <div className="grid gap-2">
                  <DownloadQuotationPdf quotationId={quotation.id} />
                  {paidReceipt && <DownloadReceiptPdf receiptId={paidReceipt.id} />}
                  {quotationContactUserId && (
                    <Link
                      href={`/dashboard/chat?recipientId=${quotationContactUserId}`}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm font-semibold text-neutral-900 transition-colors hover:bg-slate-50"
                    >
                      <MessageCircle className="h-4 w-4 text-blue-600" />
                      Chat about this quotation
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
