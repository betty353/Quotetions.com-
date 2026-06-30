"use client"

import { ChangeEvent, FormEvent, useState } from "react"
import { useRouter } from "next/navigation"
import { UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function CreateCustomerForm() {
  const router = useRouter()
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [passportPhotoUrl, setPassportPhotoUrl] = useState("")
  const [uploading, setUploading] = useState(false)

  async function uploadImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    setUploading(true)
    setError("")
    try {
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
      setPassportPhotoUrl(json.data?.secure_url || json.data?.url || "")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image upload failed")
    } finally {
      setUploading(false)
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setMessage("")
    setError("")

    const form = new FormData(event.currentTarget)
    const payload = { ...Object.fromEntries(form.entries()), passportPhotoUrl }
    const res = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    })
    const json = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(json.error || "Could not create customer.")
      return
    }

    event.currentTarget.reset()
    setPassportPhotoUrl("")
    setMessage(`Customer created. Temporary password: ${json.data.temporaryPassword}`)
    router.refresh()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><UserPlus className="h-4 w-4 text-blue-600" /> Add Customer</CardTitle>
        <CardDescription>For customers who need staff help creating their account.</CardDescription>
      </CardHeader>
      <CardContent>
        {message && <p className="mb-3 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">{message}</p>}
        {error && <p className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-4">
          <div><Label>First Name</Label><Input name="firstName" required /></div>
          <div><Label>Last Name</Label><Input name="lastName" required /></div>
          <div><Label>Email</Label><Input name="email" type="email" required /></div>
          <div><Label>Phone</Label><Input name="phone" required /></div>
          <div><Label>NRC</Label><Input name="nrc" /></div>
          <div><Label>Passport Photo URL</Label><Input name="passportPhotoUrl" value={passportPhotoUrl} onChange={(event) => setPassportPhotoUrl(event.target.value)} /></div>
          <div><Label>Town</Label><Input name="town" /></div>
          <div><Label>WhatsApp</Label><Input name="whatsappNumber" /></div>
          <div className="md:col-span-2"><Label>Village / House Number</Label><Input name="address" /></div>
          <div><Label>Province</Label><Input name="region" /></div>
          <div><Label>Country</Label><Input name="country" /></div>
          <div className="md:col-span-2">
            <Label>Upload Customer Image</Label>
            <input type="file" accept="image/*" onChange={uploadImage} disabled={uploading} className="mt-2 block w-full text-sm text-slate-600" />
            {uploading && <p className="mt-1 text-xs text-muted-foreground">Uploading...</p>}
          </div>
          <div className="md:col-span-4">
            <Button type="submit" disabled={loading}>{loading ? "Creating..." : "Create Customer"}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
