"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Bell, X } from "lucide-react"
import { playNotificationTone } from "@/lib/client-sounds"

type NotificationItem = {
  id: string
  title: string
  message: string
  type: string
  isRead: boolean
  createdAt: string
  relatedId?: string | null
  relatedModel?: string | null
  customerId?: string | null
  quotationId?: string | null
  paymentId?: string | null
  receiptId?: string | null
  followUpId?: string | null
}

function notificationHref(notification: NotificationItem) {
  if (notification.relatedModel === "InternalChatMessage") return "/dashboard/chat"
  if (notification.relatedModel === "Quotation" || notification.quotationId) {
    const quotationId = notification.quotationId || notification.relatedId
    return quotationId ? `/dashboard/quotations/${quotationId}` : "/dashboard/quotations"
  }
  if (notification.relatedModel === "FollowUp") return notification.quotationId ? `/dashboard/quotations/${notification.quotationId}` : "/dashboard/followups"
  if (notification.relatedModel === "Receipt") return "/dashboard/receipts"
  if (notification.relatedModel === "Payment") return "/dashboard/payments"
  if (notification.relatedModel === "Customer" && notification.customerId) return `/dashboard/customers/${notification.customerId}`
  if (notification.customerId) return `/dashboard/customers/${notification.customerId}`
  return "/dashboard/notifications"
}

export default function NotificationBell() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unread, setUnread] = useState(0)
  const [toast, setToast] = useState<NotificationItem | null>(null)
  const seenIds = useRef<Set<string>>(new Set())

  const latestUnread = useMemo(() => notifications.find((notification) => !notification.isRead), [notifications])

  async function loadNotifications() {
    try {
      const res = await fetch("/api/notifications?unread=true&limit=10", {
        credentials: "include",
        cache: "no-store",
      })
      if (!res.ok) return
      const json = await res.json()
      const items = (json.data || []) as NotificationItem[]
      setNotifications(items)
      setUnread(json.unread || 0)

      const newest = items[0]
      if (newest && !seenIds.current.has(newest.id)) {
        seenIds.current.add(newest.id)
        setToast(newest)
        playNotificationTone()
      }
    } catch {
      // Keep polling quiet; the notifications page still shows full errors if needed.
    }
  }

  async function openNotification(notification: NotificationItem) {
    const href = notificationHref(notification)
    await markRead(notification.id)
    router.push(href)
  }

  async function markRead(id: string) {
    setToast(null)
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id }),
      })
      await loadNotifications()
    } catch {
      await loadNotifications()
    }
  }

  useEffect(() => {
    loadNotifications()
    const timer = window.setInterval(loadNotifications, 30000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <>
      <Link href="/dashboard/notifications" aria-label="Notifications" className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
        <Bell size={20} className="text-red-500" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Link>

      {toast && (
        <div className="fixed right-4 top-20 z-[80] w-[calc(100vw-2rem)] max-w-sm rounded-xl border border-border bg-card p-4 shadow-[0_18px_50px_rgba(15,23,42,0.18)]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase text-red-600">{toast.type.replace(/_/g, " ")}</p>
              <p className="mt-1 font-semibold">{toast.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{toast.message}</p>
            </div>
            <button type="button" aria-label="Dismiss notification" onClick={() => setToast(null)} className="rounded-lg p-1 text-muted-foreground hover:bg-accent">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-4 flex items-center justify-end gap-2">
            <button type="button" onClick={() => openNotification(toast)} className="rounded-lg border border-input bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent">
              Open
            </button>
            <button type="button" onClick={() => markRead(toast.id)} className="rounded-lg bg-neutral-950 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800">
              Mark read
            </button>
          </div>
        </div>
      )}

      {!toast && latestUnread && (
        <span className="sr-only">Latest unread notification: {latestUnread.title}</span>
      )}
    </>
  )
}
