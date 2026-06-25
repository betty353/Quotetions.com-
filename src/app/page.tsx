import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { authOptions } from "@/lib/auth"
import { ArrowRight, CheckCircle2, Zap, BarChart3, Lock, Users } from "lucide-react"

export default async function HomePage() {
  const session = await getServerSession(authOptions)

  // If logged in, redirect to dashboard
  if (session) {
    redirect("/dashboard")
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-blue-900 to-slate-900">
      {/* Navigation */}
      <nav className="border-b border-slate-800 bg-slate-900/50 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-400 to-indigo-600 text-white flex items-center justify-center font-bold">
                QC
              </div>
              <span className="text-white font-bold text-xl">Quotely CRM</span>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/auth/login"
                className="text-slate-300 hover:text-white transition-colors"
              >
                Sign In
              </Link>
              <Link href="/auth/register">
                <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
                  Get Started
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
          Enterprise Quotation Management
          <br />
          <span className="bg-gradient-to-r from-blue-400 to-indigo-500 text-transparent bg-clip-text">
            Made Simple
          </span>
        </h1>
        <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
          Quotely CRM is a professional-grade quotation, sales follow-up, and receipt management platform designed for modern businesses.
        </p>
        <div className="flex items-center justify-center gap-4 mb-12">
          <Link href="/auth/register">
            <Button size="lg" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
              Start Free Trial <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Link href="/auth/login">
            <Button
              size="lg"
              variant="outline"
              className="bg-transparent border-slate-600 text-white hover:bg-slate-800"
            >
              Demo Account
            </Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              icon: Zap,
              title: "Professional Quotations",
              description: "Create, manage, and send professional quotations with automatic PDF generation.",
            },
            {
              icon: BarChart3,
              title: "Real-time Analytics",
              description: "Track revenue, conversion rates, and employee performance with detailed reports.",
            },
            {
              icon: Users,
              title: "Complete CRM",
              description: "Manage customers, employees, follow-ups, and interactions in one platform.",
            },
            {
              icon: Lock,
              title: "Enterprise Security",
              description: "Role-based access control, audit logging, and data protection.",
            },
            {
              icon: CheckCircle2,
              title: "Payment Tracking",
              description: "Record payments, generate receipts, and track payment status automatically.",
            },
            {
              icon: BarChart3,
              title: "Custom Reports",
              description: "Export data as PDF, Excel, or CSV with comprehensive business reports.",
            },
          ].map((feature, index) => (
            <div
              key={index}
              className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-8 hover:border-slate-600 transition-colors"
            >
              <feature.icon className="h-12 w-12 text-blue-400 mb-4" />
              <h3 className="text-white font-bold text-lg mb-2">{feature.title}</h3>
              <p className="text-slate-400">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <div className="bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border border-blue-500/50 rounded-lg p-12">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to Transform Your Sales Process?</h2>
          <p className="text-slate-300 mb-8 max-w-2xl mx-auto">
            Join companies worldwide using Quotely CRM to streamline quotations, boost conversions, and close deals faster.
          </p>
          <Link href="/auth/register">
            <Button size="lg" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
              Create Free Account <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-900 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
          <p className="text-slate-400 text-sm">
            © 2026 Quotely CRM. All rights reserved. Enterprise-grade quotation management platform.
          </p>
        </div>
      </footer>
    </div>
  )
}
