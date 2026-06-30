"use client"

import { useState, type ChangeEvent, type FormEvent, type ReactNode } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { ArrowRight, Building2, CheckCircle2, CreditCard, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

type FormState = {
  companyName: string
  companyEmail: string
  companyPhone: string
  about: string
  logoUrl: string
  address: string
  city: string
  region: string
  country: string
  postalCode: string
  taxId: string
  registrationNumber: string
  website: string
  defaultCurrency: string
  taxRate: number
  quotationPrefix: string
  receiptPrefix: string
  paymentPrefix: string
  quotationValidDays: number
}

const initialForm: FormState = {
  companyName: "",
  companyEmail: "",
  companyPhone: "",
  about: "",
  logoUrl: "",
  address: "",
  city: "",
  region: "",
  country: "Zambia",
  postalCode: "",
  taxId: "",
  registrationNumber: "",
  website: "",
  defaultCurrency: "ZMW",
  taxRate: 0,
  quotationPrefix: "QT",
  receiptPrefix: "RC",
  paymentPrefix: "PM",
  quotationValidDays: 7,
}

export default function OnboardingPage() {
  const router = useRouter()
  const { update } = useSession()
  const [form, setForm] = useState<FormState>(initialForm)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = event.target
    setForm((prev) => ({
      ...prev,
      [name]: type === "number" ? Number(value) : value,
    }))
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[name]
        return next
      })
    }
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setStatus(null)
    setErrors({})

    try {
      const response = await fetch("/api/onboarding", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await response.json()

      if (!response.ok) {
        if (Array.isArray(data.details)) {
          const nextErrors: Record<string, string> = {}
          for (const issue of data.details) nextErrors[String(issue.path?.[0] || "form")] = issue.message
          setErrors(nextErrors)
        }
        setStatus(data.error || "Could not save onboarding.")
        return
      }

      if (data.user) {
        await update({ user: data.user })
      }
      router.push(data.redirectTo || "/dashboard")
      router.refresh()
    } catch {
      setStatus("Could not save onboarding.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr_320px]">
        <section className="space-y-6">
          <div className="flex items-start gap-3">
            <div className="rounded-xl border bg-card p-3">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Set up your company workspace</h1>
              <p className="mt-1 text-sm text-muted-foreground">Complete the details used on your public store, quotations, invoices, and receipts.</p>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Company Profile</CardTitle>
              <CardDescription>These details appear on your catalog page and business documents.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field name="companyName" label="Company Name" value={form.companyName} onChange={handleChange} error={errors.companyName} />
                  <Field name="companyEmail" label="Company Email" type="email" value={form.companyEmail} onChange={handleChange} error={errors.companyEmail} />
                  <Field name="companyPhone" label="Company Phone" value={form.companyPhone} onChange={handleChange} error={errors.companyPhone} />
                  <Field name="logoUrl" label="Logo URL" value={form.logoUrl} onChange={handleChange} error={errors.logoUrl} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="about">About Company</Label>
                  <Textarea id="about" name="about" value={form.about} onChange={handleChange} placeholder="Short description for your public store." />
                  {errors.about && <p className="text-xs text-destructive">{errors.about}</p>}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field name="address" label="Address" value={form.address} onChange={handleChange} />
                  <Field name="city" label="City" value={form.city} onChange={handleChange} />
                  <Field name="region" label="Region" value={form.region} onChange={handleChange} />
                  <Field name="country" label="Country" value={form.country} onChange={handleChange} />
                  <Field name="postalCode" label="Postal Code" value={form.postalCode} onChange={handleChange} />
                  <Field name="website" label="Website" value={form.website} onChange={handleChange} error={errors.website} />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field name="taxId" label="Tax ID" value={form.taxId} onChange={handleChange} />
                  <Field name="registrationNumber" label="Registration Number" value={form.registrationNumber} onChange={handleChange} />
                  <Field name="defaultCurrency" label="Default Currency" value={form.defaultCurrency} onChange={handleChange} error={errors.defaultCurrency} />
                  <Field name="taxRate" label="Tax Rate (%)" type="number" value={String(form.taxRate)} onChange={handleChange} error={errors.taxRate} />
                  <Field name="quotationPrefix" label="Quotation Prefix" value={form.quotationPrefix} onChange={handleChange} error={errors.quotationPrefix} />
                  <Field name="quotationValidDays" label="Quotation Valid Days" type="number" value={String(form.quotationValidDays)} onChange={handleChange} error={errors.quotationValidDays} />
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  {status && <p className="text-sm text-destructive">{status}</p>}
                  <Button type="submit" className="sm:ml-auto" disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                    Continue to payment setup
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </section>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Setup Progress</CardTitle>
              <CardDescription>Workspace foundations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Step done label="Account created" />
              <Step done={Boolean(form.companyName && form.companyEmail && form.companyPhone)} label="Company profile" />
              <Step done={Boolean(form.taxId || form.registrationNumber)} label="Tax details" />
              <Step done={false} label="Payment setup" icon={<CreditCard className="h-4 w-4" />} />
            </CardContent>
          </Card>
        </aside>
      </div>
    </main>
  )
}

function Field({ name, label, value, onChange, error, type = "text" }: {
  name: string
  label: string
  value: string
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
  error?: string
  type?: string
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} value={value} onChange={onChange} type={type} className={error ? "border-destructive" : ""} />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

function Step({ label, done, icon }: { label: string; done: boolean; icon?: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-7 w-7 items-center justify-center rounded-full border bg-card">
        {done ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : icon || <span className="h-2 w-2 rounded-full bg-muted-foreground" />}
      </span>
      <span className={done ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </div>
  )
}
