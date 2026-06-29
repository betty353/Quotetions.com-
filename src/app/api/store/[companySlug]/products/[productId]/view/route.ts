import { createHash } from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

function hashValue(value?: string | null) {
  if (!value) return null
  return createHash("sha256").update(value).digest("hex")
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ companySlug: string; productId: string }> }) {
  const { companySlug, productId } = await params

  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      status: "ACTIVE",
      company: { slug: companySlug, isActive: true },
    },
    select: { id: true, companyId: true },
  })

  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 })

  const session = await getServerSession(authOptions)
  const body = await request.json().catch(() => ({}))
  const sessionId = typeof body.sessionId === "string" ? body.sessionId.slice(0, 120) : null
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  const realIp = request.headers.get("x-real-ip")
  const userAgent = request.headers.get("user-agent")?.slice(0, 400) || null

  await prisma.productView.create({
    data: {
      companyId: product.companyId,
      productId: product.id,
      userId: (session?.user as any)?.id || null,
      sessionId,
      ipHash: hashValue(forwardedFor || realIp),
      userAgent,
    },
  })

  return NextResponse.json({ success: true })
}
