import Link from "next/link"
import type { ReactNode } from "react"
import { getServerSession } from "next-auth"
import { BadgeCheck, Building2, Grid3X3, Mail, MapPin, MessageCircle, PackageSearch, Phone, Search, ShieldCheck, ShoppingCart, Sparkles, Store, Truck } from "lucide-react"
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

function storeHref(companySlug: string, params: { q?: string; category?: string }) {
  const search = new URLSearchParams()
  if (params.q) search.set("q", params.q)
  if (params.category) search.set("category", params.category)
  const queryString = search.toString()
  return `/store/${companySlug}${queryString ? `?${queryString}` : ""}`
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
  const featuredProduct = company.products.find((product) => safeImageSrc(product.image)) || company.products[0]
  const featuredImage = safeImageSrc(featuredProduct?.image)

  return (
    <main className="min-h-screen bg-[#f5f6f8] text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4">
          <Link href={`/store/${company.slug}`} className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-white">
              {logoSrc ? (
                <SafeImage src={logoSrc} alt={`${company.name} logo`} width={40} height={40} className="h-full w-full object-cover" />
              ) : (
                <Store className="h-5 w-5 text-orange-600" />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{company.name}</p>
              <p className="truncate text-xs text-muted-foreground">Verified online store</p>
            </div>
          </Link>

          <form className="hidden min-w-0 flex-1 items-center md:flex">
            <div className="flex h-11 min-w-0 flex-1 items-center rounded-l-xl border border-r-0 border-orange-300 bg-white px-3">
              <Search className="mr-2 h-4 w-4 text-orange-600" />
              <Input name="q" defaultValue={query} placeholder="Search products, services, catalog..." className="h-9 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0" />
            </div>
            <input type="hidden" name="category" value={category} />
            <button type="submit" className="h-11 rounded-r-xl bg-orange-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-orange-700">
              Search
            </button>
          </form>

          <Link
            href={customerCta}
            className="ml-auto inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-neutral-950 px-4 text-sm font-semibold text-white transition-all hover:-translate-y-px hover:bg-neutral-800 md:ml-0"
          >
            <ShoppingCart className="h-4 w-4 text-orange-300" />
            Quote Cart
          </Link>
        </div>
      </header>

      <section className="border-b border-orange-100 bg-white">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 py-5 lg:grid-cols-[260px_1fr_280px]">
          <aside className="hidden rounded-xl border border-border bg-white p-4 lg:block">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Grid3X3 className="h-4 w-4 text-orange-600" />
              Categories
            </div>
            <div className="space-y-1">
              <Link href={storeHref(company.slug, { q: query })} className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${!category ? "bg-orange-50 text-orange-700" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}>
                <span>All products</span>
                <span>{company.products.length}</span>
              </Link>
              {company.categories.map((item) => (
                <Link
                  key={item.id}
                  href={storeHref(company.slug, { q: query, category: item.name })}
                  className={`block rounded-lg px-3 py-2 text-sm transition-colors ${category === item.name ? "bg-orange-50 text-orange-700" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
                >
                  {item.name}
                </Link>
              ))}
            </div>
          </aside>

          <div className="overflow-hidden rounded-xl border border-orange-100 bg-white">
            <div className="grid min-h-[320px] lg:grid-cols-[1.1fr_0.9fr]">
              <div className="flex flex-col justify-center bg-[linear-gradient(135deg,#fff7ed_0%,#ffffff_48%,#eff6ff_100%)] p-6 sm:p-8">
                <div className="mb-4 flex flex-wrap gap-2">
                  <Badge className="bg-orange-50 text-orange-700 hover:bg-orange-100"><BadgeCheck className="mr-1 h-3 w-3" /> Verified Products</Badge>
                  <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-100"><ShieldCheck className="mr-1 h-3 w-3" /> Secure quotation</Badge>
                </div>
                <h1 className="max-w-2xl text-3xl font-bold tracking-tight text-neutral-950 sm:text-4xl">{company.name}</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-600">{company.about || "Shop products and services, compare options, and request a quotation directly from this company."}</p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link href={customerCta} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-orange-600 px-5 text-sm font-semibold text-white transition-all hover:-translate-y-px hover:bg-orange-700">
                    <MessageCircle className="h-4 w-4" />
                    Request quotation
                  </Link>
                  {company.phone && (
                    <a href={`tel:${company.phone}`} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-border bg-white px-5 text-sm font-semibold transition-colors hover:bg-accent">
                      <Phone className="h-4 w-4 text-emerald-600" />
                      Contact company
                    </a>
                  )}
                </div>
              </div>
              <div className="relative min-h-[260px] bg-neutral-100">
                {featuredImage ? (
                  <SafeImage src={featuredImage} alt={featuredProduct?.name || company.name} width={680} height={520} className="h-full min-h-[260px] w-full object-cover" />
                ) : (
                  <div className="flex h-full min-h-[260px] items-center justify-center bg-[radial-gradient(circle_at_top,#fed7aa,#ffffff_60%)]">
                    <PackageSearch className="h-20 w-20 text-orange-500" />
                  </div>
                )}
                {featuredProduct && (
                  <div className="absolute bottom-4 left-4 right-4 rounded-xl bg-white/95 p-4 shadow-sm backdrop-blur">
                    <p className="text-xs uppercase text-muted-foreground">Featured</p>
                    <p className="mt-1 truncate font-semibold">{featuredProduct.name}</p>
                    <p className="text-sm text-orange-700">{currency} {Number(featuredProduct.unitPrice).toFixed(2)}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <aside className="rounded-xl border border-border bg-white p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-white">
                {logoSrc ? <SafeImage src={logoSrc} alt={`${company.name} logo`} width={48} height={48} className="h-full w-full object-cover" /> : <Building2 className="h-5 w-5 text-orange-600" />}
              </div>
              <div className="min-w-0">
                <p className="truncate font-semibold">{company.name}</p>
                <p className="text-xs text-muted-foreground">Product store profile</p>
              </div>
            </div>
            <div className="mt-4 space-y-3 text-sm">
              {company.email && <InfoRow icon={<Mail className="h-4 w-4 text-blue-600" />} label={company.email} />}
              {company.phone && <InfoRow icon={<Phone className="h-4 w-4 text-emerald-600" />} label={company.phone} />}
              {(company.city || company.country) && <InfoRow icon={<MapPin className="h-4 w-4 text-rose-600" />} label={[company.city, company.country].filter(Boolean).join(", ")} />}
              <InfoRow icon={<Truck className="h-4 w-4 text-violet-600" />} label="Quotation-based orders" />
            </div>
            <Link href={customerCta} className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-neutral-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-neutral-800">
              <ShoppingCart className="h-4 w-4 text-orange-300" />
              {isCustomer ? "Request now" : "Create customer account"}
            </Link>
          </aside>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-6">
        <form className="mb-5 grid gap-3 rounded-xl border border-border bg-white p-3 md:hidden">
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

        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-orange-700">
              <Sparkles className="h-4 w-4" />
              Online catalog
            </div>
            <h2 className="mt-1 text-2xl font-bold tracking-tight">Products and services</h2>
            <p className="mt-1 text-sm text-muted-foreground">{company.products.length} item{company.products.length === 1 ? "" : "s"} available for quotation</p>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-border bg-white px-3 py-2 text-xs text-muted-foreground sm:flex">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            Customer requests are linked to {company.name}
          </div>
        </div>

        {company.products.length === 0 ? (
          <div className="rounded-xl border bg-white p-10 text-center">
            <PackageSearch className="mx-auto mb-4 h-12 w-12 text-orange-500" />
            <h2 className="text-lg font-semibold">No products found</h2>
            <p className="mt-2 text-sm text-muted-foreground">Try another search, clear category filters, or contact the company directly.</p>
            <Link href={storeHref(company.slug, {})} className="mt-5 inline-flex h-10 items-center justify-center rounded-lg border border-input bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-accent">
              View all
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {company.products.map((product) => (
              <StoreProductCard key={product.id} product={product} currency={currency} customerCta={customerCta} companySlug={company.slug} />
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

function InfoRow({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      {icon}
      <span className="min-w-0 truncate">{label}</span>
    </div>
  )
}

function StoreProductCard({ product, currency, customerCta, companySlug }: { product: any; currency: string; customerCta: string; companySlug: string }) {
  const productImage = safeImageSrc(product.image)

  return (
    <Card className="group overflow-hidden bg-white transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_12px_30px_rgba(15,23,42,0.10)]">
      <div className="relative aspect-[4/3] border-b bg-surface">
        {productImage ? (
          <SafeImage src={productImage} alt={product.name} width={480} height={360} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center bg-[linear-gradient(135deg,#fff7ed,#f8fafc)]">
            <PackageSearch className="h-12 w-12 text-orange-500" />
          </div>
        )}
        <div className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-xs font-medium text-orange-700 shadow-sm">
          Ready to quote
        </div>
      </div>
      <CardContent className="space-y-3 p-4">
        <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-200">{product.category?.name || "Catalog"}</Badge>
        <div>
          <Link href={`/store/${companySlug}/products/${product.id}`} className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 underline-offset-4 hover:underline">{product.name}</Link>
          {product.description && <p className="mt-2 line-clamp-2 min-h-10 text-xs leading-5 text-muted-foreground">{product.description}</p>}
        </div>
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Unit price</p>
            <p className="text-lg font-bold text-orange-700">{currency} {Number(product.unitPrice).toFixed(2)}</p>
          </div>
          <p className="text-xs text-muted-foreground">Stock: {product.stock ?? 0}</p>
        </div>
        <Link
          href={customerCta}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-orange-700"
        >
          <ShoppingCart className="h-4 w-4" />
          Add to quotation
        </Link>
      </CardContent>
    </Card>
  )
}
