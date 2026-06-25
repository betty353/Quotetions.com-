"use client"

import React, { useState } from "react"

interface Props {
  quotationId: string
  amount: number
}

export default function QuickSettleButton({ quotationId, amount }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSettle() {
    if (!confirm(`Record payment of ${amount.toFixed(2)} and mark as paid?`)) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quotationId,
          amount,
          method: "CASH",
          paymentDate: new Date().toISOString(),
          reference: "Quick settle",
          notes: "Reconciled via dashboard",
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to record payment")
      location.reload()
    } catch (err: any) {
      setError(err.message || "Unexpected error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button onClick={handleSettle} disabled={loading} className="px-2 py-1 bg-blue-600 text-white rounded text-sm">
        {loading ? "Processing..." : "Quick Settle"}
      </button>
      {error && <div className="text-xs text-red-600 mt-1">{error}</div>}
    </div>
  )
}
