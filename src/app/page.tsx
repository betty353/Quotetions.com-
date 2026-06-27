import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import Image from "next/image"
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
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation */}
      <nav className="border-b border-border bg-card/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Image src="/logo.jpg" alt="Quotetion logo" width={40} height={40} className="h-10 w-10 rounded-lg object-contain" />
              <span className="text-xl font-bold text-foreground">Quotetion</span>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/auth/login"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Sign In
              </Link>
              <Link href="/auth/register">
                <Button>
                  Get Started
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <h1 className="mb-6 text-5xl font-bold leading-tight text-foreground md:text-6xl">
          Real Quotation Management
          <br />
          <span className="text-muted-foreground">
            Made Simple
          </span>
        </h1>
        <p className="mx-auto mb-8 max-w-2xl text-xl text-muted-foreground">
          Manage products, customers, quotations, follow-ups, payments, and receipts from your own live business data.
        </p>
        <div className="flex items-center justify-center gap-4 mb-12">
          <Link href="/auth/register">
            <Button size="lg">
              Create Account <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Link href="/auth/login">
            <Button
              size="lg"
              variant="outline"
              className="border-border bg-transparent text-foreground hover:bg-accent"
            >
              Sign In
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
              className="rounded-lg border border-border bg-card p-8 transition-colors hover:bg-accent/40"
            >
              <feature.icon className="mb-4 h-12 w-12 text-foreground" />
              <h3 className="mb-2 text-lg font-bold text-foreground">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <div className="rounded-lg border border-border bg-card p-12">
          <h2 className="mb-4 text-3xl font-bold text-foreground">Start With Your Real Business Data</h2>
          <p className="mx-auto mb-8 max-w-2xl text-muted-foreground">
            Create the first account to become the administrator, then add your real products, customers, and quotations.
          </p>
          <Link href="/auth/register">
            <Button size="lg">
              Create Account <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-20 border-t border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            © 2026 Quotetion. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
