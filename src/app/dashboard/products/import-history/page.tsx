import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { formatDateTime } from "@/lib/utils"
import { FileText, Database } from "lucide-react"
import { isCompanyAdminRole } from "@/lib/tenant"

export default async function ImportHistoryPage() {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || !isCompanyAdminRole(role)) {
    redirect("/dashboard")
  }
  const companyId = (session.user as any).companyId ?? null

  const history = await prisma.productImportHistory.findMany({
    where: companyId ? { companyId } : {},
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { importedBy: true },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Product Import History</h1>
          <p className="text-sm text-muted-foreground mt-1">Track CSV imports, errors, and auto-created categories.</p>
        </div>
      </div>

      {history.length === 0 ? (
        <Card className="text-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <p className="text-muted-foreground mb-4">No import history available yet.</p>
          <p className="text-sm text-muted-foreground">Imports will appear here after product CSV uploads.</p>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Recent Imports</CardTitle>
            <CardDescription>Latest 100 upload records.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full table-auto border-collapse">
                <thead>
                  <tr className="text-left text-sm text-muted-foreground border-b">
                    <th className="p-3">Date</th>
                    <th className="p-3">Imported By</th>
                    <th className="p-3">Created</th>
                    <th className="p-3">Errors</th>
                    <th className="p-3">Categories Created</th>
                    <th className="p-3">Source</th>
                    <th className="p-3">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((item) => (
                    <tr key={item.id} className="border-b">
                      <td className="p-3 text-sm">{formatDateTime(item.createdAt)}</td>
                      <td className="p-3 text-sm">{item.importedBy.email}</td>
                      <td className="p-3 text-sm">{item.createdCount}</td>
                      <td className="p-3 text-sm">{item.errorCount}</td>
                      <td className="p-3 text-sm">{Array.isArray(item.categoriesCreated) ? item.categoriesCreated.join(", ") : "—"}</td>
                      <td className="p-3 text-sm">{item.source}</td>
                      <td className="p-3 text-sm">
                        {item.errorCount > 0 ? (
                          <details className="text-sm">
                            <summary className="cursor-pointer text-foreground underline-offset-4 hover:underline">View errors</summary>
                            <div className="mt-2 max-h-64 overflow-auto text-xs bg-slate-50 border rounded p-3">
                              <pre>{JSON.stringify(item.errors, null, 2)}</pre>
                            </div>
                          </details>
                        ) : (
                          <span className="text-slate-500">No errors</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
