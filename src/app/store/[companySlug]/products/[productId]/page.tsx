import Link from "next/link"
import { getServerSession } from "next-auth"
import { ArrowLeft, Box, MessageCircle, PlayCircle, Rotate3D, ShoppingCart } from "lucide-react"
import SafeImage from "@/components/ui/safe-image"
import { Badge } from "@/components/ui/badge"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { formatCurrency } from "@/lib/utils"
import ProductViewTracker from "@/components/store/ProductViewTracker"

type Props = {
  params: Promise<{ companySlug: string; productId: string }>
}

function safeImages(product: { image?: string | null; images?: unknown }) {
  const gallery = Array.isArray(product.images) ? product.images.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : []
  return [product.image, ...gallery].filter(Boolean) as string[]
}

export default async function StoreProductDetailPage({ params }: Props) {
  const { companySlug, productId } = await params
  const session = await getServerSession(authOptions)

  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      status: "ACTIVE",
      company: { slug: companySlug, isActive: true },
    },
    include: {
      category: true,
      company: { include: { settings: true } },
    },
  })

  if (!product || !product.company) {
    return (
      <main className="min-h-screen bg-[#f5f6f8] px-4 py-12">
        <div className="mx-auto max-w-xl rounded-xl border bg-white p-8 text-center">
          <Box className="mx-auto mb-4 h-12 w-12 text-orange-500" />
          <h1 className="text-2xl font-bold">Product not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">This product is not available in the current store.</p>
          <Link href={`/store/${companySlug}`} className="mt-5 inline-flex rounded-lg border px-4 py-2 text-sm">Back to store</Link>
        </div>
      </main>
    )
  }

  const images = safeImages(product)
  const isCustomer = session?.user?.role === "CUSTOMER"
  const customerCta = isCustomer
    ? `/dashboard/quotations/new?companySlug=${product.company.slug}`
    : `/auth/register?type=customer&companySlug=${product.company.slug}`

  return (
    <main className="min-h-screen bg-[#f5f6f8] text-foreground">
      <ProductViewTracker companySlug={product.company.slug} productId={product.id} />
      <header className="border-b bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <Link href={`/store/${product.company.slug}`} className="inline-flex items-center gap-2 text-sm font-medium">
            <ArrowLeft className="h-4 w-4" />
            Back to {product.company.name}
          </Link>
          <Link href={customerCta} className="inline-flex h-10 items-center gap-2 rounded-lg bg-neutral-950 px-4 text-sm font-semibold text-white">
            <ShoppingCart className="h-4 w-4 text-orange-300" />
            Add to quotation
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          {images[0] ? (
            <SafeImage src={images[0]} alt={product.name} width={900} height={620} className="h-[420px] w-full rounded-xl border bg-white object-cover" />
          ) : (
            <div className="flex h-[420px] items-center justify-center rounded-xl border bg-white">
              <Box className="h-16 w-16 text-orange-500" />
            </div>
          )}
          {images.length > 1 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {images.slice(1, 5).map((image, index) => (
                <SafeImage key={`${image}-${index}`} src={image} alt={`${product.name} gallery ${index + 1}`} width={240} height={180} className="h-32 w-full rounded-lg border bg-white object-cover" />
              ))}
            </div>
          )}
        </div>

        <aside className="rounded-xl border bg-white p-6">
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-orange-50 text-orange-700 hover:bg-orange-100">{product.category?.name || "Product"}</Badge>
            {product.isFeatured && <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-100">Featured</Badge>}
            <Badge variant={product.stock <= 0 ? "destructive" : "success"}>{product.stock <= 0 ? "Sold out" : "In stock"}</Badge>
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight">{product.name}</h1>
          <p className="mt-3 text-2xl font-bold text-orange-700">{formatCurrency(product.unitPrice, product.currency)}</p>
          <p className="mt-2 text-sm text-muted-foreground">Available stock: {product.stock}</p>
          {product.description && <p className="mt-5 leading-7 text-muted-foreground">{product.description}</p>}

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={customerCta} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-orange-600 px-5 text-sm font-semibold text-white hover:bg-orange-700">
              <MessageCircle className="h-4 w-4" />
              Request quotation
            </Link>
            {product.shortVideoUrl && (
              <a href={product.shortVideoUrl} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border px-5 text-sm font-semibold hover:bg-slate-50">
                <PlayCircle className="h-4 w-4 text-blue-600" />
                Short video
              </a>
            )}
            {product.view360Url && (
              <a href={product.view360Url} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border px-5 text-sm font-semibold hover:bg-slate-50">
                <Rotate3D className="h-4 w-4 text-violet-600" />
                360 view
              </a>
            )}
          </div>

          <div className="mt-8 rounded-xl border bg-slate-50 p-4">
            <p className="text-sm font-semibold">{product.company.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">{product.company.about || "Products and services are managed directly by this company."}</p>
          </div>
        </aside>
      </section>
    </main>
  )
}
