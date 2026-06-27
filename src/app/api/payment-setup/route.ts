import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import requireRole from "@/lib/roles"
import { paymentSetupSchema } from "@/lib/schemas"
import { encryptSecret } from "@/lib/encryption"
import { ZodError } from "zod"

function safeSetup(setting: NonNullable<Awaited<ReturnType<typeof prisma.companySetting.findFirst>>>) {
  return {
    id: setting.id,
    settlementMethod: setting.settlementMethod,
    bankName: setting.bankName,
    accountName: setting.accountName,
    accountNumber: setting.accountNumber,
    branch: setting.branch,
    swiftCode: setting.swiftCode,
    mobileMoneyNetwork: setting.mobileMoneyNetwork,
    mobileMoneyBusinessName: setting.mobileMoneyBusinessName,
    mobileMoneyNumber: setting.mobileMoneyNumber,
    dpoMerchantId: setting.dpoMerchantId,
    dpoCallbackUrl: setting.dpoCallbackUrl,
    dpoReturnUrl: setting.dpoReturnUrl,
    dpoEnvironment: setting.dpoEnvironment,
    paymentSetupComplete: setting.paymentSetupComplete,
    paymentEnabled: setting.paymentEnabled,
    dpoCompanyTokenConfigured: Boolean(setting.dpoCompanyTokenEncrypted),
    dpoServiceTypeConfigured: Boolean(setting.dpoServiceTypeEncrypted),
  }
}

export async function GET() {
  const session = await requireRole("ADMIN")
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const setting = await prisma.companySetting.findFirst()
  if (!setting) return NextResponse.json({ data: null })

  return NextResponse.json({ data: safeSetup(setting) })
}

export async function PUT(request: NextRequest) {
  const session = await requireRole("ADMIN")
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await request.json()
    const validated = paymentSetupSchema.parse(body)
    const existing = await prisma.companySetting.findFirst()

    if (!validated.dpoCompanyToken && !existing?.dpoCompanyTokenEncrypted) {
      return NextResponse.json({ error: "DPO company token is required" }, { status: 400 })
    }
    if (!validated.dpoServiceType && !existing?.dpoServiceTypeEncrypted) {
      return NextResponse.json({ error: "DPO service type is required" }, { status: 400 })
    }

    const data = {
      settlementMethod: validated.settlementMethod,
      bankName: validated.settlementMethod === "BANK_ACCOUNT" ? validated.bankName || null : null,
      accountName: validated.settlementMethod === "BANK_ACCOUNT" ? validated.accountName || null : null,
      accountNumber: validated.settlementMethod === "BANK_ACCOUNT" ? validated.accountNumber || null : null,
      branch: validated.settlementMethod === "BANK_ACCOUNT" ? validated.branch || null : null,
      swiftCode: validated.settlementMethod === "BANK_ACCOUNT" ? validated.swiftCode || null : null,
      mobileMoneyNetwork: validated.settlementMethod === "BANK_ACCOUNT" ? null : validated.settlementMethod,
      mobileMoneyBusinessName: validated.settlementMethod === "BANK_ACCOUNT" ? null : validated.mobileMoneyBusinessName || null,
      mobileMoneyNumber: validated.settlementMethod === "BANK_ACCOUNT" ? null : validated.mobileMoneyNumber || null,
      dpoCompanyTokenEncrypted: validated.dpoCompanyToken
        ? encryptSecret(validated.dpoCompanyToken)
        : existing?.dpoCompanyTokenEncrypted ?? null,
      dpoServiceTypeEncrypted: validated.dpoServiceType
        ? encryptSecret(validated.dpoServiceType)
        : existing?.dpoServiceTypeEncrypted ?? null,
      dpoMerchantId: validated.dpoMerchantId || null,
      dpoCallbackUrl: validated.dpoCallbackUrl || null,
      dpoReturnUrl: validated.dpoReturnUrl || null,
      dpoEnvironment: validated.dpoEnvironment,
      paymentSetupComplete: true,
      paymentEnabled: validated.paymentEnabled,
    }

    const setting = existing
      ? await prisma.companySetting.update({ where: { id: existing.id }, data })
      : await prisma.companySetting.create({
          data: {
            companyName: "Your Company",
            companyEmail: "admin@example.com",
            companyPhone: "",
            defaultCurrency: "USD",
            taxRate: 0,
            quotationPrefix: "QT",
            receiptPrefix: "RC",
            paymentPrefix: "PM",
            quotationValidDays: 30,
            documentFont: "Helvetica",
            ...data,
          },
        })

    return NextResponse.json({ data: safeSetup(setting) })
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "Validation failed", details: err.errors }, { status: 400 })
    }

    console.error("Payment setup save failed", err)
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to save payment setup" }, { status: 500 })
  }
}
