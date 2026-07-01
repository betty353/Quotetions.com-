"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, ClipboardCheck, PackageCheck, RotateCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import GenerateInvoiceButton from "@/components/invoices/GenerateInvoiceButton"

type OrderStatus = "DRAFT" | "SENT" | "VIEWED" | "APPROVED" | "PROCESSING" | "READY" | "REJECTED" | "EXPIRED" | "COMPLETED"

export default function OrderWorkflowActions({
  quotationId,
  status,
  paymentStatus,
}: {
  quotationId: string
  status: OrderStatus
  paymentStatus: string
}) {
  const router = useRouter()
  const [loadingStatus, setLoadingStatus] = useState<OrderStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const isPaid = paymentStatus === "COMPLETED"
  const isClosed = status === "COMPLETED" || status === "REJECTED" || status === "EXPIRED"

  async function updateStatus(nextStatus: OrderStatus) {
    setLoadingStatus(nextStatus)
    setError(null)
    try {
      const res = await fetch(`/api/quotations/${quotationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: nextStatus }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to update order")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update order")
    } finally {
      setLoadingStatus(null)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <GenerateInvoiceButton quotationId={quotationId} disabled={status === "REJECTED" || status === "EXPIRED"} />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!isPaid || isClosed || loadingStatus !== null || status === "PROCESSING" || status === "READY"}
          onClick={() => updateStatus("PROCESSING")}
        >
          {loadingStatus === "PROCESSING" ? <RotateCw className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4 text-blue-600" />}
          Processing
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!isPaid || isClosed || loadingStatus !== null || status === "READY"}
          onClick={() => updateStatus("READY")}
        >
          {loadingStatus === "READY" ? <RotateCw className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4 text-amber-600" />}
          Ready
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={!isPaid || isClosed || loadingStatus !== null}
          onClick={() => updateStatus("COMPLETED")}
        >
          {loadingStatus === "COMPLETED" ? <RotateCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Complete
        </Button>
      </div>
      {!isPaid && !isClosed && <p className="text-xs text-amber-700">Record or verify payment before processing this order.</p>}
      {error && <p className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">{error}</p>}
    </div>
  )
}
