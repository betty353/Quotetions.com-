import Link from "next/link"
import { getServerSession } from "next-auth"
import { Search, ShoppingCart } from "lucide-react"
import SafeImage from "@/components/ui/safe-image"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

function safeImageSrc(value?: string | null) {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.startsWith("/") || trimmed.startsWith("data:image/") || trimmed.startsWith("blob:")) return trimmed

  try {
    const url = new URL(trimmed)
    return url.protocol === "http:" || url.protocol === "https:" ? trimmed : null
  } catch {
    return null
  }
}

type StorePageProps = {
  params: Promise<{ companySlug: string }>
  searchParams?: Promise<{ q?: string; category?: string }>
}

export default async function StorePage({ params, searchParams }: StorePageProps) {
  const session = await getServerSession(authOptions)
  const resolvedParams = await params
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const query = resolvedSearchParams.q?.trim() || ""
  const category = resolvedSearchParams.category?.trim() || ""
  const company = await prisma.company.findUnique({
    where: { slug: resolvedParams.companySlug },
    include: {
      settings: true,
      categories: {
        where: { products: { some: { status: "ACTIVE" } } },
        orderBy: { name: "asc" },
      },
      products: {
        where: {
          status: "ACTIVE",
          ...(query
            ? {
                OR: [
                  { name: { contains: query, mode: "insensitive" } },
                  { description: { contains: query, mode: "insensitive" } },
                  { sku: { contains: query, mode: "insensitive" } },
                ],
              }
            : {}),
          ...(category ? { category: { name: category } } : {}),
        },
        include: { category: true },
        orderBy: { name: "asc" },
      },
    },
  })

  if (!company || !company.isActive) {
    return (
      <main className="min-h-screen bg-background">
        <section className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-4 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">Store not found</h1>
          <p className="mt-3 text-sm text-muted-foreground">This customer store link is not active. Ask the company to share the latest catalog link from Company Settings.</p>
          <Link href="/" className="mt-6 inline-flex h-10 items-center justify-center rounded-lg border border-input bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-accent">
            Go home
          </Link>
        </section>
      </main>
    )
  }

  const currency = company.settings?.defaultCurrency || "ZMW"
  const logoSrc = safeImageSrc(company.logoUrl || company.settings?.companyLogo)
  const isCustomer = session?.user?.role === "CUSTOMER"
  const customerCta = isCustomer
    ? `/dashboard/quotations/new?companySlug=${company.slug}`
    : `/auth/register?type=customer&companySlug=${company.slug}`

  return (
    <main className="min-h-screen bg-background">
      <section className="border-b bg-surface">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border bg-card">
              {logoSrc ? (
                <SafeImage src={logoSrc} alt={`${company.name} logo`} width={64} height={64} className="h-full w-full object-cover" />
              ) : (
                <span className="text-xl font-semibold">{company.name.slice(0, 1)}</span>
              )}
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">{company.name}</h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{company.about || "Browse products and services, then request a quotation from this company."}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                {company.email && <Badge>{company.email}</Badge>}
                {company.phone && <Badge>{company.phone}</Badge>}
                {company.city && <Badge>{company.city}</Badge>}
              </div>
            </div>
          </div>
          <Link
            href={customerCta}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-[0_1px_2px_rgba(37,99,235,0.18)] transition-all duration-200 hover:-translate-y-px hover:bg-primary/90"
          >
            <ShoppingCart className="h-4 w-4" />
            {isCustomer ? "Request quotation" : "Customer account"}
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-8">
        <form className="mb-6 grid gap-3 md:grid-cols-[1fr_220px_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input name="q" defaultValue={query} placeholder="Search products and services" className="pl-9" />
          </div>
          <select name="category" defaultValue={category} className="h-10 rounded-lg border border-input bg-card px-3 text-sm">
            <option value="">All categories</option>
            {company.categories.map((item) => (
              <option key={item.id} value={item.name}>{item.name}</option>
            ))}
          </select>
          <button type="submit" className="inline-flex h-10 items-center justify-center rounded-lg border border-input bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-accent">Filter</button>
        </form>

        {company.products.length === 0 ? (
          <div className="rounded-xl border bg-card p-10 text-center">
            <h2 className="text-lg font-medium">No products found</h2>
            <p className="mt-2 text-sm text-muted-foreground">Try another search or contact the company directly.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {company.products.map((product) => (
              <StoreProductCard key={product.id} product={product} currency={currency} customerCta={customerCta} />
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

function StoreProductCard({ product, currency, customerCta }: { product: any; currency: string; customerCta: string }) {
  const productImage = safeImageSrc(product.image)

  return (
    <Card className="overflow-hidden">
      {productImage && (
        <div className="aspect-[4/3] border-b bg-surface">
          <SafeImage src={productImage} alt={product.name} width={480} height={360} className="h-full w-full object-cover" />
        </div>
      )}
      <CardContent className="space-y-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Badge>{product.category?.name || "Catalog"}</Badge>
            <h2 className="mt-2 text-base font-semibold">{product.name}</h2>
          </div>
          <p className="text-sm font-semibold">{currency} {Number(product.unitPrice).toFixed(2)}</p>
        </div>
        {product.description && <p className="line-clamp-3 text-sm text-muted-foreground">{product.description}</p>}
        <Link
          href={customerCta}
          className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-input bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
        >
          Request quotation
        </Link>
      </CardContent>
    </Card>
  )
}
