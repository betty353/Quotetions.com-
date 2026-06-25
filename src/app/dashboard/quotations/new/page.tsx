import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import QuotationForm from "@/components/quotations/QuotationForm"

export default async function NewQuotationPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/dashboard")

  const role = (session.user as any).role
  const customer = role === "CUSTOMER"
    ? await prisma.customer.findUnique({ where: { userId: session.user.id } })
    : null

  const customers = role === "CUSTOMER"
    ? customer ? [{
      id: customer.id,
      companyName: customer.companyName,
      contactPerson: customer.contactPerson,
      email: session.user.email ?? undefined,
    }] : []
    : await prisma.customer.findMany({
      orderBy: { companyName: "asc" },
      include: { user: true },
    })

  const products = await prisma.product.findMany({
    where: { status: "ACTIVE" },
    orderBy: { name: "asc" },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">New Quotation</h1>
        <p className="text-sm text-muted-foreground mt-1">Create a new customer quotation with configurable line items.</p>
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
        />
      )}
    </div>
  )
}
