import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createProductSchema } from "@/lib/schemas"
import { ZodError } from "zod"
import requireRole from "@/lib/roles"

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const product = await prisma.product.findUnique({ where: { id }, include: { category: true } })
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ data: product })
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await requireRole("ADMIN")
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await request.json()
    const validated = createProductSchema.parse(body)

    const product = await prisma.product.update({
      where: { id },
      data: {
        sku: validated.sku,
        name: validated.name,
        description: validated.description || null,
        categoryId: validated.categoryId,
        unitPrice: validated.unitPrice,
        currency: validated.currency || "USD",
        stock: validated.stock ?? 0,
        reorderLevel: validated.reorderLevel ?? null,
        image: validated.image ?? null,
        status: validated.status ?? "ACTIVE",
      },
    })

    return NextResponse.json({ data: product })
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "Validation failed", details: err.errors }, { status: 400 })
    }
    console.error(err)
    return NextResponse.json({ error: "Failed to update product" }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await requireRole("ADMIN")
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    await prisma.product.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Failed to delete product" }, { status: 500 })
  }
}
