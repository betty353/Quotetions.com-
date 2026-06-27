import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import ProductForm from "@/components/products/ProductForm"
import { isCompanyAdminRole } from "@/lib/tenant"

export default async function NewProductPage() {
  const session = await getServerSession(authOptions)
  if (!session || !isCompanyAdminRole((session.user as any).role)) {
    redirect("/dashboard")
  }

  const companyId = (session.user as any).companyId ?? null
  let categories = await prisma.category.findMany({
    where: companyId ? { companyId } : {},
    orderBy: { name: "asc" },
  })

  if (companyId && categories.length === 0) {
    const category = await prisma.category.create({
      data: { companyId, name: "General", description: "Default product category" },
    })
    categories = [category]
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Add Product</h1>
      <p className="text-sm text-muted-foreground mt-1">Create a new product to include in quotations.</p>
      <div className="mt-6">
        <ProductForm categories={categories.map((category) => ({ id: category.id, name: category.name }))} mode="create" />
      </div>
    </div>
  )
}
