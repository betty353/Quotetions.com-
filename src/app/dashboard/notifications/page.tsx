import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatDateTime } from "@/lib/utils"
import { BellRing } from "lucide-react"
import { isCompanyAdminRole } from "@/lib/tenant"

async function markNotificationRead(formData: FormData) {
  "use server"

  const session = await getServerSession(authOptions)
  if (!session) redirect("/dashboard")

  const id = String(formData.get("id") || "")
  if (!id) return

  const role = (session.user as any).role
  const userId = (session.user as any).id
  const notification = await prisma.notification.findUnique({ where: { id } })
  if (!notification) return
  if (!isCompanyAdminRole(role) && notification.userId !== userId) return

  await prisma.notification.update({
    where: { id },
    data: { isRead: true, readAt: new Date() },
  })

  revalidatePath("/dashboard/notifications")
}

async function markAllVisibleRead() {
  "use server"

  const session = await getServerSession(authOptions)
  if (!session) redirect("/dashboard")

  const role = (session.user as any).role
  const userId = (session.user as any).id

  await prisma.notification.updateMany({
    where: isCompanyAdminRole(role) ? { isRead: false } : { userId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  })

  revalidatePath("/dashboard/notifications")
}

export default async function NotificationsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/dashboard")

  const role = (session.user as any).role
  const userId = (session.user as any).id

  const notifications = await prisma.notification.findMany({
    where: isCompanyAdminRole(role) ? {} : { userId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      user: true,
      customer: true,
      quotation: true,
      payment: true,
      receipt: true,
    },
  })

  const unread = notifications.filter((notification) => !notification.isRead).length

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Notifications</h1>
          <p className="text-sm text-muted-foreground mt-1">System alerts and customer-facing commercial events.</p>
        </div>
        <form action={markAllVisibleRead}>
          <Button type="submit" variant="outline" disabled={unread === 0}>Mark all read</Button>
        </form>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Notification Stream</CardTitle>
          <CardDescription>{unread} unread of {notifications.length} recent notifications.</CardDescription>
        </CardHeader>
        <CardContent>
          {notifications.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <BellRing className="mx-auto mb-4 h-12 w-12 opacity-50" />
              <p>No notifications yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((notification) => (
                <div key={notification.id} className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-semibold">{notification.title}</h2>
                        <Badge variant={notification.isRead ? "outline" : "info"}>{notification.isRead ? "Read" : "Unread"}</Badge>
                        <Badge variant="secondary">{notification.type}</Badge>
                      </div>
                      <p className="mt-2 text-sm text-slate-700">{notification.message}</p>
                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                        <span>{formatDateTime(notification.createdAt)}</span>
                        {isCompanyAdminRole(role) && <span>User: {notification.user.email}</span>}
                        {notification.quotation && <span>Quotation: {notification.quotation.quotationNumber}</span>}
                        {notification.payment && <span>Payment: {notification.payment.paymentNumber}</span>}
                        {notification.receipt && <span>Receipt: {notification.receipt.receiptNumber}</span>}
                      </div>
                    </div>
                    {!notification.isRead && (
                      <form action={markNotificationRead}>
                        <input type="hidden" name="id" value={notification.id} />
                        <Button type="submit" variant="outline" size="sm">Mark read</Button>
                      </form>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
