import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import requireRole from "@/lib/roles"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await requireRole("ADMIN", "EMPLOYEE", "CUSTOMER")
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const payment = await prisma.payment.findUnique({
    where: { id },
    include: {
      quotation: true,
      customer: true,
      recordedBy: true,
    },
  })

  if (!payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 })
  }

  const role = (session.user as any).role
  if (role === "CUSTOMER") {
    const customer = await prisma.customer.findUnique({ where: { userId: session.user.id } })
    if (!customer || customer.id !== payment.customerId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }
  }

  return NextResponse.json({ data: payment })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await requireRole("ADMIN", "EMPLOYEE")
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await request.json()
    const updateData: any = {}
    if (body.status) updateData.status = body.status
    if (body.reference !== undefined) updateData.reference = body.reference
    if (body.notes !== undefined) updateData.notes = body.notes
    if (body.paymentDate !== undefined) updateData.paymentDate = body.paymentDate

    const updated = await prisma.payment.update({
      where: { id },
      data: updateData,
      include: { quotation: true, customer: true, recordedBy: true },
    })

    // If payment completes the quotation, mark quotation as COMPLETED
    if (updated.status === "COMPLETED") {
      const quotation = await prisma.quotation.findUnique({ where: { id: updated.quotationId } })
      if (quotation) {
        await prisma.quotation.update({ where: { id: quotation.id }, data: { status: "COMPLETED" } })
      }
    }

    return NextResponse.json({ data: updated })
  } catch (err: unknown) {
    console.error(err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to update payment' }, { status: 500 })
  }
}
