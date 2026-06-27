"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import SafeImage from "@/components/ui/safe-image"

type Category = { id: string; name: string }

interface ProductFormProps {
  categories: Category[]
  initial?: any
  mode?: "create" | "edit"
}

export default function ProductForm({ categories = [], initial = {}, mode = "create" }: ProductFormProps) {
  const router = useRouter()
  const [sku, setSku] = useState(initial.sku || "")
  const [name, setName] = useState(initial.name || "")
  const [description, setDescription] = useState(initial.description || "")
  const [categoryId, setCategoryId] = useState(initial.categoryId || (categories[0]?.id ?? ""))
  const [unitPrice, setUnitPrice] = useState(initial.unitPrice ? String(initial.unitPrice) : "0")
  const [currency, setCurrency] = useState(initial.currency || "USD")
  const [stock, setStock] = useState(initial.stock ?? 0)
  const [imageUrl, setImageUrl] = useState(initial.image || "")
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    setError("")

    try {
      const payload = {
        sku,
        name,
        description,
        categoryId,
        unitPrice: Number(unitPrice),
        currency,
        stock: Number(stock),
        image: imageUrl || null,
      }

      const method = mode === "create" ? "POST" : "PUT"
      const url = mode === "create" ? "/api/products" : `/api/products/${initial.id}`

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Failed to save product")
        setIsSubmitting(false)
        return
      }

      // Redirect to products list
      router.push("/dashboard/products")
    } catch (err: any) {
      setError(err.message || "Unexpected error")
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="sku">SKU</Label>
          <Input id="sku" value={sku} onChange={(e) => setSku(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="name">Name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label htmlFor="category">Category</Label>
          <select id="category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full rounded border p-2">
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="unitPrice">Unit Price</Label>
          <Input id="unitPrice" type="number" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="currency">Currency</Label>
          <Input id="currency" value={currency} onChange={(e) => setCurrency(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="stock">Stock</Label>
          <Input id="stock" type="number" value={String(stock)} onChange={(e) => setStock(Number(e.target.value))} />
        </div>
        <div>
          <Label htmlFor="imageUrl">Image URL</Label>
          <Input id="imageUrl" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Upload Image</Label>
        <div className="flex items-center gap-3">
          <input
            type="file"
            accept="image/*"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              setUploadError(null)
              setFilePreview(URL.createObjectURL(file))
              // read as data URL
              const reader = new FileReader()
              reader.onload = async () => {
                const dataUrl = reader.result as string
                try {
                  setIsUploadingImage(true)
                  const res = await fetch("/api/uploads/image", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ base64Image: dataUrl }),
                  })
                  const json = await res.json()
                  if (!res.ok) throw new Error(json.error || "Upload failed")
                  const uploadedUrl = json.data?.secure_url || json.data?.url || json.data?.secureUrl || json.data?.secureUrl || json.data?.secure_url
                  if (uploadedUrl) setImageUrl(uploadedUrl)
                } catch (err: any) {
                  setUploadError(err.message || "Upload failed")
                } finally {
                  setIsUploadingImage(false)
                }
              }
              reader.readAsDataURL(file)
            }}
          />
          {isUploadingImage ? <div className="text-sm">Uploading...</div> : <div className="text-sm text-muted-foreground">Select an image to upload to Cloudinary</div>}
        </div>
        {uploadError && <div className="text-sm text-red-600">{uploadError}</div>}
        {filePreview && (
          <div className="mt-2">
            <SafeImage src={filePreview} alt="Product preview" width={128} height={128} className="h-32 w-32 rounded-md object-cover" />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving..." : mode === "create" ? "Create Product" : "Save Changes"}</Button>
        <Button variant="ghost" type="button" onClick={() => window.history.back()}>Cancel</Button>
      </div>
    </form>
  )
}
