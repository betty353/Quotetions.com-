"use client"

import Image from "next/image"
import { Copy, Eraser, Link2, PenLine, Upload } from "lucide-react"
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type PointerEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const fonts = ["Helvetica", "Times", "Courier"]

function canPreviewWithNextImage(url: string) {
  return /^https:\/\/[^/]*cloudinary\.com\//.test(url)
}

interface CompanySettingsFormProps {
  setting: any
  companySlug?: string | null
}

export default function CompanySettingsForm({ setting, companySlug }: CompanySettingsFormProps) {
  const signatureCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const [drawing, setDrawing] = useState(false)
  const [origin, setOrigin] = useState("")
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
  const [copyStatus, setCopyStatus] = useState<string | null>(null)

  const storeLink = companySlug && origin ? `${origin}/store/${companySlug}` : ""

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

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

  const uploadBase64Image = async (base64Image: string) => {
    const res = await fetch("/api/uploads/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ base64Image }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || "Upload failed")
    return data.data.secure_url || data.data.url || ""
  }

  const uploadImage = async (file: File) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    return new Promise<string>((resolve, reject) => {
      reader.onload = async () => {
        if (typeof reader.result !== "string") return reject(new Error("Invalid file upload"))

        try {
          resolve(await uploadBase64Image(reader.result))
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
      const url = await uploadImage(file)
      setForm((prev) => ({ ...prev, [field]: url }))
      setStatus(`${field === "companyLogo" ? "Logo" : "Signature"} uploaded. Save settings to apply it.`)
    } catch (error) {
      console.error(error)
      setStatus("Failed to upload image")
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setStatus(null)

    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(form),
    })

    if (res.ok) {
      setStatus("Settings saved successfully")
      return
    }

    const data = await res.json()
    setStatus(data.error || "Failed to save settings")
  }

  const getCanvasPoint = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = signatureCanvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    }
  }

  const startSignature = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = signatureCanvasRef.current
    const point = getCanvasPoint(event)
    if (!canvas || !point) return
    const context = canvas.getContext("2d")
    if (!context) return

    event.currentTarget.setPointerCapture(event.pointerId)
    context.lineCap = "round"
    context.lineJoin = "round"
    context.lineWidth = 3
    context.strokeStyle = "#111827"
    context.beginPath()
    context.moveTo(point.x, point.y)
    setDrawing(true)
  }

  const drawSignature = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!drawing) return
    const canvas = signatureCanvasRef.current
    const point = getCanvasPoint(event)
    if (!canvas || !point) return
    const context = canvas.getContext("2d")
    if (!context) return

    context.lineTo(point.x, point.y)
    context.stroke()
  }

  const stopSignature = () => {
    setDrawing(false)
  }

  const clearSignaturePad = () => {
    const canvas = signatureCanvasRef.current
    const context = canvas?.getContext("2d")
    if (!canvas || !context) return
    context.clearRect(0, 0, canvas.width, canvas.height)
  }

  const saveDrawnSignature = async () => {
    const canvas = signatureCanvasRef.current
    if (!canvas) return

    setUploadingSignature(true)
    setStatus(null)
    try {
      const url = await uploadBase64Image(canvas.toDataURL("image/png"))
      setForm((prev) => ({ ...prev, signatureImageUrl: url }))
      setStatus("Signature captured. Save settings to apply it to documents.")
    } catch (error) {
      console.error(error)
      setStatus("Failed to upload signature")
    } finally {
      setUploadingSignature(false)
    }
  }

  const copyStoreLink = async () => {
    if (!storeLink) return
    await navigator.clipboard.writeText(storeLink)
    setCopyStatus("Copied")
    setTimeout(() => setCopyStatus(null), 2000)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Branding</CardTitle>
        <CardDescription>Upload logo, capture signatures, publish your store link, and choose document formatting.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {storeLink && (
            <div className="rounded-xl border border-border bg-surface p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Link2 className="h-4 w-4 text-blue-600" />
                    Public customer store link
                  </div>
                  <p className="mt-1 truncate text-sm text-muted-foreground">{storeLink}</p>
                </div>
                <Button type="button" variant="outline" onClick={copyStoreLink}>
                  <Copy className="h-4 w-4 text-emerald-600" />
                  {copyStatus || "Copy Link"}
                </Button>
              </div>
            </div>
          )}

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
              {uploadingLogo && <p className="text-xs text-slate-500">Uploading logo...</p>}
              {canPreviewWithNextImage(form.companyLogo) && (
                <div className="mt-3 flex h-16 w-28 items-center justify-center rounded-lg border border-border bg-white p-2">
                  <Image src={form.companyLogo} alt="Company logo preview" width={112} height={64} className="max-h-full w-auto object-contain" />
                </div>
              )}
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
              {uploadingSignature && <p className="text-xs text-slate-500">Uploading signature...</p>}
              {canPreviewWithNextImage(form.signatureImageUrl) && (
                <div className="mt-3 flex h-16 w-36 items-center justify-center rounded-lg border border-border bg-white p-2">
                  <Image src={form.signatureImageUrl} alt="Signature preview" width={144} height={64} className="max-h-full w-auto object-contain" />
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <PenLine className="h-5 w-5 text-violet-600" />
              <div>
                <h3 className="text-sm font-semibold">Draw Signature</h3>
                <p className="text-xs text-muted-foreground">Use a phone, tablet, stylus, or mouse. Capture it, then save settings.</p>
              </div>
            </div>
            <canvas
              ref={signatureCanvasRef}
              width={720}
              height={220}
              aria-label="Draw company signature"
              onPointerDown={startSignature}
              onPointerMove={drawSignature}
              onPointerUp={stopSignature}
              onPointerCancel={stopSignature}
              className="h-44 w-full touch-none rounded-xl border border-dashed border-border bg-white"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={clearSignaturePad}>
                <Eraser className="h-4 w-4 text-amber-600" />
                Clear
              </Button>
              <Button type="button" onClick={saveDrawnSignature} disabled={uploadingSignature}>
                <Upload className="h-4 w-4 text-white" />
                {uploadingSignature ? "Uploading..." : "Use Signature"}
              </Button>
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
