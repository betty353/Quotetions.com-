"use client"

import { useEffect, useState } from "react"

export default function ChatUnreadBadge({ compact = false }: { compact?: boolean }) {
  const [unread, setUnread] = useState(0)

  async function loadUnread() {
    try {
      const res = await fetch("/api/internal-chat/unread", {
        credentials: "include",
        cache: "no-store",
      })
      if (!res.ok) return
      const json = await res.json()
      setUnread(Number(json.total || 0))
    } catch {
      // Keep the sidebar quiet if the network drops; chat still works when opened.
    }
  }

  useEffect(() => {
    loadUnread()
    const timer = window.setInterval(loadUnread, 15000)
    return () => window.clearInterval(timer)
  }, [])

  if (unread <= 0) return null

  if (compact) {
    return <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-red-600 ring-2 ring-sidebar" />
  }

  return (
    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white">
      {unread > 9 ? "9+" : unread}
    </span>
  )
}
