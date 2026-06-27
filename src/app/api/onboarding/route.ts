import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { ZodError } from "zod"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { onboardingSchema } from "@/lib/schemas"
import { isCompanyAdminRole } from "@/lib/tenant"

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const companyId = session?.user?.companyId

  if (!session?.user || !companyId || !isCompanyAdminRole(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const validated = onboardingSchema.parse(body)

    const [company, setting] = await prisma.$transaction([
      prisma.company.update({
        where: { id: companyId },
        data: {
          name: validated.companyName,
          email: validated.companyEmail,
          phone: validated.companyPhone,
          about: validated.about,
          logoUrl: validated.logoUrl,
          address: validated.address,
          city: validated.city,
          region: validated.region,
          country: validated.country,
          postalCode: validated.postalCode,
          taxId: validated.taxId,
          registrationNumber: validated.registrationNumber,
          website: validated.website,
          onboardingCompleted: true,
        },
      }),
      prisma.companySetting.upsert({
        where: { companyId },
        update: {
          companyName: validated.companyName,
          companyEmail: validated.companyEmail,
          companyPhone: validated.companyPhone,
          companyAddress: validated.address,
          companyCity: validated.city,
          companyRegion: validated.region,
          companyCountry: validated.country,
          companyPostalCode: validated.postalCode,
          companyTaxId: validated.taxId,
          companyRegistration: validated.registrationNumber,
          companyWebsite: validated.website,
          companyLogo: validated.logoUrl,
          defaultCurrency: validated.defaultCurrency,
          taxRate: validated.taxRate,
          quotationPrefix: validated.quotationPrefix,
          receiptPrefix: validated.receiptPrefix,
          paymentPrefix: validated.paymentPrefix,
          quotationValidDays: validated.quotationValidDays,
        },
        create: {
          companyId,
          companyName: validated.companyName,
          companyEmail: validated.companyEmail,
          companyPhone: validated.companyPhone,
          companyAddress: validated.address,
          companyCity: validated.city,
          companyRegion: validated.region,
          companyCountry: validated.country,
          companyPostalCode: validated.postalCode,
          companyTaxId: validated.taxId,
          companyRegistration: validated.registrationNumber,
          companyWebsite: validated.website,
          companyLogo: validated.logoUrl,
          defaultCurrency: validated.defaultCurrency,
          taxRate: validated.taxRate,
          quotationPrefix: validated.quotationPrefix,
          receiptPrefix: validated.receiptPrefix,
          paymentPrefix: validated.paymentPrefix,
          quotationValidDays: validated.quotationValidDays,
          documentFont: "Helvetica",
        },
      }),
    ])

    return NextResponse.json({ company, setting, redirectTo: "/dashboard/payment-setup" })
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 })
    }

    console.error("Onboarding error:", error instanceof Error ? error.message : "Unknown onboarding error")
    return NextResponse.json({ error: "Failed to save onboarding" }, { status: 500 })
  }
}
