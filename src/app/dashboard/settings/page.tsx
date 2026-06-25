import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import CompanySettingsForm from "@/components/settings/CompanySettingsForm"

export default async function SettingsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/dashboard")

  if ((session.user as any).role !== "ADMIN") redirect("/dashboard")

  const setting = await prisma.companySetting.findFirst()

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
