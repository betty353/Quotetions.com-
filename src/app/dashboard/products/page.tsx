import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import Link from "next/link"
import ProductsActions from "@/components/products/ProductsActions"
import ProductsTable from "@/components/products/ProductsTable"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { FileText } from "lucide-react"
import { isCompanyAdminRole } from "@/lib/tenant"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

async function createCategory(formData: FormData) {
  "use server"

  const session = await getServerSession(authOptions)
  if (!session || !isCompanyAdminRole((session.user as any).role)) redirect("/dashboard")

  const companyId = (session.user as any).companyId as string | null
  if (!companyId) redirect("/dashboard")

  const name = String(formData.get("name") || "").trim()
  const description = String(formData.get("description") || "").trim()
  if (!name) redirect("/dashboard/products?error=category-name")

  await prisma.category.upsert({
    where: { companyId_name: { companyId, name } },
    create: { companyId, name, description: description || null },
    update: { description: description || null },
  })

  revalidatePath("/dashboard/products")
  redirect("/dashboard/products?categoryCreated=1")
}

export default async function ProductsPage({ searchParams }: { searchParams?: Promise<{ categoryId?: string; categoryCreated?: string; error?: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return null
  const companyId = (session.user as any).companyId
  const params = await searchParams

  const products = await prisma.product.findMany({
    where: {
      ...(companyId ? { companyId } : {}),
      ...(params?.categoryId ? { categoryId: params.categoryId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      category: true,
      quotationItems: true,
    },
  })

  const categories = await prisma.category.findMany({
    where: companyId ? { companyId } : {},
    include: { _count: { select: { products: true } } },
    orderBy: { name: "asc" },
  })

  const stockValue = products.reduce((sum, product) => sum + Number(product.unitPrice) * product.stock, 0)
  const outOfStock = products.filter((product) => product.stock <= 0).length
  const featured = products.filter((product) => product.isFeatured).length

  const importSummary = await prisma.productImportHistory.findFirst({
    where: companyId ? { companyId } : {},
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
          {isCompanyAdminRole((session.user as any).role) && (
            <Link href="/dashboard/products/new" className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90">
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
              <div className="text-xs text-slate-500">{importSummary.importedBy?.role || "COMPANY_ADMIN"}</div>
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
              <Link href="/dashboard/products/import-history" className="mt-2 inline-block text-xs text-foreground underline-offset-4 hover:underline">View history</Link>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Features / Categories</CardTitle>
          <CardDescription>Create product categories and click one to filter the catalog.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {params?.categoryCreated && <p className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">Category saved.</p>}
          <form action={createCategory} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <Input name="name" placeholder="Category name, e.g. Phones" required />
            <Input name="description" placeholder="Short description" />
            <Button type="submit">Add Category</Button>
          </form>
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/products" className={`rounded-full border px-3 py-1.5 text-sm ${!params?.categoryId ? "bg-neutral-950 text-white" : "bg-white hover:bg-slate-50"}`}>All products</Link>
            {categories.map((category) => (
              <Link key={category.id} href={`/dashboard/products?categoryId=${category.id}`} className={`rounded-full border px-3 py-1.5 text-sm ${params?.categoryId === category.id ? "bg-neutral-950 text-white" : "bg-white hover:bg-slate-50"}`}>
                {category.name} ({category._count.products})
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Products</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{products.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Stock Value</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{stockValue.toLocaleString("en-ZM", { style: "currency", currency: "ZMW" })}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Sold Out</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{outOfStock}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Featured</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{featured}</div></CardContent>
        </Card>
      </div>

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
              sold: p.quotationItems.reduce((sum, item) => sum + item.quantity, 0),
              status: p.status,
            }))} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
