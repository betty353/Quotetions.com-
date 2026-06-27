"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

export default function DpoPayButton({
  quotationId,
  disabled,
  transactionToken,
}: {
  quotationId: string
  disabled?: boolean
  transactionToken?: string | null
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function pay() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/payments/dpo/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ quotationId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to start payment")
      window.location.href = data.data.redirectUrl
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start payment")
      setLoading(false)
    }
  }

  async function verify() {
    setVerifying(true)
    setError(null)
    try {
      const res = await fetch("/api/payments/dpo/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ quotationId, transactionToken }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to verify payment")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to verify payment")
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={pay} disabled={disabled || loading}>
          {loading ? "Opening DPO..." : "Pay with DPO"}
        </Button>
        {transactionToken && (
          <Button type="button" variant="outline" onClick={verify} disabled={verifying}>
            {verifying ? "Verifying..." : "Verify Payment"}
          </Button>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
