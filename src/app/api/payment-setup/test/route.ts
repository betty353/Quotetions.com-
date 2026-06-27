import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import requireRole from "@/lib/roles"
import { getDpoCredentials, verifyDpoToken } from "@/lib/dpo"

export async function POST() {
  const session = await requireRole("ADMIN")
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const companyId = session.user.companyId
  if (!companyId) return NextResponse.json({ error: "Company onboarding required" }, { status: 400 })

  try {
    const setting = await prisma.companySetting.findUnique({ where: { companyId } })
    if (!setting?.paymentSetupComplete || !setting.paymentEnabled) {
      return NextResponse.json({ error: "Payment setup is not complete or enabled" }, { status: 400 })
    }

    const { companyToken } = getDpoCredentials(setting)
    const response = await verifyDpoToken(companyToken, "connection-test-token", setting.dpoEnvironment)

    return NextResponse.json({
      data: {
        connected: true,
        message: response.resultExplanation || "DPO endpoint reached",
        result: response.result,
      },
    })
  } catch (error) {
    console.error("DPO connection test failed", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "DPO connection test failed" }, { status: 500 })
  }
}
