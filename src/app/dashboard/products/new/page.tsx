import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import ProductForm from "@/components/products/ProductForm"

export default async function NewProductPage() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== "ADMIN") {
    redirect("/dashboard")
  }

  const categories = await prisma.category.findMany({ orderBy: { name: "asc" } })

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
