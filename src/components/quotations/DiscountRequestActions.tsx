"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function DiscountRequestActions({ id }: { id: string }) {
  const router = useRouter()
  const [reason, setReason] = useState("")
  const [loading, setLoading] = useState("")
  const [error, setError] = useState("")

  async function decide(action: "APPROVE" | "REJECT") {
    setLoading(action)
    setError("")
    const res = await fetch(`/api/discount-requests?id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ action, rejectionReason: reason }),
    })
    const json = await res.json()
    setLoading("")
    if (!res.ok) {
      setError(json.error || "Could not update request.")
      return
    }
    router.refresh()
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-xs text-red-600">{error}</p>}
      <Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason if rejecting" />
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={() => decide("APPROVE")} disabled={Boolean(loading)}>
          {loading === "APPROVE" ? "Approving..." : "Approve"}
        </Button>
        <Button type="button" size="sm" variant="destructive" onClick={() => decide("REJECT")} disabled={Boolean(loading)}>
          {loading === "REJECT" ? "Rejecting..." : "Reject"}
        </Button>
      </div>
    </div>
  )
}
