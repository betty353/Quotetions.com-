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

  const receipt = await prisma.receipt.findUnique({
    where: { id },
    include: {
      quotation: true,
      customer: { include: { user: true } },
      generatedBy: true,
      payment: true,
    },
  })

  if (!receipt) return NextResponse.json({ error: "Receipt not found" }, { status: 404 })

  const role = (session.user as any).role
  if (role === "CUSTOMER") {
    const customer = await prisma.customer.findUnique({ where: { userId: session.user.id } })
    if (!customer || customer.id !== receipt.customerId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }
  }

  return NextResponse.json({ data: receipt })
}
