"use client"

import React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import {
  BarChart3,
  Package,
  Users,
  FileText,
  CreditCard,
  Receipt,
  Settings,
  LogOut,
  User,
  Bell,
  Search,
  Menu,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useState } from "react"

const sidebarItems = [
  { icon: BarChart3, label: "Dashboard", href: "/dashboard", allowedRoles: ["ADMIN", "EMPLOYEE", "CUSTOMER"] },
  { icon: FileText, label: "Quotations", href: "/dashboard/quotations", allowedRoles: ["ADMIN", "EMPLOYEE", "CUSTOMER"] },
  { icon: Users, label: "Customers", href: "/dashboard/customers", allowedRoles: ["ADMIN", "EMPLOYEE"] },
  { icon: Package, label: "Products", href: "/dashboard/products", allowedRoles: ["ADMIN"] },
  { icon: Package, label: "Import History", href: "/dashboard/products/import-history", allowedRoles: ["ADMIN"] },
  { icon: Settings, label: "Settings", href: "/dashboard/settings", allowedRoles: ["ADMIN"] },
]

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session } = useSession()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const userRole = (session?.user as any)?.role

  const filteredSidebarItems = sidebarItems.filter((item) =>
    item.allowedRoles.includes(userRole)
  )

  const handleLogout = async () => {
    await signOut({ redirect: true, callbackUrl: "/auth/login" })
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Mobile Sidebar Toggle */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-white border-b border-border lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center text-sm font-bold">
              QC
            </div>
            <span className="font-bold text-gray-900">Quotely</span>
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:sticky left-0 top-0 h-screen w-64 bg-slate-900 text-white pt-6 z-30 overflow-y-auto transition-transform duration-300 lg:translate-x-0",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Logo */}
        <div className="px-6 mb-8 hidden lg:flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-400 to-indigo-600 text-white flex items-center justify-center font-bold text-lg">
            QC
          </div>
          <div>
            <h1 className="font-bold text-lg">Quotely</h1>
            <p className="text-xs text-slate-400">CRM Platform</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="px-4 space-y-1">
          {filteredSidebarItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-blue-600 text-white"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                )}
              >
                <item.icon size={20} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* User Section */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-slate-700 p-4 space-y-3">
          <div className="px-4 py-3 rounded-lg bg-slate-800">
            <p className="text-xs text-slate-400">Logged in as</p>
            <p className="text-sm font-medium text-white truncate">
              {session?.user?.email}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden pt-16 lg:pt-0">
        {/* Top Bar */}
        <header className="fixed lg:sticky top-0 right-0 left-0 lg:left-64 z-20 bg-white border-b border-border h-16 flex items-center px-6 gap-4">
          <div className="flex-1 flex items-center gap-2 bg-slate-100 rounded-lg px-4 py-2">
            <Search size={18} className="text-slate-500" />
            <input
              type="text"
              placeholder="Search..."
              className="flex-1 bg-transparent outline-none text-sm text-slate-700 placeholder-slate-500"
            />
          </div>

          <div className="flex items-center gap-4">
            {/* Notifications */}
            <button className="relative p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
              <Bell size={20} />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>

            {/* User Profile */}
            <button className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center text-sm font-bold">
                {session?.user?.name?.charAt(0)}
              </div>
            </button>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-auto">
          <div className="p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
