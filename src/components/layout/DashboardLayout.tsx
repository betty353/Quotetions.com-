"use client"

import React, { useMemo, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import {
  Activity,
  BarChart3,
  Bell,
  BellRing,
  Building2,
  CalendarCheck,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  CircleHelp,
  CreditCard,
  FileText,
  Landmark,
  LifeBuoy,
  LogOut,
  Menu,
  Moon,
  Package,
  PackageSearch,
  Plus,
  Receipt,
  Search,
  Settings,
  ShoppingCart,
  Sun,
  Truck,
  UserCog,
  Users,
  WalletCards,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useTheme } from "@/components/providers/ThemeProvider"

const sidebarItems = [
  { icon: BarChart3, label: "Dashboard", href: "/dashboard", allowedRoles: ["SUPER_ADMIN", "COMPANY_ADMIN", "ADMIN", "EMPLOYEE", "CUSTOMER"] },
  { icon: Users, label: "Customers", href: "/dashboard/customers", allowedRoles: ["SUPER_ADMIN", "COMPANY_ADMIN", "ADMIN", "EMPLOYEE"] },
  { icon: Package, label: "Products & Services", href: "/dashboard/products", allowedRoles: ["SUPER_ADMIN", "COMPANY_ADMIN", "ADMIN"] },
  { icon: FileText, label: "Quotations", href: "/dashboard/quotations", allowedRoles: ["SUPER_ADMIN", "COMPANY_ADMIN", "ADMIN", "EMPLOYEE", "CUSTOMER"] },
  { icon: ShoppingCart, label: "Orders", href: "/dashboard/quotations", allowedRoles: ["SUPER_ADMIN", "COMPANY_ADMIN", "ADMIN", "EMPLOYEE", "CUSTOMER"] },
  { icon: WalletCards, label: "Invoices", href: "/dashboard/receipts", allowedRoles: ["SUPER_ADMIN", "COMPANY_ADMIN", "ADMIN", "EMPLOYEE", "CUSTOMER"] },
  { icon: Receipt, label: "Receipts", href: "/dashboard/receipts", allowedRoles: ["SUPER_ADMIN", "COMPANY_ADMIN", "ADMIN", "EMPLOYEE", "CUSTOMER"] },
  { icon: CreditCard, label: "Payments", href: "/dashboard/payments", allowedRoles: ["SUPER_ADMIN", "COMPANY_ADMIN", "ADMIN", "EMPLOYEE", "CUSTOMER"] },
  { icon: BarChart3, label: "Reports", href: "/dashboard/reports", allowedRoles: ["SUPER_ADMIN", "COMPANY_ADMIN", "ADMIN", "EMPLOYEE"] },
  { icon: PackageSearch, label: "Inventory", href: "/dashboard/products", allowedRoles: ["SUPER_ADMIN", "COMPANY_ADMIN", "ADMIN"] },
  { icon: Truck, label: "Suppliers", href: "/dashboard/products", allowedRoles: ["SUPER_ADMIN", "COMPANY_ADMIN", "ADMIN"] },
  { icon: Building2, label: "Company Profile", href: "/dashboard/settings", allowedRoles: ["SUPER_ADMIN", "COMPANY_ADMIN", "ADMIN"] },
  { icon: UserCog, label: "Users", href: "/dashboard/employees", allowedRoles: ["SUPER_ADMIN", "COMPANY_ADMIN", "ADMIN"] },
  { icon: Landmark, label: "Payment Setup", href: "/dashboard/payment-setup", allowedRoles: ["SUPER_ADMIN", "COMPANY_ADMIN", "ADMIN"] },
  { icon: Settings, label: "Integrations", href: "/dashboard/payment-setup", allowedRoles: ["SUPER_ADMIN", "COMPANY_ADMIN", "ADMIN"] },
  { icon: Settings, label: "Settings", href: "/dashboard/settings", allowedRoles: ["SUPER_ADMIN", "COMPANY_ADMIN", "ADMIN"] },
  { icon: Activity, label: "Activity Logs", href: "/dashboard/notifications", allowedRoles: ["SUPER_ADMIN", "COMPANY_ADMIN", "ADMIN", "EMPLOYEE", "CUSTOMER"] },
  { icon: LifeBuoy, label: "Support", href: "/dashboard/notifications", allowedRoles: ["SUPER_ADMIN", "COMPANY_ADMIN", "ADMIN", "EMPLOYEE", "CUSTOMER"] },
  { icon: CalendarCheck, label: "Follow-Ups", href: "/dashboard/followups", allowedRoles: ["SUPER_ADMIN", "COMPANY_ADMIN", "ADMIN", "EMPLOYEE", "CUSTOMER"] },
  { icon: Landmark, label: "Reconciliation", href: "/dashboard/reconciliation", allowedRoles: ["SUPER_ADMIN", "COMPANY_ADMIN", "ADMIN", "EMPLOYEE"] },
  { icon: BellRing, label: "Notifications", href: "/dashboard/notifications", allowedRoles: ["SUPER_ADMIN", "COMPANY_ADMIN", "ADMIN", "EMPLOYEE", "CUSTOMER"] },
]

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const { resolvedTheme, toggleTheme } = useTheme()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [navSearch, setNavSearch] = useState("")

  const userRole = (session?.user as any)?.role
  const initials = session?.user?.name?.charAt(0) || session?.user?.email?.charAt(0) || "Q"
  const activeItem = sidebarItems.find((item) => pathname === item.href || pathname.startsWith(item.href + "/"))

  const filteredSidebarItems = useMemo(() => {
    return sidebarItems
      .filter((item) => item.allowedRoles.includes(userRole))
      .filter((item) => item.label.toLowerCase().includes(navSearch.toLowerCase()))
  }, [navSearch, userRole])

  const handleLogout = async () => {
    await signOut({ redirect: true, callbackUrl: "/auth/login" })
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="fixed top-0 left-0 right-0 z-40 border-b border-border bg-card/95 backdrop-blur lg:hidden">
        <div className="flex h-16 items-center justify-between px-4">
          <div className="flex min-w-0 items-center gap-3">
            <Image src="/logo.jpg" alt="Quotetion logo" width={32} height={32} className="h-8 w-8 rounded-lg object-contain" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">Quotetion</p>
              <p className="truncate text-xs text-muted-foreground">CRM Workspace</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Toggle navigation"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-screen flex-col border-r border-border bg-sidebar text-sidebar-foreground transition-all duration-200 lg:translate-x-0",
          collapsed ? "lg:w-20" : "lg:w-[280px]",
          mobileMenuOpen ? "w-[280px] translate-x-0" : "w-[280px] -translate-x-full"
        )}
      >
        <div className="flex h-16 items-center gap-3 border-b border-border px-4">
          <Image src="/logo.jpg" alt="Quotetion logo" width={36} height={36} className="h-9 w-9 rounded-xl object-contain" />
          {!collapsed && (
            <button className="flex min-w-0 flex-1 items-center justify-between rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-accent">
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">Quotetion</span>
                <span className="block truncate text-xs text-muted-foreground">Main workspace</span>
              </span>
              <ChevronDown size={16} className="text-muted-foreground" />
            </button>
          )}
          <button
            type="button"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => setCollapsed((value) => !value)}
            className="hidden rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:inline-flex"
          >
            {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
          </button>
        </div>

        {!collapsed && (
          <div className="px-4 py-3">
            <div className="flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3">
              <Search size={16} className="text-muted-foreground" />
              <input
                value={navSearch}
                onChange={(event) => setNavSearch(event.target.value)}
                placeholder="Search pages"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          <div className="space-y-1">
            {filteredSidebarItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
              return (
                <Link
                  key={`${item.label}-${item.href}`}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "group flex h-10 items-center rounded-xl px-3 text-sm font-medium transition-all duration-150",
                    collapsed ? "justify-center gap-0" : "gap-3",
                    isActive
                      ? "bg-surface-selected text-foreground shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)]"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <item.icon size={20} strokeWidth={1.8} className="shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              )
            })}
          </div>
        </nav>

        <div className="border-t border-border p-3">
          <div className={cn("rounded-xl border border-border bg-card p-3", collapsed && "p-2")}>
            <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                {initials.toUpperCase()}
              </div>
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{session?.user?.name || "Workspace user"}</p>
                  <p className="truncate text-xs text-muted-foreground">{session?.user?.email}</p>
                </div>
              )}
            </div>
            {!collapsed && (
              <button
                onClick={handleLogout}
                className="mt-3 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <LogOut size={16} />
                <span>Logout</span>
              </button>
            )}
          </div>
        </div>
      </aside>

      <div className={cn("min-h-screen pt-16 transition-[padding] duration-200 lg:pt-0", collapsed ? "lg:pl-20" : "lg:pl-[280px]")}>
        <header className={cn("sticky top-0 z-30 border-b border-border bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/80", "lg:h-16")}>
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <div className="hidden min-w-0 flex-col lg:flex">
              <p className="truncate text-sm font-semibold">{activeItem?.label || "Dashboard"}</p>
              <p className="truncate text-xs text-muted-foreground">Enterprise quotation workspace</p>
            </div>

            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 shadow-[0_1px_1px_rgba(15,23,42,0.02)]">
              <Search size={18} className="text-muted-foreground" />
              <input
                type="text"
                placeholder="Search customers, quotations, payments..."
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <kbd className="hidden rounded-md border border-border bg-surface px-1.5 py-0.5 text-[11px] text-muted-foreground sm:inline-flex">⌘K</kbd>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/dashboard/quotations/new"
                className="hidden h-10 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-all duration-200 hover:-translate-y-px hover:bg-primary/90 sm:inline-flex"
              >
                <Plus size={18} />
                <span>New</span>
              </Link>
              <button type="button" aria-label="Help" className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                <CircleHelp size={20} />
              </button>
              <button
                type="button"
                aria-label="Toggle theme"
                onClick={toggleTheme}
                className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {resolvedTheme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <Link href="/dashboard/notifications" aria-label="Notifications" className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                <Bell size={20} />
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-destructive" />
              </Link>
              <button className="hidden items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium transition-colors hover:bg-accent sm:flex">
                <Building2 size={18} />
                <span className="max-w-24 truncate">Company</span>
                <ChevronDown size={16} className="text-muted-foreground" />
              </button>
            </div>
          </div>
        </header>

        <main className="min-h-[calc(100vh-4rem)] bg-background">
          <div className="px-4 py-6 sm:px-6 lg:px-8">
            <div className="animate-fade-in">{children}</div>
          </div>
        </main>
      </div>
    </div>
  )
}
