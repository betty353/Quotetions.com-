import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
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
    const company = await prisma.company.findUnique({ where: { id: companyId } })
    const defaultSetting = await prisma.companySetting.create({
      data: {
        companyId,
        companyName: company?.name || "",
        companyEmail: company?.email || "",
        companyPhone: company?.phone || "",
        companyAddress: company?.address || null,
        companyCity: company?.city || null,
        companyRegion: company?.region || null,
        companyCountry: company?.country || null,
        companyPostalCode: company?.postalCode || null,
        companyTaxId: company?.taxId || null,
        companyRegistration: company?.registrationNumber || null,
        companyWebsite: company?.website || null,
        companyLogo: company?.logoUrl || null,
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
    const settingData = {
      ...validated,
      companyAddress: validated.companyAddress || null,
      companyCity: validated.companyCity || null,
      companyRegion: validated.companyRegion || null,
      companyCountry: validated.companyCountry || null,
      companyPostalCode: validated.companyPostalCode || null,
      companyTaxId: validated.companyTaxId || null,
      companyRegistration: validated.companyRegistration || null,
      companyWebsite: validated.companyWebsite || null,
      companyLogo: validated.companyLogo || null,
      signatureImageUrl: validated.signatureImageUrl || null,
    }

    const result = await prisma.$transaction(async (tx) => {
      const company = await tx.company.update({
        where: { id: companyId },
        data: {
          name: validated.companyName,
          email: validated.companyEmail,
          phone: validated.companyPhone,
          address: validated.companyAddress || null,
          city: validated.companyCity || null,
          region: validated.companyRegion || null,
          country: validated.companyCountry || null,
          postalCode: validated.companyPostalCode || null,
          taxId: validated.companyTaxId || null,
          registrationNumber: validated.companyRegistration || null,
          website: validated.companyWebsite || null,
          logoUrl: validated.companyLogo || null,
        },
      })

      const setting = await tx.companySetting.upsert({
        where: { companyId },
        create: { ...settingData, companyId },
        update: settingData,
      })

      return { company, setting }
    })

    revalidatePath(`/store/${result.company.slug}`)
    revalidatePath("/dashboard/settings")

    return NextResponse.json({ data: result.setting })
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "Validation failed", details: err.errors }, { status: 400 })
    }
    console.error(err)
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to save settings" }, { status: 500 })
  }
}
