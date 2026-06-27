"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { createReceiptSchema } from "@/lib/schemas"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ApiResponse, CreateReceiptInput } from "@/types"

interface ReceiptFormProps {
  quotationId: string
  customerId: string
  quotationTotal: number
}

export default function ReceiptForm({ quotationId, customerId, quotationTotal }: ReceiptFormProps) {
  const router = useRouter()
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateReceiptInput>({
    resolver: zodResolver(createReceiptSchema) as any,
    defaultValues: {
      quotationId,
      customerId,
      amount: quotationTotal,
      paymentMethod: "CASH",
      reference: "",
      notes: "",
    },
  })

  async function onSubmit(values: CreateReceiptInput) {
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch("/api/receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })
      const data: ApiResponse = await res.json()
      if (!res.ok) {
        setError(data.error || "Failed to generate receipt")
        return
      }
      setSuccess("Receipt generated successfully")
      setTimeout(() => {
        router.refresh()
      }, 500)
    } catch (err: any) {
      setError(err.message || "Unexpected error")
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {success && <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">{success}</div>}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="amount">Amount</Label>
          <Input id="amount" type="number" step="0.01" {...register("amount", { valueAsNumber: true })} />
          {errors.amount && <p className="text-sm text-red-600">{errors.amount.message}</p>}
        </div>

        <div>
          <Label htmlFor="paymentMethod">Payment Method</Label>
          <select id="paymentMethod" {...register("paymentMethod")} className="w-full rounded border p-2">
            {['CASH', 'BANK_TRANSFER', 'MOBILE_MONEY', 'CARD', 'CHEQUE', 'AIRTEL_MONEY', 'MTN_MOBILE_MONEY', 'ZAMTEL_KWACHA', 'OTHER'].map((method) => (
              <option key={method} value={method}>{method.replace('_', ' ')}</option>
            ))}
          </select>
          {errors.paymentMethod && <p className="text-sm text-red-600">{errors.paymentMethod.message}</p>}
        </div>
      </div>

      <div>
        <Label htmlFor="reference">Reference</Label>
        <Input id="reference" {...register("reference")} />
      </div>

      <div>
        <Label htmlFor="notes">Notes</Label>
        <textarea id="notes" {...register("notes")} className="w-full rounded border p-2" rows={3} />
      </div>

      <Button type="submit">Generate Receipt</Button>
    </form>
  )
}
