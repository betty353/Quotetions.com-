"use client"

import { Suspense, useState } from "react"
import Image from "next/image"
import { signIn } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Building2, Loader2, ShoppingBag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { businessRegistrationSchema, customerRegistrationSchema } from "@/lib/schemas"
import { cn } from "@/lib/utils"

type AccountType = "BUSINESS" | "CUSTOMER"

function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialCompanySlug = searchParams.get("companySlug") || ""
  const isStoreCustomerFlow = searchParams.get("type") === "customer" || Boolean(initialCompanySlug)
  const initialType = isStoreCustomerFlow ? "CUSTOMER" : "BUSINESS"
  const [accountType, setAccountType] = useState<AccountType>(initialType)
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    companyName: "",
    companySlug: initialCompanySlug,
    password: "",
    confirmPassword: "",
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (validationErrors[name]) {
      setValidationErrors((prev) => {
        const next = { ...prev }
        delete next[name]
        return next
      })
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError("")
    setValidationErrors({})
    setIsLoading(true)

    const payload = accountType === "BUSINESS"
      ? {
          accountType,
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          companyName: formData.companyName,
          password: formData.password,
          confirmPassword: formData.confirmPassword,
        }
      : {
          accountType,
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          companySlug: formData.companySlug || undefined,
          password: formData.password,
          confirmPassword: formData.confirmPassword,
        }

    const parsed = accountType === "BUSINESS"
      ? businessRegistrationSchema.safeParse(payload)
      : customerRegistrationSchema.safeParse(payload)

    if (!parsed.success) {
      const errors: Record<string, string> = {}
      for (const issue of parsed.error.errors) {
        errors[String(issue.path[0])] = issue.message
      }
      setValidationErrors(errors)
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      })
      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Registration failed. Please try again.")
        return
      }

      const signInResult = await signIn("credentials", {
        email: parsed.data.email,
        password: formData.password,
        redirect: false,
      })

      if (signInResult?.error) {
        router.push(`/auth/login?registered=true&callbackUrl=${encodeURIComponent(data.redirectTo || "/dashboard")}`)
        return
      }

      router.push(data.redirectTo || (accountType === "BUSINESS" ? "/onboarding" : "/dashboard"))
    } catch {
      setError("An unexpected error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-8 text-center">
          <Image src="/logo.jpg" alt="Astro City Limited logo" width={180} height={96} className="mx-auto mb-4 h-20 w-40 rounded-xl object-contain" priority />
          <h1 className="text-3xl font-semibold tracking-tight">{isStoreCustomerFlow ? "Create customer account" : "Create your account"}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isStoreCustomerFlow
              ? "Sign up to request quotations, track payments, and download receipts from this company."
              : "Choose the account type that matches how you use Astro city crm."}
          </p>
        </div>

        <Card className="mx-auto max-w-3xl">
          <CardHeader>
            {isStoreCustomerFlow ? (
              <div className="rounded-xl border border-primary bg-surface-selected p-4 text-left">
                <ShoppingBag className="mb-3 h-5 w-5 text-primary" />
                <CardTitle className="text-base">Customer Account</CardTitle>
                <CardDescription>
                  Connected to store: <span className="font-medium text-foreground">{formData.companySlug}</span>
                </CardDescription>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setAccountType("BUSINESS")}
                  className={cn(
                    "rounded-xl border p-4 text-left transition-colors",
                    accountType === "BUSINESS" ? "border-primary bg-surface-selected" : "border-border hover:bg-accent"
                  )}
                >
                  <Building2 className="mb-3 h-5 w-5 text-primary" />
                  <CardTitle className="text-base">Business / Company Account</CardTitle>
                  <CardDescription>Create a company workspace and manage products, quotes, payments, and customers.</CardDescription>
                </button>
                <button
                  type="button"
                  onClick={() => setAccountType("CUSTOMER")}
                  className={cn(
                    "rounded-xl border p-4 text-left transition-colors",
                    accountType === "CUSTOMER" ? "border-primary bg-surface-selected" : "border-border hover:bg-accent"
                  )}
                >
                  <ShoppingBag className="mb-3 h-5 w-5 text-primary" />
                  <CardTitle className="text-base">Customer Account</CardTitle>
                  <CardDescription>Browse company stores, request quotations, pay, and download receipts.</CardDescription>
                </button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-6">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="firstName" label="First Name" value={formData.firstName} onChange={handleChange} error={validationErrors.firstName} />
                <Field id="lastName" label="Last Name" value={formData.lastName} onChange={handleChange} error={validationErrors.lastName} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="email" label="Email" type="email" value={formData.email} onChange={handleChange} error={validationErrors.email} />
                <Field id="phone" label="Phone" value={formData.phone} onChange={handleChange} error={validationErrors.phone} />
              </div>

              {accountType === "BUSINESS" ? (
                <Field id="companyName" label="Company Name" value={formData.companyName} onChange={handleChange} error={validationErrors.companyName} />
              ) : isStoreCustomerFlow ? (
                <input type="hidden" name="companySlug" value={formData.companySlug} />
              ) : (
                <Field id="companySlug" label="Company Store Slug (optional)" value={formData.companySlug} onChange={handleChange} error={validationErrors.companySlug} placeholder="denuel-technologies" />
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="password" label="Password" type="password" value={formData.password} onChange={handleChange} error={validationErrors.password} />
                <Field id="confirmPassword" label="Confirm Password" type="password" value={formData.confirmPassword} onChange={handleChange} error={validationErrors.confirmPassword} />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                {accountType === "BUSINESS" ? "Create Business Account" : "Create Customer Account"}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              Already have an account? <Link href="/auth/login" className="font-medium text-primary hover:underline">Sign in</Link>
            </p>
            {isStoreCustomerFlow && (
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Use your customer email address. A company/admin email that already exists cannot be registered again.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <RegisterForm />
    </Suspense>
  )
}

function Field({
  id,
  label,
  value,
  onChange,
  error,
  type = "text",
  placeholder,
}: {
  id: string
  label: string
  value: string
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  error?: string
  type?: string
  placeholder?: string
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={id} type={type} value={value} placeholder={placeholder} onChange={onChange} className={error ? "border-destructive" : ""} required={id !== "companySlug"} />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
