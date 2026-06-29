"use client"

import { useMemo, useState } from "react"
import Image from "next/image"
import { AnimatePresence, motion } from "framer-motion"
import {
  Banknote,
  Check,
  CircleDot,
  CreditCard,
  KeyRound,
  Landmark,
  Loader2,
  PlayCircle,
  ShieldCheck,
  Smartphone,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type PaymentSetup = {
  settlementMethod?: string | null
  bankName?: string | null
  accountName?: string | null
  accountNumber?: string | null
  branch?: string | null
  swiftCode?: string | null
  mobileMoneyBusinessName?: string | null
  mobileMoneyNumber?: string | null
  dpoMerchantId?: string | null
  dpoCallbackUrl?: string | null
  dpoReturnUrl?: string | null
  dpoEnvironment?: string | null
  paymentEnabled?: boolean
  paymentSetupComplete?: boolean
  dpoCompanyTokenConfigured?: boolean
  dpoServiceTypeConfigured?: boolean
}

const settlementMethods = [
  { value: "BANK_ACCOUNT", label: "Bank Account", icon: Landmark, logoSrc: null },
  { value: "AIRTEL_MONEY", label: "Airtel Money", icon: Smartphone, logoSrc: "/payment-providers/airtel-money.jpg" },
  { value: "MTN_MOBILE_MONEY", label: "MTN Mobile Money", icon: Smartphone, logoSrc: "/payment-providers/mtn-mobile-money.jpg" },
  { value: "ZAMTEL_KWACHA", label: "Zamtel Kwacha", icon: Smartphone, logoSrc: "/payment-providers/zamtel-money.jpg" },
]

const steps = [
  { id: 0, title: "Settlement Method", icon: CircleDot },
  { id: 1, title: "Bank or Mobile Money", icon: Banknote },
  { id: 2, title: "DPO Configuration", icon: KeyRound },
  { id: 3, title: "Test Connection", icon: PlayCircle },
  { id: 4, title: "Activate Payments", icon: ShieldCheck },
]

export default function PaymentSetupForm({ setup }: { setup: PaymentSetup | null }) {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState({
    settlementMethod: setup?.settlementMethod || "BANK_ACCOUNT",
    bankName: setup?.bankName || "",
    accountName: setup?.accountName || "",
    accountNumber: setup?.accountNumber || "",
    branch: setup?.branch || "",
    swiftCode: setup?.swiftCode || "",
    mobileMoneyBusinessName: setup?.mobileMoneyBusinessName || "",
    mobileMoneyNumber: setup?.mobileMoneyNumber || "",
    dpoCompanyToken: "",
    dpoServiceType: "",
    dpoMerchantId: setup?.dpoMerchantId || "",
    dpoCallbackUrl: setup?.dpoCallbackUrl || "",
    dpoReturnUrl: setup?.dpoReturnUrl || "",
    dpoEnvironment: setup?.dpoEnvironment || "SANDBOX",
    paymentEnabled: setup?.paymentEnabled ?? true,
  })
  const [status, setStatus] = useState<string | null>(null)
  const [lastTestResult, setLastTestResult] = useState<string>(setup?.paymentSetupComplete ? "Ready to test" : "Not tested")
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  const isBank = form.settlementMethod === "BANK_ACCOUNT"
  const hasSettlement = Boolean(form.settlementMethod)
  const hasDestination = isBank
    ? Boolean(form.bankName && form.accountName && form.accountNumber && form.branch)
    : Boolean(form.mobileMoneyBusinessName && form.mobileMoneyNumber)
  const hasDpo = Boolean((form.dpoCompanyToken || setup?.dpoCompanyTokenConfigured) && (form.dpoServiceType || setup?.dpoServiceTypeConfigured))
  const progress = [hasSettlement, hasDestination, hasDpo, lastTestResult.includes("reached") || lastTestResult.includes("Connected"), form.paymentEnabled].filter(Boolean).length

  const selectedSettlement = useMemo(
    () => settlementMethods.find((method) => method.value === form.settlementMethod) || settlementMethods[0],
    [form.settlementMethod]
  )
  const SelectedSettlementIcon = selectedSettlement.icon

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = event.target
    const checked = type === "checkbox" ? (event.target as HTMLInputElement).checked : undefined
    setForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }))
  }

  const save = async (event?: React.FormEvent) => {
    event?.preventDefault()
    setSaving(true)
    setStatus(null)
    const res = await fetch("/api/payment-setup", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        ...form,
        mobileMoneyNetwork: form.settlementMethod === "BANK_ACCOUNT" ? "" : form.settlementMethod,
        dpoCallbackUrl: form.dpoCallbackUrl || undefined,
        dpoReturnUrl: form.dpoReturnUrl || undefined,
      }),
    })
    const data = await res.json()
    setStatus(res.ok ? "Payment setup saved securely" : data.error || "Failed to save payment setup")
    setSaving(false)
    return res.ok
  }

  const testConnection = async () => {
    setTesting(true)
    setStatus(null)
    const saved = await save()
    if (!saved) {
      setTesting(false)
      return
    }
    const res = await fetch("/api/payment-setup/test", { method: "POST", credentials: "include" })
    const data = await res.json()
    const message = res.ok ? `DPO reached: ${data.data?.message || "Connected"}` : data.error || "DPO connection failed"
    setLastTestResult(message)
    setStatus(message)
    setTesting(false)
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle>Payment Setup Wizard</CardTitle>
              <CardDescription>Configure settlement, DPO credentials, connection testing, and payment activation.</CardDescription>
            </div>
            <Badge variant={setup?.paymentSetupComplete && setup.paymentEnabled ? "success" : "warning"}>
              {setup?.paymentSetupComplete && setup.paymentEnabled ? "Active" : "Setup needed"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-6 grid gap-2 md:grid-cols-5">
            {steps.map((item) => {
              const Icon = item.icon
              const active = item.id === step
              const complete = item.id < step
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setStep(item.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border px-3 py-3 text-left text-sm transition-all duration-200",
                    active ? "border-primary bg-surface-selected text-primary" : "border-border bg-card hover:bg-accent",
                    complete && "text-success"
                  )}
                >
                  <span className={cn("flex h-7 w-7 items-center justify-center rounded-full border", active ? "border-primary" : "border-border")}>
                    {complete ? <Check size={16} /> : <Icon size={16} />}
                  </span>
                  <span className="hidden min-w-0 font-medium md:block">{item.title}</span>
                </button>
              )
            })}
          </div>

          <form onSubmit={save} className="space-y-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 8, scale: 0.99 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.99 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
              >
            {step === 0 && (
              <section className="space-y-4">
                <div>
                  <h3 className="text-xl font-semibold">Choose how you receive money</h3>
                  <p className="mt-1 text-sm text-muted-foreground">This controls the settlement destination DPO pays into after processing customer payments.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {settlementMethods.map((method) => {
                    const Icon = method.icon
                    const selected = form.settlementMethod === method.value
                    return (
                      <button
                        key={method.value}
                        type="button"
                        onClick={() => setForm((current) => ({ ...current, settlementMethod: method.value }))}
                        className={cn(
                          "flex items-center gap-3 rounded-xl border p-4 text-left transition-all duration-200 hover:-translate-y-px hover:bg-accent",
                          selected ? "border-primary bg-surface-selected" : "border-border bg-card"
                        )}
                      >
                        <span className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-white">
                          {method.logoSrc ? (
                            <Image src={method.logoSrc} alt={`${method.label} logo`} fill sizes="48px" className="object-contain p-1" />
                          ) : (
                            <Icon size={20} />
                          )}
                        </span>
                        <span>
                          <span className="block font-medium">{method.label}</span>
                          <span className="text-sm text-muted-foreground">{method.value === "BANK_ACCOUNT" ? "Settle into a bank account" : "Settle into mobile money"}</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </section>
            )}

            {step === 1 && (
              <section className="space-y-4">
                <div>
                  <h3 className="text-xl font-semibold">{isBank ? "Bank account details" : "Mobile money details"}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Keep this aligned with your registered DPO settlement profile.</p>
                </div>
                {isBank ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="field-shell"><Label htmlFor="bankName">Bank Name</Label><Input id="bankName" name="bankName" value={form.bankName} onChange={handleChange} placeholder="Bank name" /></div>
                    <div className="field-shell"><Label htmlFor="accountName">Account Name</Label><Input id="accountName" name="accountName" value={form.accountName} onChange={handleChange} placeholder="Registered account name" /></div>
                    <div className="field-shell"><Label htmlFor="accountNumber">Account Number</Label><Input id="accountNumber" name="accountNumber" value={form.accountNumber} onChange={handleChange} placeholder="Account number" /></div>
                    <div className="field-shell"><Label htmlFor="branch">Branch</Label><Input id="branch" name="branch" value={form.branch} onChange={handleChange} placeholder="Branch" /></div>
                    <div className="field-shell"><Label htmlFor="swiftCode">SWIFT Code</Label><Input id="swiftCode" name="swiftCode" value={form.swiftCode} onChange={handleChange} placeholder="Optional" /></div>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="field-shell"><Label htmlFor="mobileMoneyBusinessName">Registered Business Name</Label><Input id="mobileMoneyBusinessName" name="mobileMoneyBusinessName" value={form.mobileMoneyBusinessName} onChange={handleChange} /></div>
                    <div className="field-shell"><Label htmlFor="mobileMoneyNumber">Mobile Number</Label><Input id="mobileMoneyNumber" name="mobileMoneyNumber" value={form.mobileMoneyNumber} onChange={handleChange} /></div>
                  </div>
                )}
              </section>
            )}

            {step === 2 && (
              <section className="space-y-4">
                <div>
                  <h3 className="text-xl font-semibold">DPO configuration</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Secrets are encrypted before storage. Leave configured secrets blank unless replacing them.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="field-shell"><Label htmlFor="dpoCompanyToken">DPO Company Token</Label><Input id="dpoCompanyToken" name="dpoCompanyToken" type="password" value={form.dpoCompanyToken} onChange={handleChange} placeholder={setup?.dpoCompanyTokenConfigured ? "Configured - enter to replace" : "Required"} /></div>
                  <div className="field-shell"><Label htmlFor="dpoServiceType">DPO Service Type</Label><Input id="dpoServiceType" name="dpoServiceType" type="password" value={form.dpoServiceType} onChange={handleChange} placeholder={setup?.dpoServiceTypeConfigured ? "Configured - enter to replace" : "Required"} /></div>
                  <div className="field-shell"><Label htmlFor="dpoMerchantId">Merchant ID</Label><Input id="dpoMerchantId" name="dpoMerchantId" value={form.dpoMerchantId} onChange={handleChange} /></div>
                  <div className="field-shell">
                    <Label htmlFor="dpoEnvironment">Environment</Label>
                    <select id="dpoEnvironment" name="dpoEnvironment" value={form.dpoEnvironment} onChange={handleChange} className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm">
                      <option value="SANDBOX">Sandbox</option>
                      <option value="PRODUCTION">Production</option>
                    </select>
                  </div>
                  <div className="field-shell"><Label htmlFor="dpoCallbackUrl">Callback URL</Label><Input id="dpoCallbackUrl" name="dpoCallbackUrl" value={form.dpoCallbackUrl} onChange={handleChange} placeholder="Defaults to APP_BASE_URL/api/payments/dpo/callback" /></div>
                  <div className="field-shell"><Label htmlFor="dpoReturnUrl">Return URL</Label><Input id="dpoReturnUrl" name="dpoReturnUrl" value={form.dpoReturnUrl} onChange={handleChange} placeholder="Defaults to quotation page" /></div>
                </div>
              </section>
            )}

            {step === 3 && (
              <section className="space-y-4">
                <div>
                  <h3 className="text-xl font-semibold">Test connection</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Save the setup and confirm the gateway can be reached before activating payments.</p>
                </div>
                <div className="rounded-xl border border-border bg-surface p-5">
                  <div className="flex items-start gap-3">
                    <ShieldCheck size={22} className="mt-0.5 text-primary" />
                    <div>
                      <p className="font-medium">Connection test</p>
                      <p className="mt-1 text-sm text-muted-foreground">{lastTestResult}</p>
                    </div>
                  </div>
                  <Button type="button" className="mt-4" onClick={testConnection} disabled={testing}>
                    {testing ? <Loader2 size={18} className="animate-spin" /> : <PlayCircle size={18} />}
                    {testing ? "Testing..." : "Save and test DPO"}
                  </Button>
                </div>
              </section>
            )}

            {step === 4 && (
              <section className="space-y-4">
                <div>
                  <h3 className="text-xl font-semibold">Activate payments</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Turn customer payments on when the setup is complete and tested.</p>
                </div>
                <label className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-5">
                  <span>
                    <span className="block font-medium">Enable customer payments</span>
                    <span className="text-sm text-muted-foreground">Customers will see online payment actions on eligible quotations.</span>
                  </span>
                  <input id="paymentEnabled" name="paymentEnabled" type="checkbox" checked={form.paymentEnabled} onChange={handleChange} className="h-5 w-5 rounded border-border accent-blue-600" />
                </label>
              </section>
            )}
              </motion.div>
            </AnimatePresence>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6">
              <Button type="button" variant="outline" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0}>Back</Button>
              <div className="flex flex-wrap items-center gap-3">
                {status && <p className="text-sm text-muted-foreground">{status}</p>}
                <Button type="submit" variant="outline" disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
                <Button type="button" onClick={() => setStep((current) => Math.min(steps.length - 1, current + 1))} disabled={step === steps.length - 1}>Continue</Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      <aside className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Payment Health</CardTitle>
            <CardDescription>Gateway readiness and settlement quality.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Setup Progress</span>
                <span className="font-medium">{progress}/5</span>
              </div>
              <div className="h-2 rounded-full bg-surface">
                <div className="h-2 rounded-full bg-primary transition-all duration-300" style={{ width: `${(progress / 5) * 100}%` }} />
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <HealthRow label="Gateway Status" value={setup?.paymentSetupComplete ? "Configured" : "Not configured"} good={Boolean(setup?.paymentSetupComplete)} />
              <HealthRow label="Connection Status" value={lastTestResult} good={lastTestResult.includes("reached") || lastTestResult.includes("Connected")} />
              <HealthRow label="Last Test Result" value={lastTestResult} good={lastTestResult.includes("reached") || lastTestResult.includes("Connected")} />
              <HealthRow label="Environment" value={form.dpoEnvironment} good={form.dpoEnvironment === "PRODUCTION"} />
              <HealthRow label="Payments" value={form.paymentEnabled ? "Enabled" : "Disabled"} good={form.paymentEnabled} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Settlement</CardTitle>
            <CardDescription>Current destination summary.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4">
              <span className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-white">
                {selectedSettlement.logoSrc ? (
                  <Image src={selectedSettlement.logoSrc} alt={`${selectedSettlement.label} logo`} fill sizes="48px" className="object-contain p-1" />
                ) : (
                  <SelectedSettlementIcon size={20} className="text-primary" />
                )}
              </span>
              <div>
                <p className="text-sm font-medium">{selectedSettlement.label}</p>
                <p className="text-xs text-muted-foreground">{isBank ? form.bankName || "Bank details pending" : form.mobileMoneyNumber || "Mobile number pending"}</p>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
              DPO processes customer payments and settles funds to your registered business destination. Astro city crm stores status, receipts, and reconciliation records.
            </div>
          </CardContent>
        </Card>
      </aside>
    </div>
  )
}

function HealthRow({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("inline-flex items-center gap-2 text-right font-medium", good ? "text-green-700 dark:text-green-300" : "text-amber-700 dark:text-amber-300")}>
        <span className={cn("h-2 w-2 rounded-full", good ? "bg-success" : "bg-warning")} />
        {value}
      </span>
    </div>
  )
}
