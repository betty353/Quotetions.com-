import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import PaymentSetupForm from "@/components/settings/PaymentSetupForm"
import { isCompanyAdminRole } from "@/lib/tenant"

export default async function PaymentSetupPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/dashboard")
  if (!isCompanyAdminRole((session.user as any).role)) redirect("/dashboard")

  const setting = await prisma.companySetting.findFirst()
  const setup = setting
    ? {
        settlementMethod: setting.settlementMethod,
        bankName: setting.bankName,
        accountName: setting.accountName,
        accountNumber: setting.accountNumber,
        branch: setting.branch,
        swiftCode: setting.swiftCode,
        mobileMoneyBusinessName: setting.mobileMoneyBusinessName,
        mobileMoneyNumber: setting.mobileMoneyNumber,
        dpoMerchantId: setting.dpoMerchantId,
        dpoCallbackUrl: setting.dpoCallbackUrl,
        dpoReturnUrl: setting.dpoReturnUrl,
        dpoEnvironment: setting.dpoEnvironment,
        paymentEnabled: setting.paymentEnabled,
        paymentSetupComplete: setting.paymentSetupComplete,
        dpoCompanyTokenConfigured: Boolean(setting.dpoCompanyTokenEncrypted),
        dpoServiceTypeConfigured: Boolean(setting.dpoServiceTypeEncrypted),
      }
    : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Payment Setup</h1>
        <p className="text-sm text-muted-foreground mt-1">Connect DPO Pay and configure where business payments settle.</p>
      </div>
      <PaymentSetupForm setup={setup} />
    </div>
  )
}
