import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import type { ReactNode } from "react"
import { PackageCheck, PackageMinus, PackagePlus, TriangleAlert } from "lucide-react"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isCompanyAdminRole } from "@/lib/tenant"
import { stockMovementSchema } from "@/lib/schemas"
import { createAuditLog } from "@/lib/finance"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { formatCurrency, formatDateTime } from "@/lib/utils"

async function recordStockMovement(formData: FormData) {
  "use server"

  const session = await getServerSession(authOptions)
  if (!session || !isCompanyAdminRole((session.user as any).role)) redirect("/dashboard")

  const companyId = (session.user as any).companyId as string | null
  if (!companyId) redirect("/dashboard")

  const parsed = stockMovementSchema.safeParse({
    productId: formData.get("productId"),
    type: formData.get("type"),
    quantity: formData.get("quantity"),
    unitCost: formData.get("unitCost") || undefined,
    reason: formData.get("reason") || undefined,
    reference: formData.get("reference") || undefined,
  })

  if (!parsed.success) redirect("/dashboard/inventory?error=invalid-stock-data")
  const input = parsed.data

  const product = await prisma.product.findFirst({ where: { id: input.productId, companyId } })
  if (!product) redirect("/dashboard/inventory?error=product-not-found")

  const previousStock = product.stock
  let newStock = previousStock

  if (input.type === "STOCK_IN") newStock = previousStock + input.quantity
  if (input.type === "STOCK_OUT" || input.type === "DAMAGED" || input.type === "LOST") newStock = previousStock - input.quantity
  if (input.type === "ADJUSTMENT") newStock = input.quantity

  if (newStock < 0) redirect("/dashboard/inventory?error=not-enough-stock")

  const movement = await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id: product.id },
      data: { stock: newStock },
    })
    return tx.productStockMovement.create({
      data: {
        companyId,
        productId: product.id,
        userId: (session.user as any).id,
        type: input.type,
        quantity: input.quantity,
        previousStock,
        newStock,
        unitCost: input.unitCost ?? null,
        reason: input.reason || null,
        reference: input.reference || null,
      },
    })
  })

  await createAuditLog({
    companyId,
    userId: (session.user as any).id,
    action: "CREATE",
    entity: "ProductStockMovement",
    entityId: movement.id,
    changes: {
      productId: product.id,
      productName: product.name,
      type: input.type,
      quantity: input.quantity,
      previousStock,
      newStock,
      reason: input.reason,
      reference: input.reference,
    },
  })

  revalidatePath("/dashboard/inventory")
  revalidatePath("/dashboard/products")
  revalidatePath(`/dashboard/products/${product.id}`)
  redirect("/dashboard/inventory?updated=1")
}

