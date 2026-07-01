"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CalendarClock, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function FollowUpActions({ followUpId, disabled = false }: { followUpId: string; disabled?: boolean }) {
  const router = useRouter()
  const [date, setDate] = useState("")
  const [loading, setLoading] = useState<"complete" | "reschedule" | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function update(body: Record<string, unknown>, action: "complete" | "reschedule") {
    setLoading(action)
    setError(null)
    try {
      const res = await fetch(`/api/followups/${followUpId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to update follow-up")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update follow-up")
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={() => update({ status: "COMPLETED" }, "complete")} disabled={disabled || loading !== null}>
          <CheckCircle2 className="h-4 w-4" />
          {loading === "complete" ? "Completing..." : "Complete"}
        </Button>
        <input
          type="datetime-local"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          disabled={disabled || loading !== null}
          className="h-9 rounded-lg border border-input bg-card px-3 text-xs"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => update({ status: "RESCHEDULED", nextFollowUpDate: date, reminderDate: date }, "reschedule")}
          disabled={disabled || !date || loading !== null}
        >
          <CalendarClock className="h-4 w-4 text-blue-600" />
          {loading === "reschedule" ? "Saving..." : "Reschedule"}
        </Button>
      </div>
      {error && <p className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">{error}</p>}
    </div>
  )
}
