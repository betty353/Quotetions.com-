import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

function toCSV(rows: any[]) {
  if (!rows || rows.length === 0) return ""
  const headers = Object.keys(rows[0])
  const lines = [headers.join(",")]
  for (const row of rows) {
    const vals = headers.map((h) => {
      const v = row[h]
      if (v === null || v === undefined) return ""
      const s = typeof v === "string" ? v : String(v)
      return `"${s.replace(/"/g, '""')}"`
    })
    lines.push(vals.join(","))
  }
  return lines.join("\n")
}

export async function GET(request: NextRequest) {
  const products = await prisma.product.findMany({ include: { category: true } })
  const rows = products.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    description: p.description,
    category: p.category?.name || "",
    unitPrice: p.unitPrice.toString(),
    currency: p.currency,
    stock: p.stock,
    status: p.status,
    image: p.image || "",
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }))

  const csv = toCSV(rows)

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="products-${new Date().toISOString()}.csv"`,
    },
  })
}
