"use client"

import React, { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { createQuotationSchema } from "@/lib/schemas"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ApiResponse, CreateQuotationInput } from "@/types"

interface ProductOption {
  id: string
  name: string
  unitPrice: string
}

interface CustomerOption {
  id: string
  companyName?: string | null
  contactPerson?: string | null
  email?: string
}

interface QuotationFormProps {
  products: ProductOption[]
  customers: CustomerOption[]
  customerRole: string
}

interface FormValues extends CreateQuotationInput {
  customerId: string
  items: Array<{ productId: string; quantity: number; discount: number }>
}

export default function QuotationForm({ products, customers, customerRole }: QuotationFormProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const isCustomer = customerRole === "CUSTOMER"
  const isEmployee = customerRole === "EMPLOYEE"
  const canApplyDiscount = ["SUPER_ADMIN", "COMPANY_ADMIN", "ADMIN"].includes(customerRole)
  const canRequestDiscount = isEmployee

  const { register, control, handleSubmit, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(createQuotationSchema),
    defaultValues: {
      customerId: customers[0]?.id || "",
      items: [{ productId: products[0]?.id || "", quantity: 1, discount: 0 }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: "items" })
  const watchedItems = watch("items")

  const totals = useMemo(() => {
    return watchedItems.reduce(
      (acc, item) => {
        const product = products.find((p) => p.id === item.productId)
        const unitPrice = product ? Number(product.unitPrice) : 0
        const subtotal = item.quantity * unitPrice
        const discount = item.discount || 0
        acc.subtotal += subtotal
        acc.discount += discount
        acc.total += Math.max(0, subtotal - discount)
        return acc
      },
      { subtotal: 0, discount: 0, total: 0 }
    )
  }, [watchedItems, products])

  async function onSubmit(values: FormValues) {
    setError(null)
    setSuccess(null)

    try {
      const validUntilValue = values.validUntil
      const payload: CreateQuotationInput = {
        customerId: values.customerId,
        items: values.items,
        notes: values.notes,
        terms: values.terms,
        validUntil: validUntilValue ? new Date(validUntilValue).toISOString() : undefined,
      }

      const res = await fetch("/api/quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      })

      const data: ApiResponse = await res.json()
      if (!res.ok) {
        setError(data.error || "Failed to create quotation")
        return
      }

      if ((data as any).discountRequest) {
        setSuccess("Discount request sent to admin. The quotation will be created after approval.")
        return
      }

      router.push("/dashboard/quotations")
    } catch (err: any) {
      setError(err.message || "Unexpected error")
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">{success}</div>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="customerId">Customer</Label>
          <select id="customerId" {...register("customerId")} className="w-full rounded border p-2">
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.companyName || customer.contactPerson || customer.email || "Customer"}
              </option>
            ))}
          </select>
          {errors.customerId && <p className="text-sm text-red-600">{errors.customerId.message}</p>}
        </div>

        <div>
          <Label htmlFor="validUntil">Valid Until</Label>
          <Input id="validUntil" type="date" {...register("validUntil") as any} />
          {errors.validUntil && <p className="text-sm text-red-600">{errors.validUntil.message}</p>}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label>Quotation Items</Label>
            <p className="text-xs text-muted-foreground">{isCustomer ? "Add products and quantities for your quotation request." : canApplyDiscount ? "Add products, quantities, and approved discounts." : "Add products and request admin approval for any discount."}</p>
          </div>
          <Button type="button" variant="secondary" onClick={() => append({ productId: products[0]?.id || "", quantity: 1, discount: 0 })}>
            Add Item
          </Button>
        </div>

        <div className="space-y-4">
          {fields.map((field, index) => (
            <div key={field.id} className="grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-4">
              <div className="sm:col-span-2">
                <Label>Product</Label>
                <select {...register(`items.${index}.productId` as const)} className="w-full rounded border p-2">
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>{product.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label>Quantity</Label>
                <Input type="number" min="1" {...register(`items.${index}.quantity` as const, { valueAsNumber: true })} />
              </div>

              <div>
                <Label>{canRequestDiscount ? "Discount Request" : "Discount"}</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  disabled={isCustomer || (!canApplyDiscount && !canRequestDiscount)}
                  {...register(`items.${index}.discount` as const, { valueAsNumber: true })}
                />
                {isCustomer && <p className="mt-1 text-xs text-muted-foreground">Discounts are handled by the company.</p>}
              </div>

              <div className="flex items-end justify-end">
                <Button type="button" variant="destructive" onClick={() => remove(index)}>
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs text-muted-foreground">Subtotal</p>
          <p className="mt-2 text-xl font-semibold">${totals.subtotal.toFixed(2)}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs text-muted-foreground">Discount</p>
          <p className="mt-2 text-xl font-semibold">-${totals.discount.toFixed(2)}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="mt-2 text-xl font-semibold">${totals.total.toFixed(2)}</p>
        </div>
      </div>

      <div>
        <Label htmlFor="notes">Customer Notes</Label>
        <Textarea id="notes" {...register("notes")} rows={4} />
      </div>

      <div>
        <Label htmlFor="terms">Terms</Label>
        <Textarea id="terms" {...register("terms")} rows={4} />
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit">Create Quotation</Button>
        <Button variant="ghost" type="button" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
