"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Trash2 } from "lucide-react"

export default function RemoveCustomerButton({ customerId, customerName }: { customerId: string; customerName: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function removeCustomer() {
    if (!confirm(`Remove ${customerName} from active access? History, quotations, invoices, and receipts will stay saved.`)) return
    setLoading(true)
    const res = await fetch(`/api/customers?id=${customerId}`, {
      method: "DELETE",
      credentials: "include",
    })
    setLoading(false)
    if (!res.ok) {
      alert("Failed to remove customer")
      return
    }
    router.push("/dashboard/customers")
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={removeCustomer}
      disabled={loading}
      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50"
    >
      <Trash2 className="h-4 w-4" />
      {loading ? "Removing..." : "Remove customer"}
    </button>
  )
}
