"use client"

import React, { useRef, useState } from "react"

function parseCSV(text: string) {
  const rows: string[][] = []
  let cur = ""
  let row: string[] = []
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (ch === "," && !inQuotes) {
      row.push(cur)
      cur = ""
      continue
    }
    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (cur !== "" || row.length > 0) {
        row.push(cur)
        rows.push(row)
        row = []
        cur = ""
      }
      // handle CRLF
      if (ch === "\r" && text[i + 1] === "\n") i++
      continue
    }
    cur += ch
  }
  if (cur !== "" || row.length > 0) {
    row.push(cur)
    rows.push(row)
  }
  const headers = rows[0] || []
  const data = rows.slice(1).map((r) => {
    const obj: any = {}
    for (let i = 0; i < headers.length; i++) obj[headers[i]] = r[i] ?? ""
    return obj
  })
  return data
}

export default function ProductsActions() {
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [importErrors, setImportErrors] = useState<any[] | null>(null)
  const [categoriesCreated, setCategoriesCreated] = useState<string[] | null>(null)
  const [summary, setSummary] = useState<{ createdCount: number; errorCount: number; categoriesCreated: string[] } | null>(null)

  async function handleFile() {
    const file = fileRef.current?.files?.[0]
    if (!file) return
    setIsImporting(true)
    setMessage(null)
    try {
      const text = await file.text()
      const data = parseCSV(text)
      // map CSV headers to expected fields if necessary
      const mapped = data.map((d) => ({
        sku: d.sku || d.SKU || d.Sku || "",
        name: d.name || d.Name || "",
        description: d.description || d.Description || "",
        category: d.category || d.Category || "",
        unitPrice: Number(d.unitPrice || d.UnitPrice || d.price || 0),
        currency: d.currency || d.Currency || "USD",
        stock: Number(d.stock || d.Stock || 0),
        image: d.image || d.Image || "",
        status: d.status || d.Status || "ACTIVE",
      }))

      const res = await fetch("/api/products/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mapped),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Import failed")
      const createdCount = json.created?.length ?? 0
      const errors = json.errors || []
      const categories = json.categoriesCreated || []
      setSummary({ createdCount, errorCount: errors.length, categoriesCreated: categories })
      if (categories.length > 0) {
        setCategoriesCreated(categories)
      } else {
        setCategoriesCreated(null)
      }
      if (errors.length > 0) {
        setImportErrors(errors)
        setMessage(`Imported ${createdCount} products with ${errors.length} errors.`)
      } else {
        setImportErrors(null)
        setMessage(`Imported ${createdCount} products successfully.`)
        // reload page after short delay
        setTimeout(() => location.reload(), 900)
      }
    } catch (err: any) {
      setMessage(err.message || "Import failed")
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <a href="/api/products/export" className="inline-flex items-center px-4 py-2 bg-slate-800 text-white rounded-md text-sm hover:bg-slate-700">Export CSV</a>

      <label className="inline-flex items-center px-4 py-2 bg-white border rounded-md text-sm cursor-pointer">
        <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={() => handleFile()} className="sr-only" />
        {isImporting ? "Importing..." : "Import CSV"}
      </label>

      <a href="/dashboard/products/import-history" className="inline-flex items-center px-4 py-2 bg-white border rounded-md text-sm hover:bg-slate-100">Import History</a>

      <div className="flex items-center gap-3">
        {message && <div className="text-sm text-muted-foreground">{message}</div>}
        {categoriesCreated && categoriesCreated.length > 0 && (
          <div className="ml-2 text-sm text-emerald-700">
            Created {categoriesCreated.length} new category{categoriesCreated.length === 1 ? '' : 'ies'}: {categoriesCreated.join(', ')}
          </div>
        )}
          {summary && (
          <div className="ml-2 rounded border border-slate-200 bg-slate-50 p-3 text-sm">
            <div className="font-semibold">Import summary</div>
            <div>Created: {summary.createdCount}</div>
            <div>Errors: {summary.errorCount}</div>
            {summary.categoriesCreated.length > 0 && (
              <div>Categories created: {summary.categoriesCreated.join(", ")}</div>
            )}
          </div>
        )}
        {importErrors && importErrors.length > 0 && (
          <div className="ml-2">
            <details className="text-sm">
              <summary className="cursor-pointer">Show import errors ({importErrors.length})</summary>
              <div className="mt-2 max-h-48 overflow-auto text-xs bg-white border rounded p-2">
                {importErrors.map((err, i) => (
                  <div key={i} className="mb-2">
                    <div className="font-medium">Row: {String(err.index)}</div>
                    <div className="text-muted-foreground">Error: {String(err.error)}</div>
                    <pre className="text-xs mt-1 bg-slate-50 p-2 rounded">{JSON.stringify(err.item, null, 2)}</pre>
                  </div>
                ))}
                <div className="mt-2">
                  <button
                    onClick={() => {
                      const blob = new Blob([JSON.stringify(importErrors, null, 2)], { type: 'application/json' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `import-errors-${new Date().toISOString()}.json`
                      a.click()
                      URL.revokeObjectURL(url)
                    }}
                    className="px-3 py-1 bg-white border rounded text-sm"
                  >
                    Download Errors (JSON)
                  </button>
                </div>
              </div>
            </details>
          </div>
        )}
      </div>
    </div>
  )
}
