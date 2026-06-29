import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import requireRole from "@/lib/roles"
import { staffCreateCustomerSchema } from "@/lib/schemas"
import { createAuditLog } from "@/lib/finance"

function temporaryPassword() {
  const part = Math.random().toString(36).slice(2, 8)
  return `Astro-${part}-2026`
}

export async function POST(request: NextRequest) {
  const session = await requireRole("ADMIN", "EMPLOYEE")
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const companyId = (session.user as any).companyId as string | null
    if (!companyId) return NextResponse.json({ error: "Company workspace is required" }, { status: 400 })

    const parsed = staffCreateCustomerSchema.parse(await request.json())
    const existing = await prisma.user.findUnique({ where: { email: parsed.email }, select: { id: true } })
    if (existing) return NextResponse.json({ error: "This email already has an account." }, { status: 400 })

    const password = temporaryPassword()
    const passwordHash = await bcrypt.hash(password, 12)

    const user = await prisma.user.create({
      data: {
        companyId,
        email: parsed.email,
        firstName: parsed.firstName,
        lastName: parsed.lastName,
        phone: parsed.phone,
        password: passwordHash,
        role: "CUSTOMER",
        isActive: true,
        customer: {
          create: {
            companyId,
            phone: parsed.phone,
            contactPerson: `${parsed.firstName} ${parsed.lastName}`,
            nrc: parsed.nrc || null,
            village: parsed.village || null,
            town: parsed.town || null,
            whatsappNumber: parsed.whatsappNumber || null,
            address: parsed.address || null,
            city: parsed.city || null,
            region: parsed.region || null,
            country: parsed.country || null,
            status: "ACTIVE",
          },
        },
      },
      include: { customer: true },
    })

    await createAuditLog({
      companyId,
      userId: session.user.id,
      action: "CREATE",
      entity: "Customer",
      entityId: user.customer?.id || user.id,
      changes: { email: user.email, createdByStaff: true },
    })

    return NextResponse.json({
      data: {
        id: user.customer?.id,
        email: user.email,
        temporaryPassword: password,
      },
    }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 })
    }
    console.error(error)
    return NextResponse.json({ error: "Failed to create customer" }, { status: 500 })
  }
}
