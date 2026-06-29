"use client"

import { FormEvent, useEffect, useMemo, useRef, useState } from "react"
import { MessageCircle, Send, Users } from "lucide-react"

type ChatUser = {
  id: string
  firstName: string
  lastName: string
  email: string
  role: string
}

type ChatMessage = {
  id: string
  message: string
  senderId: string
  recipientId?: string | null
  isRead: boolean
  createdAt: string
  sender: ChatUser
  recipient?: ChatUser | null
}

type InternalChatPanelProps = {
  currentUserId: string
  initialUsers: ChatUser[]
}

type ChatUnreadSummary = {
  total: number
  team: number
  directByUserId: Record<string, number>
}

function displayName(user: ChatUser) {
  return `${user.firstName} ${user.lastName}`.trim() || user.email
}

function messageTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "numeric",
  }).format(new Date(value))
}

export default function InternalChatPanel({ currentUserId, initialUsers }: InternalChatPanelProps) {
  const [users, setUsers] = useState(initialUsers)
  const [recipientId, setRecipientId] = useState<string>("")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")
  const [unread, setUnread] = useState<ChatUnreadSummary>({ total: 0, team: 0, directByUserId: {} })
  const endRef = useRef<HTMLDivElement>(null)

  const directUsers = useMemo(() => users.filter((user) => user.id !== currentUserId), [currentUserId, users])
  const activeUser = directUsers.find((user) => user.id === recipientId)

  async function loadMessages(nextRecipientId = recipientId) {
    const query = nextRecipientId ? `?recipientId=${encodeURIComponent(nextRecipientId)}` : ""
    const res = await fetch(`/api/internal-chat${query}`, {
      credentials: "include",
      cache: "no-store",
    })
    if (!res.ok) {
      setError("Could not load chat messages.")
      setLoading(false)
      return
    }

    const json = await res.json()
    setUsers(json.users || [])
    setMessages(json.messages || [])
    setUnread(json.unread || { total: 0, team: 0, directByUserId: {} })
    setError("")
    setLoading(false)
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const body = message.trim()
    if (!body || sending) return

    setSending(true)
    setError("")
    const res = await fetch("/api/internal-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ message: body, recipientId: recipientId || null }),
    })

    if (!res.ok) {
      setError("Could not send message.")
      setSending(false)
      return
    }

    setMessage("")
    setSending(false)
    await loadMessages()
  }

  useEffect(() => {
    loadMessages()
    const timer = window.setInterval(() => loadMessages(), 8000)
    return () => window.clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipientId])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length])

  return (
    <div className="grid min-h-[680px] overflow-hidden rounded-xl border bg-white lg:grid-cols-[320px_1fr]">
      <aside className="border-b bg-slate-50 lg:border-b-0 lg:border-r">
        <div className="border-b bg-white p-4">
          <h2 className="flex items-center gap-2 font-semibold">
            <MessageCircle className="h-5 w-5 text-blue-600" />
            Company Chat
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Admins and workers can talk inside this workspace.</p>
        </div>

        <div className="p-3">
          <button
            type="button"
            onClick={() => setRecipientId("")}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors ${recipientId === "" ? "bg-neutral-950 text-white" : "hover:bg-white"}`}
          >
            <span className={`flex h-10 w-10 items-center justify-center rounded-full ${recipientId === "" ? "bg-white/15" : "bg-blue-50"}`}>
              <Users className={`h-5 w-5 ${recipientId === "" ? "text-white" : "text-blue-600"}`} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">Team room</span>
              <span className={`block truncate text-xs ${recipientId === "" ? "text-white/70" : "text-muted-foreground"}`}>Everyone in admin and worker roles</span>
            </span>
            {unread.team > 0 && recipientId !== "" && (
              <span className="ml-auto flex h-6 min-w-6 items-center justify-center rounded-full bg-red-600 px-2 text-xs font-bold text-white">
                {unread.team > 9 ? "9+" : unread.team}
              </span>
            )}
          </button>

          <div className="mt-4 space-y-1">
            <p className="px-3 text-xs font-semibold uppercase text-muted-foreground">Direct messages</p>
            {directUsers.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted-foreground">No workers or admins found yet.</p>
            ) : (
              directUsers.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => setRecipientId(user.id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors ${recipientId === user.id ? "bg-white shadow-sm ring-1 ring-border" : "hover:bg-white"}`}
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-900 text-sm font-semibold text-white">
                    {displayName(user).charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{displayName(user)}</span>
                    <span className="block truncate text-xs text-muted-foreground">{user.role}</span>
                  </span>
                  {(unread.directByUserId[user.id] || 0) > 0 && recipientId !== user.id && (
                    <span className="ml-auto flex h-6 min-w-6 items-center justify-center rounded-full bg-red-600 px-2 text-xs font-bold text-white">
                      {unread.directByUserId[user.id] > 9 ? "9+" : unread.directByUserId[user.id]}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      </aside>

      <section className="flex min-h-[680px] flex-col">
        <div className="border-b bg-white p-4">
          <h1 className="font-semibold">{activeUser ? displayName(activeUser) : "Team room"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{activeUser ? `Direct chat with ${activeUser.role.toLowerCase()}` : "Company-wide admin and worker messages"}</p>
        </div>

        <div className="flex-1 overflow-y-auto bg-[#f7f7f5] p-4">
          {loading ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading chat...</div>
          ) : messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
              <MessageCircle className="mb-3 h-12 w-12 opacity-50" />
              <p className="font-medium text-foreground">No messages yet</p>
              <p className="mt-1 text-sm">Send the first message to start the conversation.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((item) => {
                const mine = item.senderId === currentUserId
                return (
                  <div key={item.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[78%] rounded-2xl px-4 py-3 shadow-sm ${mine ? "bg-neutral-950 text-white" : "border bg-white text-foreground"}`}>
                      {!mine && <p className="mb-1 text-xs font-semibold text-blue-600">{displayName(item.sender)}</p>}
                      <p className="whitespace-pre-wrap text-sm leading-6">{item.message}</p>
                      <p className={`mt-2 text-[11px] ${mine ? "text-white/60" : "text-muted-foreground"}`}>{messageTime(item.createdAt)}</p>
                    </div>
                  </div>
                )
              })}
              <div ref={endRef} />
            </div>
          )}
        </div>

        <form onSubmit={sendMessage} className="border-t bg-white p-4">
          {error && <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <div className="flex items-end gap-3">
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder={activeUser ? `Message ${displayName(activeUser)}` : "Message the team"}
              rows={2}
              className="min-h-12 flex-1 resize-none rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none transition-colors focus:border-neutral-400"
            />
            <button
              type="submit"
              disabled={sending || message.trim().length === 0}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              Send
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
