import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { getToken } from "next-auth/jwt"
import { ZodError } from "zod"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { onboardingSchema } from "@/lib/schemas"
import { createUniqueCompanySlug, isCompanyAdminRole } from "@/lib/tenant"

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  const sessionEmail = session?.user?.email || (typeof token?.email === "string" ? token.email : null)
  const sessionUserId = session?.user?.id || (typeof token?.id === "string" ? token.id : typeof token?.sub === "string" ? token.sub : null)

  if (!sessionEmail && !sessionUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const validated = onboardingSchema.parse(body)
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          ...(sessionEmail ? [{ email: sessionEmail }] : []),
          ...(sessionUserId ? [{ id: sessionUserId }] : []),
        ],
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        companyId: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const companyData = {
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
    }

    const settingData = {
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
    }

    if (user.companyId) {
      if (!isCompanyAdminRole(user.role)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }

      const [company, setting] = await prisma.$transaction([
        prisma.company.update({
          where: { id: user.companyId },
          data: companyData,
        }),
        prisma.companySetting.upsert({
          where: { companyId: user.companyId },
          update: settingData,
          create: {
            companyId: user.companyId,
            ...settingData,
            documentFont: "Helvetica",
          },
        }),
      ])

      return NextResponse.json({
        company,
        setting,
        user: {
          id: user.id,
          email: user.email,
          role: user.role === "ADMIN" ? "COMPANY_ADMIN" : user.role,
          companyId: user.companyId,
          firstName: user.firstName,
          lastName: user.lastName,
        },
        redirectTo: "/dashboard/payment-setup",
      })
    }

    const slug = await createUniqueCompanySlug(validated.companyName)
    const result = await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          ...companyData,
          slug,
          ownerId: user.id,
        },
      })

      const setting = await tx.companySetting.create({
        data: {
          companyId: company.id,
          ...settingData,
          documentFont: "Helvetica",
        },
      })

      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: {
          companyId: company.id,
          role: "COMPANY_ADMIN",
        },
        select: {
          id: true,
          email: true,
          role: true,
          companyId: true,
          firstName: true,
          lastName: true,
        },
      })

      return { company, setting, user: updatedUser }
    })

    return NextResponse.json({ ...result, redirectTo: "/dashboard/payment-setup" })
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 })
    }

    console.error("Onboarding error:", error instanceof Error ? error.message : "Unknown onboarding error")
    return NextResponse.json({ error: "Failed to save onboarding" }, { status: 500 })
  }
}
