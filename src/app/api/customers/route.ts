import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import requireRole from "@/lib/roles"
import { staffCreateCustomerSchema, updateCustomerProfileSchema } from "@/lib/schemas"
import { createAuditLog } from "@/lib/finance"
import { isCompanyAdminRole } from "@/lib/tenant"

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
            passportPhotoUrl: parsed.passportPhotoUrl || null,
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

export async function PATCH(request: NextRequest) {
  const session = await requireRole("ADMIN", "EMPLOYEE", "CUSTOMER")
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const parsed = updateCustomerProfileSchema.parse(await request.json())
    const role = (session.user as any).role as string
    const sessionCompanyId = (session.user as any).companyId as string | null

    const customer = role === "CUSTOMER"
      ? await prisma.customer.findUnique({ where: { userId: session.user.id }, include: { user: true } })
      : parsed.id && sessionCompanyId
        ? await prisma.customer.findFirst({ where: { id: parsed.id, companyId: sessionCompanyId }, include: { user: true } })
        : null

    if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 })

    const [updatedCustomer] = await prisma.$transaction([
      prisma.customer.update({
        where: { id: customer.id },
        data: {
          phone: parsed.phone || customer.phone,
          nrc: parsed.nrc ?? customer.nrc,
          passportPhotoUrl: parsed.passportPhotoUrl ?? customer.passportPhotoUrl,
          village: parsed.village ?? customer.village,
          town: parsed.town ?? customer.town,
          whatsappNumber: parsed.whatsappNumber ?? customer.whatsappNumber,
          address: parsed.address ?? customer.address,
          city: parsed.city ?? customer.city,
          region: parsed.region ?? customer.region,
          country: parsed.country ?? customer.country,
          contactPerson: [parsed.firstName || customer.user.firstName, parsed.lastName || customer.user.lastName].join(" ").trim(),
        },
      }),
      prisma.user.update({
        where: { id: customer.userId },
        data: {
          firstName: parsed.firstName || customer.user.firstName,
          lastName: parsed.lastName || customer.user.lastName,
          phone: parsed.phone || customer.user.phone,
        },
      }),
    ])

    await createAuditLog({
      companyId: customer.companyId,
      userId: session.user.id,
      action: "UPDATE",
      entity: "Customer",
      entityId: customer.id,
      changes: { profileUpdated: true },
    })

    return NextResponse.json({ data: updatedCustomer })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 })
    }
    console.error(error)
    return NextResponse.json({ error: "Failed to update customer" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const session = await requireRole("ADMIN")
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const role = (session.user as any).role as string
  if (!isCompanyAdminRole(role)) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })

  const companyId = (session.user as any).companyId as string | null
  const id = request.nextUrl.searchParams.get("id")
  if (!companyId || !id) return NextResponse.json({ error: "Customer id and company workspace are required" }, { status: 400 })

  const customer = await prisma.customer.findFirst({ where: { id, companyId } })
  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 })

  await prisma.$transaction([
    prisma.customer.update({ where: { id }, data: { status: "REMOVED" } }),
    prisma.user.update({ where: { id: customer.userId }, data: { isActive: false } }),
  ])

  await createAuditLog({
    companyId,
    userId: session.user.id,
    action: "REMOVE",
    entity: "Customer",
    entityId: id,
    changes: { status: "REMOVED" },
  })

  return NextResponse.json({ success: true })
}
