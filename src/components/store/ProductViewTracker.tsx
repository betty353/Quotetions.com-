"use client"

import { useEffect } from "react"

type ProductViewTrackerProps = {
  companySlug: string
  productId: string
}

function getSessionId() {
  const key = "astro-store-session-id"
  const existing = window.localStorage.getItem(key)
  if (existing) return existing

  const generated = crypto.randomUUID()
  window.localStorage.setItem(key, generated)
  return generated
}

export default function ProductViewTracker({ companySlug, productId }: ProductViewTrackerProps) {
  useEffect(() => {
    const seenKey = `astro-store-viewed:${companySlug}:${productId}`
    if (window.sessionStorage.getItem(seenKey)) return
    window.sessionStorage.setItem(seenKey, "1")

    fetch(`/api/store/${companySlug}/products/${productId}/view`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ sessionId: getSessionId() }),
    }).catch(() => {
      window.sessionStorage.removeItem(seenKey)
    })
  }, [companySlug, productId])

  return null
}
