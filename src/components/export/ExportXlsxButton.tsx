"use client"

import React, { useState } from "react"

interface Props {
  rows: Array<any>
  filename?: string
}

export default function ExportXlsxButton({ rows, filename = 'export' }: Props) {
  const [loading, setLoading] = useState(false)

  async function handleExport() {
    setLoading(true)
    try {
      const xlsx = await import('xlsx')
      const ws = xlsx.utils.json_to_sheet(rows)
      const wb = xlsx.utils.book_new()
      xlsx.utils.book_append_sheet(wb, ws, 'Sheet1')
      const wbout = xlsx.write(wb, { bookType: 'xlsx', type: 'array' })
      const blob = new Blob([wbout], { type: 'application/octet-stream' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${filename}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error(err)
      alert('Failed to export XLSX')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button onClick={handleExport} disabled={loading} className="px-3 py-1 bg-slate-100 rounded">
      {loading ? 'Exporting...' : 'Export XLSX'}
    </button>
  )
}
