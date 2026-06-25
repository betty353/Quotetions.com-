"use client"

import React from "react"
import jsPDF from "jspdf"

interface Props {
  quotationId: string
}

async function getBase64ImageFromUrl(url: string) {
  const response = await fetch(url)
  const blob = await response.blob()
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      if (typeof reader.result === "string") resolve(reader.result)
      else reject(new Error("Failed to convert image to base64"))
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export default function DownloadQuotationPdf({ quotationId }: Props) {
  async function handleDownload() {
    try {
      const [quotationRes, settingsRes] = await Promise.all([
        fetch(`/api/quotations/${quotationId}`),
        fetch(`/api/settings`),
      ])

      if (!quotationRes.ok || !settingsRes.ok) {
        throw new Error("Failed to load quotation or settings")
      }

      const quotationJson = await quotationRes.json()
      const settingsJson = await settingsRes.json()
      const q = quotationJson.data
      const setting = settingsJson.data

      const doc = new jsPDF({ unit: "pt" })
      const fontName = ["Helvetica", "Times", "Courier"].includes(setting.documentFont)
        ? setting.documentFont
        : "Helvetica"
      doc.setFont(fontName)
      doc.setFontSize(18)

      if (setting.companyLogo) {
        try {
          const logoData = await getBase64ImageFromUrl(setting.companyLogo)
          doc.addImage(logoData, "PNG", 40, 30, 120, 40)
        } catch (error) {
          console.warn("Could not render logo", error)
        }
      }

      doc.text(q.quotationNumber || "Quotation", 40, 100)
      doc.setFontSize(12)
      doc.text(setting.companyName || "", 40, 120)
      doc.text(`Customer: ${q.customer?.companyName || q.customer?.contactPerson || "Customer"}`, 40, 150)
      doc.text(`Date: ${new Date(q.createdAt).toLocaleDateString()}`, 40, 170)

      let y = 200
      doc.setFontSize(11)
      doc.text("Items:", 40, y)
      y += 20

      q.items.forEach((item: any, idx: number) => {
        const name = item.product?.name || item.productId
        const qty = item.quantity
        const unit = item.unitPrice || 0
        const total = item.total || qty * unit
        doc.text(`${idx + 1}. ${name} — ${qty} x ${unit} = ${total}`, 50, y)
        y += 18
        if (y > 700) {
          doc.addPage()
          y = 40
        }
      })

      y += 12
      doc.text(`Subtotal: ${q.subtotal ?? q.total}`, 40, y)
      doc.text(`Tax: ${q.taxAmount ?? 0}`, 200, y)
      doc.text(`Total: ${q.total}`, 340, y)

      if (setting.signatureImageUrl) {
        try {
          const signatureData = await getBase64ImageFromUrl(setting.signatureImageUrl)
          doc.addImage(signatureData, "PNG", 40, y + 40, 120, 40)
          doc.text("Authorized Signature", 40, y + 95)
        } catch (error) {
          console.warn("Could not render signature", error)
        }
      }

      doc.save(`${q.quotationNumber || "quotation"}.pdf`)
    } catch (err) {
      console.error(err)
      alert("Failed to generate PDF")
    }
  }

  return (
    <button onClick={handleDownload} className="inline-flex items-center gap-2 rounded bg-slate-100 px-3 py-2 text-sm">
      Download PDF
    </button>
  )
}
