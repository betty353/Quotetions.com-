import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import Link from "next/link"
import ProductForm from "@/components/products/ProductForm"
import SafeImage from "@/components/ui/safe-image"
import { Badge } from "@/components/ui/badge"
import { formatCurrency, formatDateTime } from "@/lib/utils"

interface Props {
  params: Promise<{ id: string }>
}

export default async function ProductDetailPage({ params }: Props) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) redirect('/dashboard')

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      category: true,
      quotationItems: true,
      stockMovements: { orderBy: { createdAt: "desc" }, take: 12 },
    },
  })
  if (!product) return <div className="text-center py-12">Product not found</div>

  const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } })
  const gallery = Array.isArray(product.images) ? product.images.filter((image): image is string => typeof image === "string") : []
  const mediaImages = [product.image, ...gallery].filter(Boolean) as string[]
  const sold = product.quotationItems.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{product.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">Product details and edit.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/products" className="text-sm text-blue-600 hover:underline">Back to products</Link>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Product Details</CardTitle>
            <CardDescription>Images, media, price, stock, and sales position.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {mediaImages.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {mediaImages.slice(0, 5).map((image, index) => (
                  <div key={`${image}-${index}`} className={index === 0 ? "sm:col-span-2" : ""}>
                    <SafeImage src={image} alt={`${product.name} image ${index + 1}`} width={720} height={420} className="h-52 w-full rounded-xl border object-cover sm:h-64" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-56 items-center justify-center rounded-xl border bg-slate-50 text-sm text-muted-foreground">No product images yet.</div>
            )}

            <div className="grid gap-3 sm:grid-cols-4">
              <div className="rounded-lg border bg-slate-50 p-4">
                <p className="text-xs text-muted-foreground">Price</p>
                <p className="mt-1 font-semibold">{formatCurrency(product.unitPrice, product.currency)}</p>
              </div>
              <div className="rounded-lg border bg-slate-50 p-4">
                <p className="text-xs text-muted-foreground">Stock</p>
                <p className="mt-1 font-semibold">{product.stock}</p>
              </div>
              <div className="rounded-lg border bg-slate-50 p-4">
                <p className="text-xs text-muted-foreground">Sold</p>
                <p className="mt-1 font-semibold">{sold}</p>
              </div>
              <div className="rounded-lg border bg-slate-50 p-4">
                <p className="text-xs text-muted-foreground">Status</p>
                <Badge className="mt-1">{product.stock <= 0 ? "SOLD OUT" : product.status}</Badge>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {product.shortVideoUrl && <a href={product.shortVideoUrl} target="_blank" rel="noreferrer" className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-50">Open short video</a>}
              {product.view360Url && <a href={product.view360Url} target="_blank" rel="noreferrer" className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-50">Open 360 view</a>}
              {product.isFeatured && <Badge variant="secondary">Featured product</Badge>}
            </div>

            {product.description && (
              <div>
                <p className="text-sm font-semibold">Description</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{product.description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Stock Movement History</CardTitle>
            <CardDescription>Recent stock in/out, damaged, lost, and adjustment records.</CardDescription>
          </CardHeader>
          <CardContent>
            {product.stockMovements.length === 0 ? (
              <p className="rounded-lg border bg-slate-50 p-4 text-sm text-muted-foreground">No stock movement recorded yet.</p>
            ) : (
              <div className="space-y-3">
                {product.stockMovements.map((movement) => (
                  <div key={movement.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <Badge variant={movement.type === "STOCK_IN" ? "success" : movement.type === "DAMAGED" || movement.type === "LOST" ? "destructive" : "default"}>{movement.type}</Badge>
                      <span className="text-xs text-muted-foreground">{formatDateTime(movement.createdAt)}</span>
                    </div>
                    <p className="mt-2 text-sm">Qty {movement.quantity}: {movement.previousStock} to {movement.newStock}</p>
                    {(movement.reason || movement.reference) && <p className="mt-1 text-xs text-muted-foreground">{movement.reason || "-"} {movement.reference ? `| ${movement.reference}` : ""}</p>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Edit Product</CardTitle>
          <CardDescription>Edit product details below.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProductForm categories={categories.map(c => ({ id: c.id, name: c.name }))} initial={product} mode="edit" />
        </CardContent>
      </Card>
    </div>
  )
}
