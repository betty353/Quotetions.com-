"use client"

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react"
import type { ReactNode } from "react"
import Link from "next/link"
import { Edit3, FileText, ImageIcon, Link2, MessageCircle, Mic, MoreHorizontal, Paperclip, Pin, PinOff, Reply, Search, Send, Trash2, Users, X } from "lucide-react"
import { playSentMessageTone } from "@/lib/client-sounds"

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
  replyToId?: string | null
  replyTo?: {
    id: string
    message: string
    attachmentName?: string | null
    linkLabel?: string | null
    deletedAt?: string | null
    sender: ChatUser
  } | null
  attachmentUrl?: string | null
  attachmentName?: string | null
  attachmentType?: string | null
  linkType?: string | null
  linkId?: string | null
  linkLabel?: string | null
  isPinned: boolean
  isRead: boolean
  readAt?: string | null
  editedAt?: string | null
  deletedAt?: string | null
  createdAt: string
  sender: ChatUser
  recipient?: ChatUser | null
}

type LinkedRecord = {
  type: string
  id: string
  label: string
  href: string
}

type Presence = {
  userId: string
  lastSeenAt: string
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

function displayName(user?: ChatUser | null) {
  if (!user) return "User"
  return `${user.firstName} ${user.lastName}`.trim() || user.email
}

function timeLabel(value: string) {
  return new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit" }).format(new Date(value))
}

function dayLabel(value: string) {
  const date = new Date(value)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (date.toDateString() === today.toDateString()) return "Today"
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday"
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(date)
}

function linkHref(message: ChatMessage) {
  if (!message.linkType || !message.linkId) return null
  if (message.linkType === "CUSTOMER") return `/dashboard/customers/${message.linkId}`
  if (message.linkType === "QUOTATION") return `/dashboard/quotations/${message.linkId}`
  if (message.linkType === "PRODUCT") return `/dashboard/products/${message.linkId}`
  if (message.linkType === "RECEIPT") return "/dashboard/receipts"
  if (message.linkType === "INVOICE") return "/dashboard/invoices"
  return null
}

function isOnline(presence?: Presence) {
  if (!presence) return false
  return Date.now() - new Date(presence.lastSeenAt).getTime() < 60_000
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ""))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export default function InternalChatPanel({ currentUserId, initialUsers }: InternalChatPanelProps) {
  const [users, setUsers] = useState(initialUsers)
  const [recipientId, setRecipientId] = useState<string>("")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [pinnedMessages, setPinnedMessages] = useState<ChatMessage[]>([])
  const [message, setMessage] = useState("")
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null)
  const [editing, setEditing] = useState<ChatMessage | null>(null)
  const [attachment, setAttachment] = useState<{ url: string; name: string; type: string } | null>(null)
  const [selectedLink, setSelectedLink] = useState<LinkedRecord | null>(null)
  const [linkables, setLinkables] = useState<LinkedRecord[]>([])
  const [showLinkPicker, setShowLinkPicker] = useState(false)
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")
  const [unread, setUnread] = useState<ChatUnreadSummary>({ total: 0, team: 0, directByUserId: {} })
  const [presences, setPresences] = useState<Record<string, Presence>>({})
  const [typingUserIds, setTypingUserIds] = useState<string[]>([])
  const typingTimer = useRef<number | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  const directUsers = useMemo(() => users.filter((user) => user.id !== currentUserId), [currentUserId, users])
  const activeUser = directUsers.find((user) => user.id === recipientId)
  const linkSearch = query.toLowerCase()
  const filteredLinkables = linkables.filter((item) => item.label.toLowerCase().includes(linkSearch)).slice(0, 10)
  const typingNames = typingUserIds
    .map((id) => users.find((user) => user.id === id))
    .filter(Boolean)
    .map((user) => displayName(user))

  async function loadMessages(nextRecipientId = recipientId, searchText = query) {
    const search = new URLSearchParams()
    if (nextRecipientId) search.set("recipientId", nextRecipientId)
    if (searchText.trim()) search.set("q", searchText.trim())
    const res = await fetch(`/api/internal-chat${search.toString() ? `?${search}` : ""}`, {
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
    setPinnedMessages(json.pinnedMessages || [])
    setUnread(json.unread || { total: 0, team: 0, directByUserId: {} })
    setLinkables(json.linkables || [])
    setTypingUserIds(json.typingUserIds || [])
    setPresences((json.presences || []).reduce((acc: Record<string, Presence>, item: Presence) => {
      acc[item.userId] = item
      return acc
    }, {}))
    setError("")
    setLoading(false)
  }

  async function sendTyping() {
    try {
      await fetch("/api/internal-chat/typing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ recipientId: recipientId || null }),
      })
    } catch {
      // Typing indicators are best-effort.
    }
  }

  function handleMessageChange(value: string) {
    setMessage(value)
    if (typingTimer.current) window.clearTimeout(typingTimer.current)
    typingTimer.current = window.setTimeout(sendTyping, 250)
  }

  async function uploadAttachment(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    if (file.size > 8 * 1024 * 1024) {
      setError("Attachment is too large. Use files under 8MB.")
      return
    }

    setUploading(true)
    setError("")
    try {
      const dataUrl = await readFileAsDataUrl(file)
      const res = await fetch("/api/uploads/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ base64File: dataUrl, folder: "quotetion/chat" }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Upload failed")
      setAttachment({ url: json.data.secure_url || json.data.url, name: file.name, type: file.type || "application/octet-stream" })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Attachment upload failed.")
    } finally {
      setUploading(false)
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const body = message.trim()
    if (editing) {
      if (!body) return
      setSending(true)
      const res = await fetch("/api/internal-chat", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "edit", id: editing.id, message: body }),
      })
      setSending(false)
      if (!res.ok) return setError("Could not edit message.")
      setEditing(null)
      setMessage("")
      await loadMessages()
      return
    }

    if (!body && !attachment && !selectedLink) return
    setSending(true)
    setError("")
    const res = await fetch("/api/internal-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        message: body,
        recipientId: recipientId || null,
        replyToId: replyTo?.id || null,
        attachmentUrl: attachment?.url || null,
        attachmentName: attachment?.name || null,
        attachmentType: attachment?.type || null,
        linkType: selectedLink?.type || null,
        linkId: selectedLink?.id || null,
        linkLabel: selectedLink?.label || null,
      }),
    })

    if (!res.ok) {
      setError("Could not send message.")
      setSending(false)
      return
    }

    setMessage("")
    setReplyTo(null)
    setAttachment(null)
    setSelectedLink(null)
    playSentMessageTone()
    setSending(false)
    await loadMessages()
  }

  async function patchMessage(payload: Record<string, unknown>) {
    const res = await fetch("/api/internal-chat", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      setError("Could not update message.")
      return
    }
    await loadMessages()
  }

  function beginEdit(item: ChatMessage) {
    setEditing(item)
    setReplyTo(null)
    setMessage(item.message)
  }

  function switchChannel(nextRecipientId: string) {
    setRecipientId(nextRecipientId)
    setReplyTo(null)
    setEditing(null)
    setMessage("")
    setQuery("")
  }

  useEffect(() => {
    loadMessages()
    const timer = window.setInterval(() => loadMessages(), 3000)
    return () => window.clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipientId])

  useEffect(() => {
    const timer = window.setTimeout(() => loadMessages(recipientId, query), 350)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length])

  let lastDay = ""

  return (
    <div className="grid min-h-[740px] overflow-hidden rounded-xl border bg-white lg:grid-cols-[330px_1fr]">
      <aside className="border-b bg-slate-50 lg:border-b-0 lg:border-r">
        <div className="border-b bg-white p-4">
          <h2 className="flex items-center gap-2 font-semibold">
            <MessageCircle className="h-5 w-5 text-blue-600" />
            Company Chat
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Admins and workers can coordinate in real time.</p>
        </div>

        <div className="space-y-4 p-3">
          <button
            type="button"
            onClick={() => switchChannel("")}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors ${recipientId === "" ? "bg-neutral-950 text-white" : "hover:bg-white"}`}
          >
            <span className={`flex h-10 w-10 items-center justify-center rounded-full ${recipientId === "" ? "bg-white/15" : "bg-blue-50"}`}>
              <Users className={`h-5 w-5 ${recipientId === "" ? "text-white" : "text-blue-600"}`} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">Team room</span>
              <span className={`block truncate text-xs ${recipientId === "" ? "text-white/70" : "text-muted-foreground"}`}>Everyone in admin and worker roles</span>
            </span>
            {unread.team > 0 && recipientId !== "" && <UnreadBadge count={unread.team} />}
          </button>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search this chat"
              className="h-10 w-full rounded-xl border bg-white pl-9 pr-3 text-sm outline-none focus:border-neutral-400"
            />
          </div>

          <div className="space-y-1">
            <p className="px-3 text-xs font-semibold uppercase text-muted-foreground">Direct messages</p>
            {directUsers.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted-foreground">No workers or admins found yet.</p>
            ) : (
              directUsers.map((user) => {
                const online = isOnline(presences[user.id])
                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => switchChannel(user.id)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors ${recipientId === user.id ? "bg-white shadow-sm ring-1 ring-border" : "hover:bg-white"}`}
                  >
                    <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-neutral-900 text-sm font-semibold text-white">
                      {displayName(user).charAt(0).toUpperCase()}
                      <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${online ? "bg-emerald-500" : "bg-slate-300"}`} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{displayName(user)}</span>
                      <span className="block truncate text-xs text-muted-foreground">{online ? "Online" : user.role}</span>
                    </span>
                    {(unread.directByUserId[user.id] || 0) > 0 && recipientId !== user.id && <UnreadBadge count={unread.directByUserId[user.id]} />}
                  </button>
                )
              })
            )}
          </div>
        </div>
      </aside>

      <section className="flex min-h-[740px] flex-col">
        <div className="border-b bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="font-semibold">{activeUser ? displayName(activeUser) : "Team room"}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{activeUser ? `${isOnline(presences[activeUser.id]) ? "Online" : "Offline"} | Direct chat` : "Company-wide admin and worker messages"}</p>
            </div>
            <div className="rounded-full border px-3 py-1 text-xs text-muted-foreground">{messages.length} messages</div>
          </div>

          {pinnedMessages.length > 0 && (
            <div className="mt-3 flex gap-2 overflow-x-auto">
              {pinnedMessages.map((item) => (
                <div key={item.id} className="min-w-60 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs">
                  <div className="flex items-center gap-1 font-semibold text-amber-800"><Pin className="h-3 w-3" /> Pinned by {displayName(item.sender)}</div>
                  <p className="mt-1 line-clamp-2 text-amber-900">{item.message || item.attachmentName || item.linkLabel || "Pinned item"}</p>
                </div>
              ))}
            </div>
          )}
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
                const day = dayLabel(item.createdAt)
                const showDay = day !== lastDay
                lastDay = day
                return (
                  <div key={item.id}>
                    {showDay && <div className="my-4 text-center"><span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">{day}</span></div>}
                    <MessageBubble
                      item={item}
                      currentUserId={currentUserId}
                      onReply={() => setReplyTo(item)}
                      onEdit={() => beginEdit(item)}
                      onDelete={() => patchMessage({ action: "delete", id: item.id })}
                      onPin={() => patchMessage({ action: "pin", id: item.id, isPinned: !item.isPinned })}
                    />
                  </div>
                )
              })}
              {typingNames.length > 0 && (
                <div className="text-sm text-muted-foreground">{typingNames.join(", ")} {typingNames.length === 1 ? "is" : "are"} typing...</div>
              )}
              <div ref={endRef} />
            </div>
          )}
        </div>

        <form onSubmit={sendMessage} className="border-t bg-white p-4">
          {error && <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          {(replyTo || editing || attachment || selectedLink) && (
            <div className="mb-3 space-y-2">
              {editing && <ContextPill label="Editing message" value={editing.message} onClear={() => { setEditing(null); setMessage("") }} />}
              {replyTo && <ContextPill label={`Replying to ${displayName(replyTo.sender)}`} value={replyTo.message || replyTo.attachmentName || replyTo.linkLabel || "Message"} onClear={() => setReplyTo(null)} />}
              {attachment && <ContextPill label="Attachment ready" value={attachment.name} onClear={() => setAttachment(null)} />}
              {selectedLink && <ContextPill label={`Sharing ${selectedLink.type.toLowerCase()}`} value={selectedLink.label} onClear={() => setSelectedLink(null)} />}
            </div>
          )}

          {showLinkPicker && (
            <div className="mb-3 max-h-52 overflow-y-auto rounded-xl border bg-slate-50 p-2">
              {filteredLinkables.length === 0 ? <p className="p-3 text-sm text-muted-foreground">No records found.</p> : filteredLinkables.map((item) => (
                <button
                  key={`${item.type}-${item.id}`}
                  type="button"
                  onClick={() => { setSelectedLink(item); setShowLinkPicker(false) }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-white"
                >
                  <Link2 className="h-4 w-4 text-blue-600" />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  <span className="text-xs text-muted-foreground">{item.type}</span>
                </button>
              ))}
            </div>
          )}

          <div className="flex items-end gap-3">
            <div className="flex gap-1">
              <label className="inline-flex h-12 w-12 cursor-pointer items-center justify-center rounded-xl border bg-card hover:bg-accent" title="Attach image, PDF, audio, or document">
                <Paperclip className="h-4 w-4" />
                <input type="file" className="hidden" onChange={uploadAttachment} disabled={uploading} />
              </label>
              <button type="button" onClick={() => setShowLinkPicker((value) => !value)} className="inline-flex h-12 w-12 items-center justify-center rounded-xl border bg-card hover:bg-accent" title="Share customer, quotation, or product">
                <Link2 className="h-4 w-4" />
              </button>
            </div>
            <textarea
              value={message}
              onChange={(event) => handleMessageChange(event.target.value)}
              placeholder={editing ? "Edit your message" : activeUser ? `Message ${displayName(activeUser)}` : "Message the team"}
              rows={2}
              className="min-h-12 flex-1 resize-none rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none transition-colors focus:border-neutral-400"
            />
            <button
              type="submit"
              disabled={sending || uploading || (!message.trim() && !attachment && !selectedLink)}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {editing ? "Save" : "Send"}
            </button>
          </div>
          {uploading && <p className="mt-2 text-xs text-muted-foreground">Uploading attachment...</p>}
        </form>
      </section>
    </div>
  )
}

function MessageBubble({ item, currentUserId, onReply, onEdit, onDelete, onPin }: { item: ChatMessage; currentUserId: string; onReply: () => void; onEdit: () => void; onDelete: () => void; onPin: () => void }) {
  const mine = item.senderId === currentUserId
  const href = linkHref(item)

  return (
    <div className={`group flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[82%] rounded-2xl px-4 py-3 shadow-sm ${mine ? "bg-neutral-950 text-white" : "border bg-white text-foreground"}`}>
        {!mine && <p className="mb-1 text-xs font-semibold text-blue-600">{displayName(item.sender)}</p>}
        {item.deletedAt ? (
          <p className={`text-sm italic ${mine ? "text-white/70" : "text-muted-foreground"}`}>This message was deleted.</p>
        ) : (
          <>
            {item.replyTo && (
              <div className={`mb-2 rounded-lg border-l-4 px-3 py-2 text-xs ${mine ? "border-white/40 bg-white/10 text-white/80" : "border-blue-300 bg-blue-50 text-blue-900"}`}>
                <p className="font-semibold">{displayName(item.replyTo.sender)}</p>
                <p className="line-clamp-2">{item.replyTo.deletedAt ? "Deleted message" : item.replyTo.message || item.replyTo.attachmentName || item.replyTo.linkLabel || "Message"}</p>
              </div>
            )}
            {item.message && <p className="whitespace-pre-wrap text-sm leading-6">{item.message}</p>}
            {item.attachmentUrl && <AttachmentPreview item={item} mine={mine} />}
            {href && (
              <Link href={href} className={`mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${mine ? "bg-white/10 text-white hover:bg-white/15" : "bg-slate-100 text-foreground hover:bg-slate-200"}`}>
                <Link2 className="h-4 w-4" />
                <span className="truncate">{item.linkLabel || item.linkType}</span>
              </Link>
            )}
          </>
        )}
        <div className={`mt-2 flex items-center justify-between gap-3 text-[11px] ${mine ? "text-white/60" : "text-muted-foreground"}`}>
          <span>{timeLabel(item.createdAt)}{item.editedAt && !item.deletedAt ? " | edited" : ""}</span>
          {mine && !item.deletedAt && <span>{item.recipientId ? (item.readAt ? "Read" : "Sent") : (item.isRead ? "Seen" : "Sent")}</span>}
        </div>
        {!item.deletedAt && (
          <div className={`mt-2 flex flex-wrap gap-1 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 ${mine ? "justify-end" : "justify-start"}`}>
            <IconAction label="Reply" onClick={onReply} icon={<Reply className="h-3.5 w-3.5" />} />
            <IconAction label={item.isPinned ? "Unpin" : "Pin"} onClick={onPin} icon={item.isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />} />
            {mine && <IconAction label="Edit" onClick={onEdit} icon={<Edit3 className="h-3.5 w-3.5" />} />}
            {(mine || true) && <IconAction label="Delete" onClick={onDelete} icon={<Trash2 className="h-3.5 w-3.5" />} />}
          </div>
        )}
      </div>
    </div>
  )
}

function AttachmentPreview({ item, mine }: { item: ChatMessage; mine: boolean }) {
  const type = item.attachmentType || ""
  const name = item.attachmentName || "Attachment"
  if (type.startsWith("image/")) {
    return (
      <a href={item.attachmentUrl || "#"} target="_blank" rel="noreferrer" className="mt-2 block overflow-hidden rounded-xl border bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.attachmentUrl || ""} alt={name} className="max-h-72 w-full object-cover" />
      </a>
    )
  }
  if (type.startsWith("audio/")) {
    return (
      <div className={`mt-2 rounded-lg p-2 ${mine ? "bg-white/10" : "bg-slate-100"}`}>
        <div className="mb-2 flex items-center gap-2 text-sm"><Mic className="h-4 w-4" /> {name}</div>
        <audio controls src={item.attachmentUrl || ""} className="w-full" />
      </div>
    )
  }
  return (
    <a href={item.attachmentUrl || "#"} target="_blank" rel="noreferrer" className={`mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${mine ? "bg-white/10 text-white hover:bg-white/15" : "bg-slate-100 text-foreground hover:bg-slate-200"}`}>
      {type.includes("pdf") ? <FileText className="h-4 w-4" /> : type.startsWith("image/") ? <ImageIcon className="h-4 w-4" /> : <Paperclip className="h-4 w-4" />}
      <span className="truncate">{name}</span>
    </a>
  )
}

function IconAction({ label, icon, onClick }: { label: string; icon: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} title={label} className="inline-flex h-7 items-center gap-1 rounded-md border bg-white px-2 text-[11px] font-medium text-neutral-700 hover:bg-slate-50">
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}

function ContextPill({ label, value, onClear }: { label: string; value: string; onClear: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-slate-50 px-3 py-2 text-sm">
      <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        <p className="truncate">{value}</p>
      </div>
      <button type="button" onClick={onClear} className="rounded-lg p-1 hover:bg-white"><X className="h-4 w-4" /></button>
    </div>
  )
}

function UnreadBadge({ count }: { count: number }) {
  return (
    <span className="ml-auto flex h-6 min-w-6 items-center justify-center rounded-full bg-red-600 px-2 text-xs font-bold text-white">
      {count > 9 ? "9+" : count}
    </span>
  )
}
