import Link from "next/link"
import type { ReactNode } from "react"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { Mail, MapPin, Phone, UserRound, MessageCircle } from "lucide-react"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isCompanyAdminRole } from "@/lib/tenant"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import SafeImage from "@/components/ui/safe-image"
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils"

type Props = {
  params: Promise<{ id: string }>
}

function whatsappHref(phone?: string | null) {
  const digits = (phone || "").replace(/[^\d]/g, "")
  if (!digits) return null
  return `https://wa.me/${digits}`
}

export default async function CustomerDetailPage({ params }: Props) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) redirect("/dashboard")

  const role = (session.user as any).role
  if (!isCompanyAdminRole(role) && role !== "EMPLOYEE") redirect("/dashboard")

  const companyId = (session.user as any).companyId as string | null
  if (!companyId) redirect("/dashboard")

  const customer = await prisma.customer.findFirst({
    where: { id, companyId },
    include: {
      user: true,
      quotations: {
        orderBy: { createdAt: "desc" },
        include: {
          payments: { where: { status: { in: ["PARTIAL", "COMPLETED"] } } },
          receipts: true,
        },
      },
      followUps: { orderBy: { createdAt: "desc" }, take: 10 },
      activityLogs: { orderBy: { createdAt: "desc" }, take: 12 },
    },
  })

  if (!customer) return <div className="py-12 text-center">Customer not found</div>

  const name = customer.companyName || customer.contactPerson || `${customer.user.firstName} ${customer.user.lastName}`
  const phone = customer.whatsappNumber || customer.phone || customer.user.phone
  const whatsapp = whatsappHref(phone)
  const quoted = customer.quotations.reduce((sum, quotation) => sum + Number(quotation.total), 0)
  const paid = customer.quotations.reduce(
    (sum, quotation) => sum + quotation.payments.reduce((paymentSum, payment) => paymentSum + Number(payment.amount), 0),
    0
  )
  const outstanding = Math.max(0, quoted - paid)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href="/dashboard/customers" className="text-sm text-muted-foreground underline-offset-4 hover:underline">Back to customer ledger</Link>
          <h1 className="mt-2 text-3xl font-bold">{name}</h1>
          <p className="text-sm text-muted-foreground">Full customer profile, identity details, contact links, quotations, and activity.</p>
        </div>
        <Badge variant={customer.status === "ACTIVE" ? "success" : "warning"}>{customer.status}</Badge>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardHeader>
            <CardTitle>Identity Profile</CardTitle>
            <CardDescription>NRC, passport-size image, name, village, and town.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center gap-4">
              <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border bg-slate-50">
                {customer.passportPhotoUrl ? (
                  <SafeImage src={customer.passportPhotoUrl} alt={`${name} passport photo`} width={96} height={96} className="h-full w-full object-cover" />
                ) : (
                  <UserRound className="h-10 w-10 text-slate-400" />
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold">{name}</p>
                <p className="text-sm text-muted-foreground">NRC: {customer.nrc || "Not captured"}</p>
                <p className="text-sm text-muted-foreground">Customer since {formatDate(customer.createdAt)}</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Info label="Village" value={customer.village || "Not captured"} />
              <Info label="Town" value={customer.town || customer.city || "Not captured"} />
              <Info label="City" value={customer.city || "Not captured"} />
              <Info label="Region" value={customer.region || "Not captured"} />
              <Info label="Country" value={customer.country || "Not captured"} />
              <Info label="Postal Code" value={customer.postalCode || "Not captured"} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contact & Balance</CardTitle>
            <CardDescription>Contact channels and financial position.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border bg-slate-50 p-4">
                <p className="text-xs uppercase text-muted-foreground">Quoted</p>
                <p className="mt-2 text-xl font-semibold">{formatCurrency(quoted)}</p>
              </div>
              <div className="rounded-xl border bg-slate-50 p-4">
                <p className="text-xs uppercase text-muted-foreground">Paid</p>
                <p className="mt-2 text-xl font-semibold">{formatCurrency(paid)}</p>
              </div>
              <div className="rounded-xl border bg-slate-50 p-4">
                <p className="text-xs uppercase text-muted-foreground">Outstanding</p>
                <p className="mt-2 text-xl font-semibold">{formatCurrency(outstanding)}</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <ContactRow icon={<Mail className="h-4 w-4 text-blue-600" />} label="Email" value={customer.user.email} href={`mailto:${customer.user.email}`} />
              <ContactRow icon={<Phone className="h-4 w-4 text-emerald-600" />} label="Phone" value={customer.phone || customer.user.phone || "-"} href={phone ? `tel:${phone}` : undefined} />
              <ContactRow icon={<MessageCircle className="h-4 w-4 text-green-600" />} label="WhatsApp" value={whatsapp ? "Open WhatsApp" : "Not detected"} href={whatsapp || undefined} />
              <ContactRow icon={<MapPin className="h-4 w-4 text-rose-600" />} label="Address" value={customer.address || "-"} />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quotations</CardTitle>
          <CardDescription>All quotation, payment, and receipt activity for this customer.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Quotation</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Paid</th>
                <th className="px-4 py-3">Receipts</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {customer.quotations.map((quotation) => {
                const quotationPaid = quotation.payments.reduce((sum, payment) => sum + Number(payment.amount), 0)
                return (
                  <tr key={quotation.id} className="border-b hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/quotations/${quotation.id}`} className="font-medium text-blue-600 hover:underline">{quotation.quotationNumber}</Link>
                    </td>
                    <td className="px-4 py-3"><Badge>{quotation.status}</Badge></td>
                    <td className="px-4 py-3">{formatCurrency(quotation.total, quotation.currency)}</td>
                    <td className="px-4 py-3">{formatCurrency(quotationPaid, quotation.currency)}</td>
                    <td className="px-4 py-3">{quotation.receipts.length}</td>
                    <td className="px-4 py-3">{formatDate(quotation.createdAt)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Follow-Ups</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {customer.followUps.length === 0 ? <p className="text-sm text-muted-foreground">No follow-ups yet.</p> : customer.followUps.map((followUp) => (
              <div key={followUp.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-3"><Badge>{followUp.type}</Badge><span className="text-xs text-muted-foreground">{formatDateTime(followUp.createdAt)}</span></div>
                <p className="mt-2 text-sm text-muted-foreground">{followUp.feedback || followUp.callNotes || followUp.meetingNotes || "No notes"}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Activity Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {customer.activityLogs.length === 0 ? <p className="text-sm text-muted-foreground">No activity yet.</p> : customer.activityLogs.map((activity) => (
              <div key={activity.id} className="rounded-lg border p-3">
                <p className="text-sm font-medium">{activity.description}</p>
                <p className="mt-1 text-xs text-muted-foreground">{activity.activityType} | {formatDateTime(activity.createdAt)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-slate-50 p-3">
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  )
}

function ContactRow({ icon, label, value, href }: { icon: ReactNode; label: string; value: string; href?: string }) {
  const content = (
    <div className="flex items-center gap-3 rounded-lg border bg-white p-3 transition-colors hover:bg-slate-50">
      {icon}
      <div className="min-w-0">
        <p className="text-xs uppercase text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium">{value}</p>
      </div>
    </div>
  )

  return href ? <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer">{content}</a> : content
}
