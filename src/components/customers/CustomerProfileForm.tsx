"use client"

import { ChangeEvent, FormEvent, useState } from "react"
import { useRouter } from "next/navigation"
import { Camera, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type CustomerProfileFormProps = {
  customer: {
    id: string
    nrc?: string | null
    passportPhotoUrl?: string | null
    village?: string | null
    town?: string | null
    whatsappNumber?: string | null
    address?: string | null
    city?: string | null
    region?: string | null
    country?: string | null
    phone?: string | null
    user: {
      email: string
      firstName: string
      lastName: string
      phone?: string | null
    }
  }
  editableByStaff?: boolean
}

async function uploadImage(file: File) {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ""))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
  const res = await fetch("/api/uploads/image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ base64Image: dataUrl, folder: "astro-city/customers" }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || "Upload failed")
  return json.data?.secure_url || json.data?.url || ""
}

export default function CustomerProfileForm({ customer, editableByStaff = false }: CustomerProfileFormProps) {
  const router = useRouter()
  const [form, setForm] = useState({
    id: editableByStaff ? customer.id : undefined,
    firstName: customer.user.firstName || "",
    lastName: customer.user.lastName || "",
    email: customer.user.email || "",
    phone: customer.phone || customer.user.phone || "",
    nrc: customer.nrc || "",
    passportPhotoUrl: customer.passportPhotoUrl || "",
    village: customer.village || "",
    town: customer.town || "",
    whatsappNumber: customer.whatsappNumber || "",
    address: customer.address || "",
    city: customer.city || "",
    region: customer.region || "",
    country: customer.country || "",
  })
  const [status, setStatus] = useState("")
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    setUploading(true)
    setStatus("")
    try {
      const url = await uploadImage(file)
      setForm((prev) => ({ ...prev, passportPhotoUrl: url }))
      setStatus("Image uploaded. Save profile to apply it.")
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Image upload failed")
    } finally {
      setUploading(false)
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setStatus("")
    const res = await fetch("/api/customers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(form),
    })
    const json = await res.json()
    setSaving(false)
    if (!res.ok) {
      setStatus(json.error || "Failed to save profile")
      return
    }
    setStatus("Customer profile saved.")
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border bg-white p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Camera className="h-4 w-4 text-blue-600" />
        Customer profile image and address
      </div>
      {status && <p className="rounded-lg border bg-slate-50 px-3 py-2 text-sm text-slate-700">{status}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div><Label>First Name</Label><Input name="firstName" value={form.firstName} onChange={handleChange} /></div>
        <div><Label>Last Name</Label><Input name="lastName" value={form.lastName} onChange={handleChange} /></div>
        <div><Label>Email</Label><Input name="email" type="email" value={form.email} onChange={handleChange} /></div>
        <div><Label>Phone</Label><Input name="phone" value={form.phone} onChange={handleChange} /></div>
        <div><Label>WhatsApp</Label><Input name="whatsappNumber" value={form.whatsappNumber} onChange={handleChange} /></div>
        <div><Label>NRC</Label><Input name="nrc" value={form.nrc} onChange={handleChange} /></div>
        <div><Label>Passport Photo URL</Label><Input name="passportPhotoUrl" value={form.passportPhotoUrl} onChange={handleChange} /></div>
        <div><Label>Province</Label><Input name="region" value={form.region} onChange={handleChange} /></div>
        <div><Label>Town</Label><Input name="town" value={form.town} onChange={handleChange} /></div>
        <div><Label>Village / House Number</Label><Input name="address" value={form.address} onChange={handleChange} /></div>
        <div><Label>Country</Label><Input name="country" value={form.country} onChange={handleChange} /></div>
      </div>
      <div className="flex flex-wrap gap-2">
        <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 text-sm font-medium hover:bg-slate-50">
          <Upload className="h-4 w-4 text-emerald-600" />
          {uploading ? "Uploading..." : "Upload Image"}
          <input type="file" accept="image/*" onChange={handleFile} className="hidden" disabled={uploading} />
        </label>
        <Button type="submit" disabled={saving || uploading}>{saving ? "Saving..." : "Save Profile"}</Button>
      </div>
    </form>
  )
}
