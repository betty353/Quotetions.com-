import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import Link from "next/link"
import ProductsActions from "@/components/products/ProductsActions"
import ProductsTable from "@/components/products/ProductsTable"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { FileText } from "lucide-react"

export default async function ProductsPage() {
  const session = await getServerSession(authOptions)
  if (!session) return null

  const products = await prisma.product.findMany({
    where: {},
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { category: true },
  })

  const importSummary = await prisma.productImportHistory.findFirst({
    orderBy: { createdAt: "desc" },
    include: { importedBy: true },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your product catalog.</p>
        </div>
        <div className="flex items-center gap-4">
          <ProductsActions />
          {(session.user as any).role === "ADMIN" && (
            <Link href="/dashboard/products/new" className="text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-md text-sm">
              Add Product
            </Link>
          )}
        </div>
      </div>

      {importSummary && (
        <Card>
          <CardHeader>
            <CardTitle>Latest Import</CardTitle>
            <CardDescription>Quick overview of the most recent CSV import.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase text-slate-500">Imported By</div>
              <div className="mt-2 font-semibold">{importSummary.importedBy?.email || importSummary.importedById}</div>
              <div className="text-xs text-slate-500">{importSummary.importedBy?.role || "ADMIN"}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase text-slate-500">Products Created</div>
              <div className="mt-2 font-semibold">{importSummary.createdCount}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase text-slate-500">Errors</div>
              <div className="mt-2 font-semibold">{importSummary.errorCount}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase text-slate-500">Last Imported</div>
              <div className="mt-2 font-semibold">{new Date(importSummary.createdAt).toLocaleString()}</div>
              <Link href="/dashboard/products/import-history" className="mt-2 inline-block text-xs text-blue-600 hover:underline">View history</Link>
            </div>
          </CardContent>
        </Card>
      )}

      {products.length === 0 ? (
        <Card className="text-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <p className="text-muted-foreground mb-4">No products in your catalog yet.</p>
          <p className="text-sm text-muted-foreground">Add products from the settings to start creating quotations.</p>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Product Catalog</CardTitle>
            <CardDescription>All active and inactive products</CardDescription>
          </CardHeader>
          <CardContent>
            <ProductsTable products={products.map((p) => ({
              id: p.id,
              sku: p.sku,
              name: p.name,
              image: p.image,
              category: p.category,
              unitPrice: String(p.unitPrice),
              currency: p.currency,
              stock: p.stock,
              status: p.status,
            }))} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
