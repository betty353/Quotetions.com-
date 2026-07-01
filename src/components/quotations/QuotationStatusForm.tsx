"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

interface Props {
  quotationId: string
  currentStatus: string
}

export default function QuotationStatusForm({ quotationId, currentStatus }: Props) {
  const router = useRouter()
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { register, handleSubmit, watch } = useForm<{ status: string; rejectionReason?: string }>(
    { defaultValues: { status: currentStatus } }
  )

  const selectedStatus = watch("status")

  async function onSubmit(values: { status: string; rejectionReason?: string }) {
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch(`/api/quotations/${quotationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Failed to update status")
        return
      }
      setSuccess("Status updated")
      setTimeout(() => router.refresh(), 400)
    } catch (err: any) {
      setError(err.message || "Unexpected error")
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      {success && <div className="rounded-lg border border-green-200 bg-green-50 p-2 text-sm text-green-700">{success}</div>}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</div>}

      <div>
        <Label htmlFor="status">Status</Label>
        <select id="status" {...register("status")} className="w-full rounded border p-2">
          {['DRAFT','SENT','VIEWED','APPROVED','PROCESSING','READY','REJECTED','EXPIRED','COMPLETED'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {selectedStatus === "REJECTED" && (
        <div>
          <Label htmlFor="rejectionReason">Rejection Reason</Label>
          <Input id="rejectionReason" {...register("rejectionReason")} />
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit">Update Status</Button>
      </div>
    </form>
  )
}
