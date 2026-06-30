import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createProductSchema } from "@/lib/schemas"
import { ZodError } from "zod"
import requireRole from "@/lib/roles"
import { createAuditLog } from "@/lib/finance"

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      category: true,
      stockMovements: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  })
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
    const companyId = (session.user as any).companyId ?? null
    const existing = await prisma.product.findUnique({ where: { id } })
    if (!existing || (companyId && existing.companyId !== companyId)) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }

    const product = await prisma.product.update({
      where: { id },
      data: {
        sku: validated.sku,
        name: validated.name,
        description: validated.description || null,
        categoryId: validated.categoryId,
        unitPrice: validated.unitPrice,
        currency: "ZMW",
        stock: validated.stock ?? 0,
        reorderLevel: validated.reorderLevel ?? null,
        image: validated.image ?? null,
        images: validated.images ?? undefined,
        shortVideoUrl: validated.shortVideoUrl ?? null,
        view360Url: validated.view360Url ?? null,
        isFeatured: validated.isFeatured ?? false,
        status: validated.status ?? "ACTIVE",
      },
    })

    await createAuditLog({
      companyId: existing.companyId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "Product",
      entityId: product.id,
      changes: {
        before: {
          name: existing.name,
          sku: existing.sku,
          unitPrice: existing.unitPrice,
          stock: existing.stock,
          status: existing.status,
        },
        after: {
          name: product.name,
          sku: product.sku,
          unitPrice: product.unitPrice,
          stock: product.stock,
          status: product.status,
        },
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
    const companyId = (session.user as any).companyId ?? null
    const existing = await prisma.product.findUnique({ where: { id } })
    if (!existing || (companyId && existing.companyId !== companyId)) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }
    await prisma.product.update({
      where: { id },
      data: { status: "DISCONTINUED" },
    })

    await createAuditLog({
      companyId: existing.companyId,
      userId: session.user.id,
      action: "DISCONTINUE",
      entity: "Product",
      entityId: existing.id,
      changes: {
        name: existing.name,
        sku: existing.sku,
        previousStatus: existing.status,
        status: "DISCONTINUED",
      },
    })

    return NextResponse.json({ success: true, message: "Product discontinued. Existing quotations and history are preserved." })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Failed to discontinue product" }, { status: 500 })
  }
}
