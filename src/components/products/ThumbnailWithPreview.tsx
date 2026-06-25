"use client"

import React, { useState, useEffect } from "react"

interface Props {
  src?: string | null
  alt?: string
}

export default function ThumbnailWithPreview({ src, alt }: Props) {
  const [open, setOpen] = useState(false)
  const [hover, setHover] = useState(false)

  if (!src) {
    return (
      <div className="w-12 h-12 bg-slate-100 rounded flex items-center justify-center text-xs text-muted-foreground">No Image</div>
    )
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    if (open) window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  return (
    <div className="relative inline-block" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            setOpen(true)
          }
        }}
        aria-haspopup="dialog"
        className="focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
      >
        <img src={src} alt={alt} className="w-12 h-12 object-cover rounded" />
      </button>

      {hover && (
        <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-40 w-40 h-40 p-1 bg-white border rounded shadow-md">
          <img src={src} alt={alt} className="w-full h-full object-contain" />
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setOpen(false)} role="dialog" aria-modal="true">
          <div className="bg-white rounded p-4 max-w-[90%] max-h-[90%]" onClick={(e) => e.stopPropagation()}>
            <img src={src} alt={alt} className="max-h-[80vh] object-contain" />
            <div className="text-right mt-2">
              <button onClick={() => setOpen(false)} className="px-3 py-1 bg-slate-200 rounded">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
