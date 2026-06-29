import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { LifeBuoy, Mail, MessageCircle, ShieldCheck } from "lucide-react"
import { authOptions } from "@/lib/auth"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default async function SupportPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/dashboard")

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Support</h1>
        <p className="mt-1 text-sm text-muted-foreground">Get help with Astro city crm, payments, quotations, inventory, and customer accounts.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><LifeBuoy className="h-5 w-5 text-green-600" /> Help Desk</CardTitle>
            <CardDescription>Use this for system issues, failed actions, or questions.</CardDescription>
          </CardHeader>
          <CardContent>
            <a href="mailto:support@astrocitycrm.com" className="inline-flex h-10 items-center gap-2 rounded-lg bg-neutral-950 px-4 text-sm font-semibold text-white hover:bg-neutral-800">
              <Mail className="h-4 w-4" />
              Email support
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><MessageCircle className="h-5 w-5 text-blue-600" /> Live Assistance</CardTitle>
            <CardDescription>For urgent customer/payment problems, include the quotation number.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Share the customer name, quotation number, payment reference, and the exact error message.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-600" /> Account Safety</CardTitle>
            <CardDescription>Security, access, and worker account support.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">If a worker leaves, remove them from Employees immediately. Their old history stays visible in Activity Logs.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
