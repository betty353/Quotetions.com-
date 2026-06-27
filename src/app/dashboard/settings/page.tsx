import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import CompanySettingsForm from "@/components/settings/CompanySettingsForm"
import { isCompanyAdminRole } from "@/lib/tenant"

export default async function SettingsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/dashboard")

  if (!isCompanyAdminRole((session.user as any).role)) redirect("/dashboard")

  const companyId = (session.user as any).companyId as string | null
  if (!companyId) redirect("/dashboard")

  const setting = await prisma.companySetting.findUnique({ where: { companyId } })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Company Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure company branding, logos, signature, and document formatting.</p>
      </div>

      <CompanySettingsForm setting={setting} />
    </div>
  )
}
