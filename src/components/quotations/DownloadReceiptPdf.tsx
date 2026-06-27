"use client"

import React from "react"
import jsPDF from "jspdf"

interface Props {
  receiptId: string
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

export default function DownloadReceiptPdf({ receiptId }: Props) {
  async function handleDownload() {
    try {
      const [receiptRes, settingsRes] = await Promise.all([
        fetch(`/api/receipts/${receiptId}`),
        fetch(`/api/settings`),
      ])

      if (!receiptRes.ok || !settingsRes.ok) {
        throw new Error("Failed to load receipt or settings")
      }

      const receiptJson = await receiptRes.json()
      const settingsJson = await settingsRes.json()
      const receipt = receiptJson.data
      if (!receipt) return alert("Receipt not found")
      const setting = settingsJson.data

      const doc = new jsPDF({ unit: "pt" })
      const fontName = ["Helvetica", "Times", "Courier"].includes(setting.documentFont)
        ? setting.documentFont
        : "Helvetica"
      doc.setFont(fontName)
      doc.setFontSize(16)

      if (setting.companyLogo) {
        try {
          const logoData = await getBase64ImageFromUrl(setting.companyLogo)
          doc.addImage(logoData, "PNG", 40, 30, 120, 40)
        } catch (error) {
          console.warn("Could not render logo", error)
        }
      }

      doc.text(receipt.receiptNumber || "Receipt", 40, 100)
      doc.setFontSize(11)
      doc.text(setting.companyName || "", 40, 120)
      doc.text(`Quotation: ${receipt.quotation?.quotationNumber || "-"}`, 40, 150)
      doc.text(`Customer: ${receipt.customer?.companyName || receipt.customer?.contactPerson || 'Customer'}`, 40, 170)
      doc.text(`Amount: ${receipt.amount}`, 40, 190)
      doc.text(`Method: ${receipt.paymentMethod}`, 40, 210)
      doc.text(`Reference: ${receipt.reference || '-'}`, 40, 230)
      doc.text(`Paid Date: ${new Date(receipt.createdAt).toLocaleString()}`, 40, 250)
      doc.text(`Payment Provider: ${receipt.provider || "MANUAL"}`, 40, 270)
      doc.text(`Notes: ${receipt.notes || '-'}`, 40, 290)

      if (setting.signatureImageUrl) {
        try {
          const signatureData = await getBase64ImageFromUrl(setting.signatureImageUrl)
          doc.addImage(signatureData, "PNG", 40, 320, 120, 40)
          doc.text("Authorized Signature", 40, 370)
        } catch (error) {
          console.warn("Could not render signature", error)
        }
      }

      doc.save(`${receipt.receiptNumber || "receipt"}.pdf`)
    } catch (err) {
      console.error(err)
      alert("Failed to generate receipt PDF")
    }
  }

  return (
    <button onClick={handleDownload} className="inline-flex items-center gap-2 rounded bg-slate-100 px-3 py-2 text-sm">
      Download PDF
    </button>
  )
}
