import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import requireRole from "@/lib/roles"
import { companySettingsSchema } from "@/lib/schemas"
import { ZodError } from "zod"

export async function GET() {
  const session = await requireRole("ADMIN")
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const companyId = session.user.companyId
  if (!companyId) return NextResponse.json({ error: "Company workspace required" }, { status: 400 })

  const setting = await prisma.companySetting.findUnique({ where: { companyId } })
  if (!setting) {
    const defaultSetting = await prisma.companySetting.create({
      data: {
        companyId,
        companyName: "",
        companyEmail: "",
        companyPhone: "",
        defaultCurrency: "USD",
        taxRate: 0,
        quotationPrefix: "QT",
        receiptPrefix: "RC",
        paymentPrefix: "PM",
        quotationValidDays: 30,
        documentFont: "Helvetica",
      },
    })
    return NextResponse.json({ data: defaultSetting })
  }

  return NextResponse.json({ data: setting })
}

export async function PUT(request: NextRequest) {
  const session = await requireRole("ADMIN")
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const companyId = session.user.companyId
  if (!companyId) return NextResponse.json({ error: "Company workspace required" }, { status: 400 })

  try {
    const body = await request.json()
    const validated = companySettingsSchema.parse(body)

    const existing = await prisma.companySetting.findUnique({ where: { companyId } })
    if (existing) {
      const updated = await prisma.companySetting.update({
        where: { id: existing.id },
        data: validated,
      })
      return NextResponse.json({ data: updated })
    }

    const created = await prisma.companySetting.create({
      data: { ...validated, companyId },
    })
    return NextResponse.json({ data: created }, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "Validation failed", details: err.errors }, { status: 400 })
    }
    console.error(err)
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to save settings" }, { status: 500 })
  }
}
