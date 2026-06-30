import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import QuotationForm from "@/components/quotations/QuotationForm"
import { isCompanyAdminRole } from "@/lib/tenant"

type NewQuotationPageProps = {
  searchParams?: Promise<{ companySlug?: string; mode?: string }>
}

export default async function NewQuotationPage({ searchParams }: NewQuotationPageProps) {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/dashboard")
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const formMode = resolvedSearchParams.mode === "purchase-order" ? "purchase-order" : "quotation"

  const role = (session.user as any).role
  const sessionCompanyId = (session.user as any).companyId as string | null
  let customer = role === "CUSTOMER"
    ? await prisma.customer.findUnique({ where: { userId: session.user.id } })
    : null
  const storeCompany = resolvedSearchParams.companySlug
    ? await prisma.company.findUnique({ where: { slug: resolvedSearchParams.companySlug }, select: { id: true, slug: true, name: true } })
    : null

  if (role === "CUSTOMER" && customer && !customer.companyId && storeCompany) {
    const [updatedCustomer] = await prisma.$transaction([
      prisma.customer.update({
        where: { id: customer.id },
        data: { companyId: storeCompany.id },
      }),
      prisma.user.update({
        where: { id: session.user.id },
        data: { companyId: storeCompany.id },
      }),
    ])
    customer = updatedCustomer
  }

  if (role === "CUSTOMER" && customer?.companyId && storeCompany && customer.companyId !== storeCompany.id) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-800">
        This customer account is already connected to another company. Please create a customer account from this store link using a different email address.
      </div>
    )
  }

  const targetCompanyId = role === "CUSTOMER"
    ? customer?.companyId || storeCompany?.id || null
    : sessionCompanyId

  const customers = role === "CUSTOMER"
    ? customer ? [{
      id: customer.id,
      companyName: customer.companyName,
      contactPerson: customer.contactPerson,
      email: session.user.email ?? undefined,
    }] : []
    : await prisma.customer.findMany({
      where: targetCompanyId ? { companyId: targetCompanyId } : {},
      orderBy: { companyName: "asc" },
      include: { user: true },
    })

  const products = await prisma.product.findMany({
    where: { status: "ACTIVE", ...(targetCompanyId ? { companyId: targetCompanyId } : {}) },
    orderBy: { name: "asc" },
  })
  const canCreate = role === "CUSTOMER" || role === "EMPLOYEE" || isCompanyAdminRole(role)
  if (!canCreate) redirect("/dashboard")

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{formMode === "purchase-order" ? "New Purchase Order" : role === "CUSTOMER" ? "Request Quotation" : "New Quotation"}</h1>
        <p className="text-sm text-muted-foreground mt-1">{formMode === "purchase-order" ? "Create an order for a customer using active catalog items." : role === "CUSTOMER" ? "Select products or services and submit your quotation request." : "Create a new customer quotation with configurable line items."}</p>
      </div>

      {products.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-muted-foreground">
          No active products are available. Add products in the product catalog before creating quotations.
        </div>
      ) : (
        <QuotationForm
          products={products.map((product) => ({
            id: product.id,
            name: product.name,
            unitPrice: product.unitPrice.toString(),
          }))}
          customers={customers.map((customer) => ({
            id: customer.id,
            companyName: customer.companyName,
            contactPerson: customer.contactPerson,
            email: "user" in customer ? customer.user.email : customer.email,
          }))}
          customerRole={role}
          mode={formMode}
        />
      )}
    </div>
  )
}
