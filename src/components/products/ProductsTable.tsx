"use client"

import React, { useState } from "react"
import Link from "next/link"
import { formatCurrency } from "@/lib/utils"
import SafeImage from "@/components/ui/safe-image"

interface Product {
  id: string
  sku?: string
  name: string
  image?: string | null
  category?: { id: string; name: string } | null
  unitPrice: string | number
  currency: string
  stock: number
  sold?: number
  status: string
}

export default function ProductsTable({ products }: { products: Product[] }) {
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [processing, setProcessing] = useState(false)

  function toggle(id: string) {
    setSelected((s) => ({ ...s, [id]: !s[id] }))
  }

  function selectAll() {
    const all: Record<string, boolean> = {}
    products.forEach((p) => (all[p.id] = true))
    setSelected(all)
  }

  function clearAll() {
    setSelected({})
  }

  const selectedIds = Object.keys(selected).filter((k) => selected[k])

  async function handleDeleteSelected() {
    if (selectedIds.length === 0) return
    if (!confirm(`Delete ${selectedIds.length} products? This cannot be undone.`)) return
    setProcessing(true)
    try {
      for (const id of selectedIds) {
        await fetch(`/api/products/${id}`, { method: "DELETE", credentials: "include" })
      }
      location.reload()
    } catch (err) {
      console.error(err)
      alert("Failed to delete some items")
    } finally {
      setProcessing(false)
    }
  }

  async function handleDeleteOne(id: string, name: string) {
    if (!confirm(`Remove ${name} from active products? Existing quotations will stay safe.`)) return
    setProcessing(true)
    try {
      const res = await fetch(`/api/products/${id}`, { method: "DELETE", credentials: "include" })
      if (!res.ok) throw new Error("Failed to remove product")
      location.reload()
    } catch (err) {
      console.error(err)
      alert("Failed to remove product")
    } finally {
      setProcessing(false)
    }
  }

  function exportSelected() {
    const rows = products.filter((p) => selected[p.id]).map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      category: p.category?.name || "",
      unitPrice: String(p.unitPrice),
      currency: p.currency,
      stock: String(p.stock),
      status: p.status,
      image: p.image || "",
    }))
    if (rows.length === 0) return alert("No products selected")
    const headers = Object.keys(rows[0])
    const lines = [headers.join(",")]
    for (const r of rows) {
      const vals = headers.map((h) => `"${String((r as any)[h] ?? "").replace(/"/g, '""')}"`)
      lines.push(vals.join(","))
    }
    const csv = lines.join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `products-selected-${new Date().toISOString()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <button onClick={selectAll} className="px-3 py-1 bg-slate-100 rounded">Select All</button>
        <button onClick={clearAll} className="px-3 py-1 bg-slate-100 rounded">Clear</button>
        <button onClick={exportSelected} className="px-3 py-1 bg-white border rounded">Export Selected</button>
        <button onClick={handleDeleteSelected} disabled={processing} className="px-3 py-1 bg-red-600 text-white rounded">{processing ? 'Processing...' : 'Delete Selected'}</button>
        <Link href="/dashboard/products/new" className="ml-auto rounded bg-primary px-3 py-1 text-primary-foreground hover:bg-primary/90">Add Product</Link>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full table-auto border-collapse">
          <thead>
            <tr className="text-left text-sm text-muted-foreground border-b">
              <th className="p-3"></th>
              <th className="p-3">SKU</th>
              <th className="p-3">Image</th>
              <th className="p-3">Name</th>
              <th className="p-3">Category</th>
              <th className="p-3">Price</th>
              <th className="p-3">Stock</th>
              <th className="p-3">Sold</th>
              <th className="p-3">Status</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-b">
                <td className="p-3 text-sm"><input type="checkbox" checked={!!selected[p.id]} onChange={() => toggle(p.id)} /></td>
                <td className="p-3 text-sm">{p.sku}</td>
                <td className="p-3 text-sm">
                  {p.image ? <SafeImage src={p.image} alt={p.name} width={48} height={48} className="h-12 w-12 rounded object-cover" /> : <div className="w-12 h-12 bg-slate-100 rounded flex items-center justify-center text-xs text-muted-foreground">No Image</div>}
                </td>
                <td className="p-3 text-sm">
                  <Link href={`/dashboard/products/${p.id}`} className="font-medium underline-offset-4 hover:underline">{p.name}</Link>
                </td>
                <td className="p-3 text-sm">{p.category?.name || '-'}</td>
                <td className="p-3 text-sm">{formatCurrency(String(p.unitPrice), p.currency)}</td>
                <td className="p-3 text-sm">
                  <div className="font-medium">{p.stock}</div>
                  <div className={`text-xs ${p.stock <= 0 ? "text-red-600" : p.stock <= 5 ? "text-amber-600" : "text-emerald-600"}`}>
                    {p.stock <= 0 ? "Sold out" : p.stock <= 5 ? "Low stock" : "In stock"}
                  </div>
                </td>
                <td className="p-3 text-sm">{p.sold ?? 0}</td>
                <td className="p-3 text-sm">{p.status}</td>
                <td className="p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Link href={`/dashboard/products/${p.id}`} className="text-foreground underline-offset-4 hover:underline">View</Link>
                    <button
                      type="button"
                      disabled={processing}
                      onClick={() => handleDeleteOne(p.id, p.name)}
                      className="text-red-600 underline-offset-4 hover:underline disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
