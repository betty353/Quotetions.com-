"use client"

import ExportXlsxButton from "@/components/export/ExportXlsxButton"
import PartialPaymentButton from "@/components/payments/PartialPaymentButton"
import QuickSettleButton from "@/components/payments/QuickSettleButton"

interface ReconciliationExportRow {
  quotationId: string
  quotationNumber: string
  customer: string
  total: number
  paid: number
  outstanding: number
  status: string
}

export function ReconciliationExportActions({
  rows,
  filename,
}: {
  rows: ReconciliationExportRow[]
  filename: string
}) {
  function exportCsv() {
    const headers = ["quotationId", "quotationNumber", "customer", "total", "paid", "outstanding", "status"]
    const lines = [headers.join(",")]

    for (const row of rows) {
      const values = headers.map((header) => {
        const value = row[header as keyof ReconciliationExportRow]
        return `"${String(value ?? "").replace(/"/g, '""')}"`
      })
      lines.push(values.join(","))
    }

    const blob = new Blob([lines.join("\n")], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${filename}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex items-center justify-end mb-3 gap-2">
      <button onClick={exportCsv} className="px-3 py-1 bg-slate-100 rounded">
        Export CSV
      </button>
      <ExportXlsxButton rows={rows} filename={filename} />
    </div>
  )
}

export function ReconciliationPaymentActions({
  quotationId,
  outstanding,
}: {
  quotationId: string
  outstanding: number
}) {
  if (outstanding <= 0) return null

  return (
    <>
      <QuickSettleButton quotationId={quotationId} amount={outstanding} />
      <PartialPaymentButton quotationId={quotationId} outstanding={outstanding} />
    </>
  )
}