export default async function InventoryPage({ searchParams }: { searchParams?: Promise<{ updated?: string; error?: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/dashboard")
  if (!isCompanyAdminRole((session.user as any).role)) redirect("/dashboard")
  const companyId = (session.user as any).companyId as string | null
  if (!companyId) redirect("/dashboard")
  const params = await searchParams

  const [products, movements] = await Promise.all([
    prisma.product.findMany({
      where: { companyId },
      include: { category: true },
      orderBy: { name: "asc" },
    }),
    prisma.productStockMovement.findMany({
      where: { companyId },
      include: { product: true, user: true },
      orderBy: { createdAt: "desc" },
      take: 80,
    }),
  ])

  const totalStock = products.reduce((sum, product) => sum + product.stock, 0)
  const stockValue = products.reduce((sum, product) => sum + product.stock * Number(product.unitPrice), 0)
  const damaged = movements.filter((movement) => movement.type === "DAMAGED").reduce((sum, movement) => sum + movement.quantity, 0)
  const lost = movements.filter((movement) => movement.type === "LOST").reduce((sum, movement) => sum + movement.quantity, 0)
  const stockIn = movements.filter((movement) => movement.type === "STOCK_IN").reduce((sum, movement) => sum + movement.quantity, 0)
  const stockOut = movements.filter((movement) => movement.type === "STOCK_OUT").reduce((sum, movement) => sum + movement.quantity, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Inventory</h1>
        <p className="mt-1 text-sm text-muted-foreground">Add stock, remove stock, track damaged/lost items, stock value, and full stock in/out history.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Metric title="Total Stock" value={String(totalStock)} icon={<PackageCheck className="h-5 w-5 text-emerald-600" />} />
        <Metric title="Stock Value" value={formatCurrency(stockValue, "ZMW")} icon={<PackagePlus className="h-5 w-5 text-blue-600" />} />
        <Metric title="Stock In / Out" value={`${stockIn} / ${stockOut}`} icon={<PackageMinus className="h-5 w-5 text-violet-600" />} />
        <Metric title="Damaged / Lost" value={`${damaged} / ${lost}`} icon={<TriangleAlert className="h-5 w-5 text-red-600" />} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Record Stock Movement</CardTitle>
          <CardDescription>Use adjustment when you want to set the product stock to an exact number.</CardDescription>
        </CardHeader>
        <CardContent>
          {params?.updated && <p className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">Stock updated.</p>}
          {params?.error && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">Could not update stock. Check quantity and product stock.</p>}
          <form action={recordStockMovement} className="grid gap-4 lg:grid-cols-6">
            <div className="lg:col-span-2">
              <Label htmlFor="productId">Product</Label>
              <select id="productId" name="productId" required className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm">
                {products.map((product) => (
                  <option key={product.id} value={product.id}>{product.name} ({product.stock})</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="type">Type</Label>
              <select id="type" name="type" required className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm">
                <option value="STOCK_IN">Add stock</option>
                <option value="STOCK_OUT">Remove stock</option>
                <option value="DAMAGED">Damaged stock</option>
                <option value="LOST">Lost stock</option>
                <option value="ADJUSTMENT">Set exact stock</option>
              </select>
            </div>
            <div>
              <Label htmlFor="quantity">Quantity</Label>
              <Input id="quantity" name="quantity" type="number" min="1" required />
            </div>
            <div>
              <Label htmlFor="unitCost">Unit Cost</Label>
              <Input id="unitCost" name="unitCost" type="number" min="0" step="0.01" />
            </div>
            <div>
              <Label htmlFor="reference">Reference</Label>
              <Input id="reference" name="reference" placeholder="Delivery note" />
            </div>
            <div className="lg:col-span-5">
              <Label htmlFor="reason">Reason</Label>
              <Input id="reason" name="reason" placeholder="Why stock changed" />
            </div>
            <div className="flex items-end">
              <Button type="submit" className="w-full">Save Movement</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Stock In/Out History</CardTitle>
          <CardDescription>Latest movement history across all products.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Qty</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3">Value</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">User</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((movement) => (
                <tr key={movement.id} className="border-b hover:bg-slate-50">
                  <td className="px-4 py-3">{formatDateTime(movement.createdAt)}</td>
                  <td className="px-4 py-3">{movement.product.name}</td>
                  <td className="px-4 py-3"><Badge variant={movement.type === "STOCK_IN" ? "success" : movement.type === "LOST" || movement.type === "DAMAGED" ? "destructive" : "default"}>{movement.type}</Badge></td>
                  <td className="px-4 py-3">{movement.quantity}</td>
                  <td className="px-4 py-3">{movement.previousStock} to {movement.newStock}</td>
                  <td className="px-4 py-3">{movement.unitCost ? formatCurrency(Number(movement.unitCost) * movement.quantity, movement.product.currency) : "-"}</td>
                  <td className="px-4 py-3">{movement.reason || movement.reference || "-"}</td>
                  <td className="px-4 py-3">{movement.user ? `${movement.user.firstName} ${movement.user.lastName}` : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}

function Metric({ title, value, icon }: { title: string; value: string; icon: ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">{icon}{title}</CardTitle>
      </CardHeader>
      <CardContent><div className="text-2xl font-bold">{value}</div></CardContent>
    </Card>
  )
}
