import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { ZodError } from "zod"
import { prisma } from "@/lib/prisma"
import { registerSchema } from "@/lib/schemas"
import { auditAuthEvent } from "@/lib/audit"
import { getClientIp, rateLimit } from "@/lib/rate-limit"
import { createUniqueCompanySlug } from "@/lib/tenant"

function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin")
  if (!origin) return true
  const host = request.headers.get("host")
  return host ? new URL(origin).host === host : false
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const validatedData = registerSchema.parse(body)
    const email = validatedData.email
    const ip = getClientIp(request)
    const limit = rateLimit(`register:${ip}:${email}`, 5, 10 * 60_000)

    if (!limit.ok) {
      await auditAuthEvent({ action: "REGISTER", email, request, metadata: { blocked: true, reason: "rate_limited" } })
      return NextResponse.json({ error: "Too many registration attempts. Please try again later." }, { status: 429 })
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    })

    if (existingUser) {
      await auditAuthEvent({ action: "REGISTER", email, request, metadata: { blocked: true, reason: "email_exists" } })
      return NextResponse.json({ error: "Email already registered" }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(validatedData.password, 12)

    if (validatedData.accountType === "BUSINESS") {
      const slug = await createUniqueCompanySlug(validatedData.companyName)
      const result = await prisma.$transaction(async (tx) => {
        const company = await tx.company.create({
          data: {
            name: validatedData.companyName,
            slug,
            email,
            phone: validatedData.phone,
          },
        })

        const user = await tx.user.create({
          data: {
            email,
            firstName: validatedData.firstName,
            lastName: validatedData.lastName,
            phone: validatedData.phone,
            password: hashedPassword,
            role: "COMPANY_ADMIN",
            companyId: company.id,
            isActive: true,
            isEmailVerified: false,
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

        await tx.company.update({
          where: { id: company.id },
          data: { ownerId: user.id },
        })

        await tx.companySetting.create({
          data: {
            companyId: company.id,
            companyName: company.name,
            companyEmail: email,
            companyPhone: validatedData.phone,
            defaultCurrency: "USD",
            taxRate: 0,
            quotationPrefix: "QT",
            receiptPrefix: "RC",
            paymentPrefix: "PM",
            quotationValidDays: 30,
            documentFont: "Helvetica",
          },
        })

        return { company, user }
      })

      await auditAuthEvent({
        action: "REGISTER",
        userId: result.user.id,
        companyId: result.company.id,
        email,
        request,
        metadata: { accountType: "BUSINESS", role: "COMPANY_ADMIN" },
      })

      return NextResponse.json(
        {
          message: "Business account created successfully",
          redirectTo: "/onboarding",
          companySlug: result.company.slug,
        },
        { status: 201 }
      )
    }

    const company = validatedData.companyId
      ? await prisma.company.findUnique({ where: { id: validatedData.companyId } })
      : validatedData.companySlug
        ? await prisma.company.findUnique({ where: { slug: validatedData.companySlug } })
        : null

    const user = await prisma.user.create({
      data: {
        email,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        phone: validatedData.phone,
        password: hashedPassword,
        role: "CUSTOMER",
        companyId: company?.id ?? null,
        isActive: true,
        customer: {
          create: {
            companyId: company?.id ?? null,
            phone: validatedData.phone,
            contactPerson: `${validatedData.firstName} ${validatedData.lastName}`,
            status: "ACTIVE",
          },
        },
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

    await auditAuthEvent({
      action: "REGISTER",
      userId: user.id,
      companyId: user.companyId,
      email,
      request,
      metadata: { accountType: "CUSTOMER", role: "CUSTOMER" },
    })

    return NextResponse.json(
      {
        message: "Customer account created successfully",
        redirectTo: company ? `/store/${company.slug}` : "/dashboard",
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      )
    }

    console.error("Registration error:", error instanceof Error ? error.message : "Unknown registration error")
    return NextResponse.json(
      { error: "Failed to create account" },
      { status: 500 }
    )
  }
}
