"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { FilePlus2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function GenerateInvoiceButton({ quotationId, disabled = false }: { quotationId: string; disabled?: boolean }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")

  async function generateInvoice() {
    setLoading(true)
    setMessage("")
    const res = await fetch("/api/invoices/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ quotationId }),
    })
    const json = await res.json()
    setLoading(false)
    if (!res.ok) {
      setMessage(json.error || "Failed to generate invoice")
      return
    }
    setMessage("Invoice generated")
    router.refresh()
  }

  return (
    <div className="space-y-1">
      <Button type="button" size="sm" variant="secondary" onClick={generateInvoice} disabled={disabled || loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FilePlus2 className="h-4 w-4 text-blue-600" />}
        Generate Invoice
      </Button>
      {message && <p className="text-xs text-muted-foreground">{message}</p>}
    </div>
  )
}
