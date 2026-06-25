import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import Link from "next/link"
import ProductForm from "@/components/products/ProductForm"

interface Props {
  params: Promise<{ id: string }>
}

export default async function ProductDetailPage({ params }: Props) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) redirect('/dashboard')

  const product = await prisma.product.findUnique({ where: { id }, include: { category: true } })
  if (!product) return <div className="text-center py-12">Product not found</div>

  const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } })

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

      <Card>
        <CardHeader>
          <CardTitle>Product Info</CardTitle>
          <CardDescription>Edit product details below.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProductForm categories={categories.map(c => ({ id: c.id, name: c.name }))} initial={product} mode="edit" />
        </CardContent>
      </Card>
    </div>
  )
}
