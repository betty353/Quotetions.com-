"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function CustomerQuotationActions({
  quotationId,
  status,
  paymentStatus,
}: {
  quotationId: string
  status: string
  paymentStatus: string
}) {
  const router = useRouter()
  const [loadingAction, setLoadingAction] = useState<"APPROVED" | "REJECTED" | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isPaid = paymentStatus === "COMPLETED" || status === "COMPLETED"
  const canRespond = !isPaid && status !== "APPROVED" && status !== "REJECTED" && status !== "EXPIRED"

  async function updateStatus(nextStatus: "APPROVED" | "REJECTED") {
    setLoadingAction(nextStatus)
    setError(null)
    try {
      const res = await fetch(`/api/quotations/${quotationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: nextStatus }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to update quotation")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update quotation")
    } finally {
      setLoadingAction(null)
    }
  }

  if (isPaid) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
        This quotation is paid. Your receipt is available below.
      </div>
    )
  }

  if (status === "APPROVED") {
    return (
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        You accepted this quotation. Continue to payment when ready.
      </div>
    )
  }

  if (status === "REJECTED") {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        You rejected this quotation. Contact the company if you need a revised quotation.
      </div>
    )
  }

  if (status === "EXPIRED") {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        This quotation has expired. Ask the company to issue a new one.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <Button type="button" onClick={() => updateStatus("APPROVED")} disabled={!canRespond || loadingAction !== null}>
          <CheckCircle2 className="h-4 w-4" />
          {loadingAction === "APPROVED" ? "Accepting..." : "Accept Quotation"}
        </Button>
        <Button type="button" variant="outline" onClick={() => updateStatus("REJECTED")} disabled={!canRespond || loadingAction !== null}>
          <XCircle className="h-4 w-4 text-red-600" />
          {loadingAction === "REJECTED" ? "Rejecting..." : "Reject"}
        </Button>
      </div>
      {error && <p className="rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</p>}
    </div>
  )
}
