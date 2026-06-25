import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import requireRole from "@/lib/roles"

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await requireRole("ADMIN", "EMPLOYEE")
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await request.json()
    const updateData: any = {}
    if (body.status) updateData.status = body.status
    if (body.feedback !== undefined) updateData.feedback = body.feedback

    const updated = await prisma.followUp.update({ where: { id }, data: updateData })
    return NextResponse.json({ data: updated })
  } catch (err: unknown) {
    console.error(err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to update follow-up' }, { status: 500 })
  }
}
