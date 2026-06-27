"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { createPaymentSchema } from "@/lib/schemas"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ApiResponse, CreatePaymentInput } from "@/types"

interface PaymentFormProps {
  quotationId: string
  customerId: string
  quotationTotal: number
}

export default function PaymentForm({ quotationId, customerId, quotationTotal }: PaymentFormProps) {
  const router = useRouter()
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreatePaymentInput>({
    resolver: zodResolver(createPaymentSchema) as any,
    defaultValues: {
      quotationId,
      customerId,
      amount: quotationTotal,
      method: "CASH",
      paymentDate: new Date().toISOString().split("T")[0],
      reference: "",
      notes: "",
    },
  })

  async function onSubmit(values: CreatePaymentInput) {
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(values),
      })
      const data: ApiResponse = await res.json()
      if (!res.ok) {
        setError(data.error || "Failed to record payment")
        return
      }
      setSuccess("Payment recorded successfully")
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
          <Label htmlFor="method">Payment Method</Label>
          <select id="method" {...register("method")} className="w-full rounded border p-2">
            {['CASH', 'BANK_TRANSFER', 'MOBILE_MONEY', 'CARD', 'CHEQUE', 'AIRTEL_MONEY', 'MTN_MOBILE_MONEY', 'ZAMTEL_KWACHA', 'OTHER'].map((method) => (
              <option key={method} value={method}>{method.replace('_', ' ')}</option>
            ))}
          </select>
          {errors.method && <p className="text-sm text-red-600">{errors.method.message}</p>}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="paymentDate">Payment Date</Label>
          <Input id="paymentDate" type="date" {...register("paymentDate" as any)} />
          {errors.paymentDate && <p className="text-sm text-red-600">{errors.paymentDate.message}</p>}
        </div>

        <div>
          <Label htmlFor="reference">Reference</Label>
          <Input id="reference" {...register("reference")} />
        </div>
      </div>

      <div>
        <Label htmlFor="notes">Notes</Label>
        <textarea id="notes" {...register("notes")} className="w-full rounded border p-2" rows={3} />
      </div>

      <Button type="submit">Record Payment</Button>
    </form>
  )
}
