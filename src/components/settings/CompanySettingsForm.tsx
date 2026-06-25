"use client"

import { useEffect, useState, type ChangeEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const fonts = ["Helvetica", "Times", "Courier"]

interface CompanySettingsFormProps {
  setting: any
}

export default function CompanySettingsForm({ setting }: CompanySettingsFormProps) {
  const [form, setForm] = useState({
    companyName: setting?.companyName || "",
    companyEmail: setting?.companyEmail || "",
    companyPhone: setting?.companyPhone || "",
    companyAddress: setting?.companyAddress || "",
    companyCity: setting?.companyCity || "",
    companyRegion: setting?.companyRegion || "",
    companyCountry: setting?.companyCountry || "",
    companyPostalCode: setting?.companyPostalCode || "",
    companyTaxId: setting?.companyTaxId || "",
    companyRegistration: setting?.companyRegistration || "",
    defaultCurrency: setting?.defaultCurrency || "USD",
    taxRate: setting?.taxRate ?? 0,
    quotationPrefix: setting?.quotationPrefix || "QT",
    receiptPrefix: setting?.receiptPrefix || "RC",
    paymentPrefix: setting?.paymentPrefix || "PM",
    quotationValidDays: setting?.quotationValidDays ?? 30,
    companyLogo: setting?.companyLogo || "",
    signatureImageUrl: setting?.signatureImageUrl || "",
    documentFont: setting?.documentFont || "Helvetica",
    companyWebsite: setting?.companyWebsite || "",
  })
  const [status, setStatus] = useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingSignature, setUploadingSignature] = useState(false)

  useEffect(() => {
    setForm({
      companyName: setting?.companyName || "",
      companyEmail: setting?.companyEmail || "",
      companyPhone: setting?.companyPhone || "",
      companyAddress: setting?.companyAddress || "",
      companyCity: setting?.companyCity || "",
      companyRegion: setting?.companyRegion || "",
      companyCountry: setting?.companyCountry || "",
      companyPostalCode: setting?.companyPostalCode || "",
      companyTaxId: setting?.companyTaxId || "",
      companyRegistration: setting?.companyRegistration || "",
      defaultCurrency: setting?.defaultCurrency || "USD",
      taxRate: setting?.taxRate ?? 0,
      quotationPrefix: setting?.quotationPrefix || "QT",
      receiptPrefix: setting?.receiptPrefix || "RC",
      paymentPrefix: setting?.paymentPrefix || "PM",
      quotationValidDays: setting?.quotationValidDays ?? 30,
      companyLogo: setting?.companyLogo || "",
      signatureImageUrl: setting?.signatureImageUrl || "",
      documentFont: setting?.documentFont || "Helvetica",
      companyWebsite: setting?.companyWebsite || "",
    })
  }, [setting])

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: name === "taxRate" || name === "quotationValidDays" ? Number(value) : value }))
  }

  const uploadImage = async (file: File, field: "companyLogo" | "signatureImageUrl") => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    return new Promise<string>((resolve, reject) => {
      reader.onload = async () => {
        if (typeof reader.result !== "string") {
          return reject(new Error("Invalid file upload"))
        }

        try {
          const res = await fetch("/api/uploads/image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ base64Image: reader.result }),
          })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error || "Upload failed")
          resolve(data.data.secure_url || data.data.url || "")
        } catch (error) {
          reject(error)
        }
      }
      reader.onerror = () => reject(new Error("Could not read file"))
    })
  }

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const field = event.target.name as "companyLogo" | "signatureImageUrl"
    const setUploading = field === "companyLogo" ? setUploadingLogo : setUploadingSignature
    setUploading(true)

    try {
      const url = await uploadImage(file, field)
      setForm((prev) => ({ ...prev, [field]: url }))
      setStatus(`${field === "companyLogo" ? "Logo" : "Signature"} uploaded successfully`)
    } catch (error) {
      console.error(error)
      setStatus("Failed to upload image")
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setStatus(null)

    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })

    if (res.ok) {
      setStatus("Settings saved successfully")
      return
    }

    const data = await res.json()
    setStatus(data.error || "Failed to save settings")
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Branding</CardTitle>
        <CardDescription>Upload logo, signature, and choose document font.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="companyName">Company Name</Label>
              <Input id="companyName" name="companyName" value={form.companyName} onChange={handleChange} />
            </div>
            <div>
              <Label htmlFor="companyEmail">Company Email</Label>
              <Input id="companyEmail" name="companyEmail" type="email" value={form.companyEmail} onChange={handleChange} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="companyPhone">Company Phone</Label>
              <Input id="companyPhone" name="companyPhone" value={form.companyPhone} onChange={handleChange} />
            </div>
            <div>
              <Label htmlFor="documentFont">Document Font</Label>
              <select id="documentFont" name="documentFont" value={form.documentFont} onChange={handleChange} className="mt-2 w-full rounded border p-2">
                {fonts.map((font) => (
                  <option key={font} value={font}>{font}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="quotationPrefix">Quotation Prefix</Label>
              <Input id="quotationPrefix" name="quotationPrefix" value={form.quotationPrefix} onChange={handleChange} />
            </div>
            <div>
              <Label htmlFor="receiptPrefix">Receipt Prefix</Label>
              <Input id="receiptPrefix" name="receiptPrefix" value={form.receiptPrefix} onChange={handleChange} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="companyLogo">Company Logo URL</Label>
              <Input id="companyLogo" name="companyLogo" value={form.companyLogo} onChange={handleChange} />
              <Label htmlFor="companyLogoUpload" className="mt-2 text-xs text-slate-500">Or upload a logo file</Label>
              <input
                id="companyLogoUpload"
                name="companyLogo"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="mt-2 block w-full text-sm text-slate-600"
              />
              {uploadingLogo && <p className="text-xs text-slate-500">Uploading logo…</p>}
            </div>
            <div>
              <Label htmlFor="signatureImageUrl">Signature Image URL</Label>
              <Input id="signatureImageUrl" name="signatureImageUrl" value={form.signatureImageUrl} onChange={handleChange} />
              <Label htmlFor="signatureImageUpload" className="mt-2 text-xs text-slate-500">Or upload a signature file</Label>
              <input
                id="signatureImageUpload"
                name="signatureImageUrl"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="mt-2 block w-full text-sm text-slate-600"
              />
              {uploadingSignature && <p className="text-xs text-slate-500">Uploading signature…</p>}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="companyAddress">Address</Label>
              <Input id="companyAddress" name="companyAddress" value={form.companyAddress} onChange={handleChange} />
            </div>
            <div>
              <Label htmlFor="companyCity">City</Label>
              <Input id="companyCity" name="companyCity" value={form.companyCity} onChange={handleChange} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="companyCountry">Country</Label>
              <Input id="companyCountry" name="companyCountry" value={form.companyCountry} onChange={handleChange} />
            </div>
            <div>
              <Label htmlFor="companyPostalCode">Postal Code</Label>
              <Input id="companyPostalCode" name="companyPostalCode" value={form.companyPostalCode} onChange={handleChange} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="companyTaxId">Tax ID</Label>
              <Input id="companyTaxId" name="companyTaxId" value={form.companyTaxId} onChange={handleChange} />
            </div>
            <div>
              <Label htmlFor="companyRegistration">Registration</Label>
              <Input id="companyRegistration" name="companyRegistration" value={form.companyRegistration} onChange={handleChange} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="defaultCurrency">Default Currency</Label>
              <Input id="defaultCurrency" name="defaultCurrency" value={form.defaultCurrency} onChange={handleChange} />
            </div>
            <div>
              <Label htmlFor="taxRate">Tax Rate (%)</Label>
              <Input id="taxRate" name="taxRate" type="number" value={form.taxRate} onChange={handleChange} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="companyWebsite">Website</Label>
              <Input id="companyWebsite" name="companyWebsite" value={form.companyWebsite} onChange={handleChange} />
            </div>
            <div>
              <Label htmlFor="quotationValidDays">Quotation Valid Days</Label>
              <Input id="quotationValidDays" name="quotationValidDays" type="number" value={form.quotationValidDays} onChange={handleChange} />
            </div>
          </div>

          <Button type="submit">Save Settings</Button>
          {status && <p className="text-sm text-slate-600">{status}</p>}
        </form>
      </CardContent>
    </Card>
  )
}
