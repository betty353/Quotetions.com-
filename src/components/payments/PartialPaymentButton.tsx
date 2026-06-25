"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"

interface Props {
  quotationId: string
  outstanding: number
}

export default function PartialPaymentButton({ quotationId, outstanding }: Props) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState(outstanding.toFixed(2))
  const [method, setMethod] = useState('CASH')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setError(null)
    const amt = Number(amount)
    if (!amt || amt <= 0) return setError('Enter a valid amount')
    setLoading(true)
    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quotationId, amount: amt, method, paymentDate: new Date().toISOString(), reference: 'Partial payment', notes: '' }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to record payment')
      location.reload()
    } catch (err: any) {
      setError(err.message || 'Unexpected error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <Button onClick={() => setOpen(true)} variant="ghost">Record Payment</Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded bg-white p-6">
            <h3 className="text-lg font-semibold mb-2">Record Payment</h3>
            <div className="space-y-2">
              <label className="block">
                <div className="text-sm text-muted-foreground">Amount</div>
                <input className="w-full rounded border p-2" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </label>
              <label className="block">
                <div className="text-sm text-muted-foreground">Method</div>
                <select className="w-full rounded border p-2" value={method} onChange={(e) => setMethod(e.target.value)}>
                  <option value="CASH">CASH</option>
                  <option value="BANK_TRANSFER">BANK_TRANSFER</option>
                  <option value="MOBILE_MONEY">MOBILE_MONEY</option>
                  <option value="CARD">CARD</option>
                  <option value="CHEQUE">CHEQUE</option>
                  <option value="OTHER">OTHER</option>
                </select>
              </label>
              {error && <div className="text-sm text-red-600">{error}</div>}
              <div className="flex items-center gap-2 justify-end mt-4">
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={submit} disabled={loading}>{loading ? 'Recording...' : 'Record'}</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
