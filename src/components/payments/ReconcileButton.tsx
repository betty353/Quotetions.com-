"use client"

import React, { useState } from "react"

interface Props {
  paymentId: string
}

export default function ReconcileButton({ paymentId }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleReconcile() {
    if (!confirm("Mark this payment as COMPLETED?")) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/payments/${paymentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "COMPLETED" }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Failed')
      }
      location.reload()
    } catch (err: any) {
      setError(err.message || "Unexpected error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button onClick={handleReconcile} disabled={loading} className="px-2 py-1 bg-green-600 text-white rounded text-sm">
        {loading ? 'Processing...' : 'Mark Completed'}
      </button>
      {error && <div className="text-xs text-red-600 mt-1">{error}</div>}
    </div>
  )
}
