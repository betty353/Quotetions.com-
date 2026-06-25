import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createProductSchema } from "@/lib/schemas"
import { ZodError } from "zod"
import requireRole from "@/lib/roles"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const page = Number(searchParams.get("page") || "1")
  const pageSize = Number(searchParams.get("pageSize") || "20")
  const search = searchParams.get("search") || undefined
  const categoryId = searchParams.get("categoryId") || undefined

  const where: any = { status: "ACTIVE" }
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { sku: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ]
  }
  if (categoryId) where.categoryId = categoryId

  const total = await prisma.product.count({ where })
  const products = await prisma.product.findMany({
    where,
    take: pageSize,
    skip: (page - 1) * pageSize,
    orderBy: { createdAt: "desc" },
    include: { category: true },
  })

  return NextResponse.json({ data: products, total, page, pageSize })
}

export async function POST(request: NextRequest) {
  const session = await requireRole("ADMIN")
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await request.json()
    const validated = createProductSchema.parse(body)

    const product = await prisma.product.create({
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
        status: "ACTIVE",
      },
    })

    return NextResponse.json({ data: product }, { status: 201 })
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "Validation failed", details: err.errors }, { status: 400 })
    }
    console.error(err)
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 })
  }
}
