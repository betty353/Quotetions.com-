import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import requireRole from "@/lib/roles"
import { createAuditLog } from "@/lib/finance"

export async function POST(request: NextRequest) {
  const session = await requireRole("ADMIN")
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await request.json()
    if (!Array.isArray(body)) return NextResponse.json({ error: "Expected an array of products" }, { status: 400 })

    const created: any[] = []
    const errors: any[] = []
    const createdCategories = new Set<string>()
    const companyId = (session.user as any).companyId ?? null

    for (const [index, item] of body.entries()) {
      try {
        // resolve categoryId when a category name is provided
        let categoryId: string | null = null
        if (item.categoryId) {
          categoryId = item.categoryId
        } else if (item.category) {
          const categoryName = String(item.category).trim()
          if (categoryName) {
            let cat = await prisma.category.findFirst({ where: { name: categoryName, companyId } })
            if (!cat) {
              cat = await prisma.category.create({ data: { name: categoryName, companyId } })
              createdCategories.add(categoryName)
            }
            categoryId = cat.id
          }
        }

        if (!categoryId) {
          throw new Error("Category is required")
        }

        const product = await prisma.product.create({
          data: {
            companyId,
            sku: item.sku || undefined,
            name: item.name || undefined,
            description: item.description || null,
            category: { connect: { id: categoryId } },
            unitPrice: item.unitPrice ?? 0,
            currency: item.currency || "USD",
            stock: item.stock ?? 0,
            image: item.image || null,
            status: item.status || "ACTIVE",
          },
        })
        created.push(product)
      } catch (err: any) {
        errors.push({ index, error: err.message || String(err), item })
      }
    }

    const history = await prisma.productImportHistory.create({
      data: {
        companyId,
        importedById: session.user.id,
        source: "csv",
        createdCount: created.length,
        errorCount: errors.length,
        categoriesCreated: Array.from(createdCategories),
        errors: errors.length > 0 ? errors : Prisma.JsonNull,
      },
    })

    await createAuditLog({
      companyId,
      userId: session.user.id,
      action: "CREATE",
      entity: "ProductImport",
      entityId: history.id,
      changes: {
        createdCount: created.length,
        errorCount: errors.length,
        categoriesCreated: Array.from(createdCategories),
      },
    })

    return NextResponse.json({
      success: true,
      created,
      errors,
      categoriesCreated: Array.from(createdCategories),
      categoriesCreatedCount: createdCategories.size,
    })
  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ error: err.message || "Import failed" }, { status: 500 })
  }
}
