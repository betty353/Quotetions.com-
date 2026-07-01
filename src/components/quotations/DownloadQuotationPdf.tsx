"use client"

import jsPDF, { GState } from "jspdf"

interface Props {
  quotationId: string
  documentType?: "quotation" | "invoice"
  includeHistory?: boolean
}

type DocumentType = "quotation" | "invoice"

type PdfSetting = {
  companyName?: string | null
  companyEmail?: string | null
  companyPhone?: string | null
  companyAddress?: string | null
  companyCity?: string | null
  companyRegion?: string | null
  companyCountry?: string | null
  companyPostalCode?: string | null
  companyTaxId?: string | null
  companyRegistration?: string | null
  companyWebsite?: string | null
  companyLogo?: string | null
  signatureImageUrl?: string | null
  documentFont?: string | null
}

async function getBase64ImageFromUrl(url: string) {
  const response = await fetch(url, { cache: "no-store" })
  if (!response.ok) throw new Error("Failed to load image")
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

function imageType(dataUrl: string) {
  return dataUrl.startsWith("data:image/jpeg") || dataUrl.startsWith("data:image/jpg") ? "JPEG" : "PNG"
}

function money(value: unknown, currency = "ZMW") {
  return new Intl.NumberFormat("en-ZM", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(Number(value || 0))
}

function clean(value: unknown, fallback = "-") {
  const text = String(value ?? "").trim()
  return text || fallback
}

function companyAddress(setting: PdfSetting) {
  return [
    setting.companyAddress,
    setting.companyCity,
    setting.companyRegion,
    setting.companyCountry,
    setting.companyPostalCode,
  ].filter(Boolean).join(", ")
}

function drawImageContain(doc: jsPDF, dataUrl: string, x: number, y: number, maxWidth: number, maxHeight: number) {
  const props = doc.getImageProperties(dataUrl)
  const ratio = Math.min(maxWidth / props.width, maxHeight / props.height)
  const width = props.width * ratio
  const height = props.height * ratio
  doc.addImage(dataUrl, imageType(dataUrl), x + (maxWidth - width) / 2, y + (maxHeight - height) / 2, width, height)
}

function tryWithOpacity(doc: jsPDF, opacity: number, draw: () => void) {
  try {
    doc.setGState(new GState({ opacity }))
    draw()
    doc.setGState(new GState({ opacity: 1 }))
    return true
  } catch {
    doc.setGState(new GState({ opacity: 1 }))
    return false
  }
}

function drawWatermark(doc: jsPDF, logoData: string | null, companyName: string) {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  if (logoData) {
    const rendered = tryWithOpacity(doc, 0.14, () => {
      drawImageContain(doc, logoData, pageWidth / 2 - 170, pageHeight / 2 - 135, 340, 270)
    })
    if (rendered) return
  }

  doc.setTextColor(218, 218, 218)
  doc.setFontSize(58)
  doc.setFont("Helvetica", "bold")
  doc.text(companyName.slice(0, 28).toUpperCase(), pageWidth / 2, pageHeight / 2, {
    align: "center",
    angle: -28,
  })
}

function drawShell(doc: jsPDF, setting: PdfSetting, logoData: string | null, title: string, number: string, documentType: DocumentType = "quotation") {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const companyName = clean(setting.companyName, "Company")
  const isInvoice = documentType === "invoice"

  drawWatermark(doc, logoData, companyName)

  if (isInvoice) {
    doc.setFillColor(20, 84, 180)
    doc.rect(0, 0, pageWidth, 96, "F")
    doc.setFillColor(239, 246, 255)
    doc.triangle(0, 96, pageWidth, 96, pageWidth, 154, "F")
    doc.setDrawColor(20, 84, 180)
    doc.setLineWidth(1.2)
    doc.line(40, pageHeight - 44, pageWidth - 40, pageHeight - 44)
  } else {
    doc.setFillColor(255, 255, 255)
    doc.rect(0, 0, pageWidth, 96, "F")
    doc.setDrawColor(17, 24, 39)
    doc.setLineWidth(1)
    doc.line(40, 106, pageWidth - 40, 106)
    doc.line(40, pageHeight - 44, pageWidth - 40, pageHeight - 44)
  }

  if (logoData) {
    if (isInvoice) {
      doc.setFillColor(255, 255, 255)
      doc.roundedRect(34, 20, 132, 64, 12, 12, "F")
      drawImageContain(doc, logoData, 42, 26, 116, 52)
    } else {
      doc.setFillColor(255, 255, 255)
      doc.roundedRect(pageWidth - 154, 18, 120, 68, 10, 10, "F")
      drawImageContain(doc, logoData, pageWidth - 146, 24, 104, 56)
    }
  } else {
    doc.setDrawColor(isInvoice ? 255 : 17, isInvoice ? 255 : 24, isInvoice ? 255 : 39)
    doc.setFillColor(isInvoice ? 255 : 248, isInvoice ? 255 : 250, isInvoice ? 255 : 252)
    doc.circle(isInvoice ? 66 : pageWidth - 94, 52, 28, "FD")
    doc.setTextColor(isInvoice ? 20 : 17, isInvoice ? 84 : 24, isInvoice ? 180 : 39)
    doc.setFontSize(18)
    doc.setFont("Helvetica", "bold")
    doc.text(companyName.slice(0, 1).toUpperCase(), isInvoice ? 66 : pageWidth - 94, 58, { align: "center" })
  }

  if (isInvoice) {
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(11)
    doc.setFont("Helvetica", "bold")
    doc.text(companyName, 178, 38)
    doc.setFont("Helvetica", "normal")
    doc.setTextColor(219, 234, 254)
    doc.text(clean(setting.companyEmail, ""), 178, 54)
    doc.text([setting.companyPhone, setting.companyWebsite].filter(Boolean).join(" | "), 178, 68)

    doc.setFont("Helvetica", "bold")
    doc.setFontSize(28)
    doc.setTextColor(20, 84, 180)
    doc.text(title, pageWidth - 40, 136, { align: "right" })
    doc.setFontSize(10)
    doc.setTextColor(37, 99, 235)
    doc.text(number, pageWidth - 40, 154, { align: "right" })
  } else {
    const contactLine = [setting.companyPhone, setting.companyWebsite].filter(Boolean).join(" | ")
    const centerX = pageWidth / 2
    doc.setTextColor(17, 24, 39)
    doc.setFontSize(10)
    doc.setFont("Helvetica", "bold")
    doc.text(companyName, centerX, 34, { align: "center", maxWidth: 230 })
    doc.setFont("Helvetica", "normal")
    doc.setTextColor(82, 82, 91)
    doc.text(clean(setting.companyEmail, ""), centerX, 50, { align: "center", maxWidth: 230 })
    doc.setFontSize(8)
    doc.text(doc.splitTextToSize(contactLine, 240), centerX, 64, { align: "center" })

    doc.setFont("Helvetica", "bold")
    doc.setFontSize(28)
    doc.setTextColor(17, 24, 39)
    doc.text(title, 40, 48)
    doc.setFontSize(10)
    doc.setTextColor(71, 85, 105)
    doc.text(number, 42, 68)
  }

  doc.setFont("Helvetica", "normal")
  doc.setFontSize(8)
  doc.setTextColor(148, 163, 184)
  doc.text(`${companyName} | Generated by Astro city crm`, 40, pageHeight - 26)
  doc.text(`Page ${doc.getNumberOfPages()}`, pageWidth - 40, pageHeight - 26, { align: "right" })
}

function drawInfoBox(doc: jsPDF, title: string, lines: string[], x: number, y: number, width: number, height: number) {
  doc.setDrawColor(226, 232, 240)
  doc.setFillColor(248, 250, 252)
  doc.roundedRect(x, y, width, height, 8, 8, "FD")
  doc.setFont("Helvetica", "bold")
  doc.setFontSize(9)
  doc.setTextColor(100, 116, 139)
  doc.text(title.toUpperCase(), x + 14, y + 20)
  doc.setFont("Helvetica", "normal")
  doc.setFontSize(10)
  doc.setTextColor(17, 24, 39)

  let lineY = y + 40
  lines.filter(Boolean).forEach((line) => {
    const wrapped = doc.splitTextToSize(line, width - 28)
    doc.text(wrapped, x + 14, lineY)
    lineY += wrapped.length * 12 + 2
  })
}

function drawCustomerHistory(doc: jsPDF, setting: PdfSetting, logoData: string | null, customer: any, currency: string) {
  if (!customer) return
  doc.addPage()
  drawShell(doc, setting, logoData, "CUSTOMER HISTORY", customer.contactPerson || customer.companyName || "Customer")
  let y = 124
  doc.setFont("Helvetica", "bold")
  doc.setFontSize(14)
  doc.setTextColor(17, 24, 39)
  doc.text(customer.companyName || customer.contactPerson || customer.user?.email || "Customer", 40, y)
  y += 26

  const rows = [
    ...(customer.quotations || []).map((item: any) => ({
      type: "Quotation",
      number: item.quotationNumber,
      status: item.status,
      amount: money(item.total, currency),
      date: new Date(item.createdAt).toLocaleDateString(),
    })),
    ...(customer.payments || []).map((item: any) => ({
      type: "Payment",
      number: item.paymentNumber,
      status: item.status,
      amount: money(item.amount, currency),
      date: new Date(item.paymentDate).toLocaleDateString(),
    })),
    ...(customer.receipts || []).map((item: any) => ({
      type: "Receipt",
      number: item.receiptNumber,
      status: "Issued",
      amount: money(item.amount, currency),
      date: new Date(item.createdAt).toLocaleDateString(),
    })),
  ].slice(0, 18)

  doc.setFont("Helvetica", "bold")
  doc.setFontSize(9)
  doc.setTextColor(100, 116, 139)
  doc.text("TYPE", 40, y)
  doc.text("NUMBER", 130, y)
  doc.text("STATUS", 280, y)
  doc.text("AMOUNT", 380, y)
  doc.text("DATE", 490, y)
  y += 14

  doc.setFont("Helvetica", "normal")
  doc.setFontSize(9)
  doc.setTextColor(17, 24, 39)
  rows.forEach((row, index) => {
    doc.setFillColor(index % 2 === 0 ? 248 : 255, index % 2 === 0 ? 250 : 255, index % 2 === 0 ? 252 : 255)
    doc.rect(40, y - 10, 515, 22, "F")
    doc.text(row.type, 44, y + 4)
    doc.text(String(row.number || "-"), 130, y + 4)
    doc.text(String(row.status || "-"), 280, y + 4)
    doc.text(String(row.amount || "-"), 380, y + 4)
    doc.text(String(row.date || "-"), 490, y + 4)
    y += 24
  })
}

function normalizeSetting(q: any, fallback: PdfSetting): PdfSetting {
  const company = q.company || {}
  const setting = company.settings || fallback || {}
  return {
    ...setting,
    companyName: setting.companyName || company.name || fallback.companyName,
    companyEmail: setting.companyEmail || company.email || fallback.companyEmail,
    companyPhone: setting.companyPhone || company.phone || fallback.companyPhone,
    companyAddress: setting.companyAddress || company.address || fallback.companyAddress,
    companyCity: setting.companyCity || company.city || fallback.companyCity,
    companyRegion: setting.companyRegion || company.region || fallback.companyRegion,
    companyCountry: setting.companyCountry || company.country || fallback.companyCountry,
    companyPostalCode: setting.companyPostalCode || company.postalCode || fallback.companyPostalCode,
    companyTaxId: setting.companyTaxId || company.taxId || fallback.companyTaxId,
    companyRegistration: setting.companyRegistration || company.registrationNumber || fallback.companyRegistration,
    companyWebsite: setting.companyWebsite || company.website || fallback.companyWebsite,
    companyLogo: setting.companyLogo || company.logoUrl || fallback.companyLogo,
    signatureImageUrl: setting.signatureImageUrl || fallback.signatureImageUrl,
  }
}

export default function DownloadQuotationPdf({ quotationId, documentType = "quotation", includeHistory = false }: Props) {
  async function handleDownload() {
    try {
      const [quotationRes, settingsRes] = await Promise.all([
        fetch(`/api/quotations/${quotationId}`, { credentials: "include" }),
        fetch(`/api/settings`, { credentials: "include" }),
      ])

      if (!quotationRes.ok) throw new Error("Failed to load quotation")

      const quotationJson = await quotationRes.json()
      const settingsJson = settingsRes.ok ? await settingsRes.json() : { data: {} }
      const q = quotationJson.data
      const setting = normalizeSetting(q, settingsJson.data || {})
      const fontName = ["Helvetica", "Times", "Courier"].includes(clean(setting.documentFont, "Helvetica"))
        ? clean(setting.documentFont, "Helvetica")
        : "Helvetica"

      const doc = new jsPDF({ unit: "pt" })
      doc.setFont(fontName)

      let logoData: string | null = null
      if (setting.companyLogo) {
        try {
          logoData = await getBase64ImageFromUrl(setting.companyLogo)
        } catch (error) {
          console.warn("Could not render company logo", error)
        }
      }

      const currency = "ZMW"
      const isInvoice = documentType === "invoice"
      const documentTitle = isInvoice ? "INVOICE" : "QUOTATION"
      const documentNumberLabel = `${isInvoice ? "Invoice" : "Quote"} No: ${q.quotationNumber || "-"}`
      drawShell(doc, setting, logoData, documentTitle, documentNumberLabel, documentType)

      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const customerName = q.customer?.companyName || q.customer?.contactPerson || q.customer?.user?.email || "Customer"
      const customerAddress = [
        q.customer?.address,
        q.customer?.town || q.customer?.city,
        q.customer?.region,
        q.customer?.country,
      ].filter(Boolean).join(", ")

      drawInfoBox(doc, "Customer details", [
        customerName,
        customerAddress,
        q.customer?.email || q.customer?.user?.email || "",
        q.customer?.phone ? `Phone: ${q.customer.phone}` : "",
        q.customer?.nrc ? `NRC: ${q.customer.nrc}` : "",
      ], 40, isInvoice ? 170 : 172, 245, 112)

      drawInfoBox(doc, `${isInvoice ? "Invoice" : "Quotation"} details`, [
        documentNumberLabel,
        `Date: ${new Date(q.createdAt).toLocaleDateString()}`,
        isInvoice ? `Due date: ${q.validUntil ? new Date(q.validUntil).toLocaleDateString() : "On receipt"}` : `Valid until: ${q.validUntil ? new Date(q.validUntil).toLocaleDateString() : "Not set"}`,
        `Status: ${q.status || "DRAFT"}`,
      ], pageWidth - 285, isInvoice ? 170 : 172, 245, 112)

      const address = companyAddress(setting)
      if (!isInvoice && (address || setting.companyTaxId || setting.companyRegistration)) {
        drawInfoBox(doc, "Company information", [
          address,
          setting.companyTaxId ? `Tax ID: ${setting.companyTaxId}` : "",
          setting.companyRegistration ? `Registration: ${setting.companyRegistration}` : "",
        ], 40, 300, pageWidth - 80, 62)
      }

      let y = isInvoice ? 322 : 386
      const tableX = 40
      const columns = [
        { label: "Item Description", x: tableX, width: 230 },
        { label: "Qty", x: tableX + 230, width: 55 },
        { label: "Unit Price", x: tableX + 285, width: 90 },
        { label: "Discount", x: tableX + 375, width: 80 },
        { label: "Total", x: tableX + 455, width: 100 },
      ]

      const drawTableHeader = () => {
        if (isInvoice) {
          doc.setFillColor(20, 84, 180)
          doc.roundedRect(tableX, y, pageWidth - 80, 30, 4, 4, "F")
          doc.setTextColor(255, 255, 255)
        } else {
          doc.setFillColor(242, 242, 242)
          doc.setDrawColor(130, 130, 130)
          doc.rect(tableX, y, pageWidth - 80, 30, "FD")
          doc.setTextColor(17, 24, 39)
        }
        doc.setFont("Helvetica", "bold")
        doc.setFontSize(9)
        columns.forEach((column) => doc.text(column.label, column.x + 10, y + 19))
        y += 34
      }

      drawTableHeader()

      q.items.forEach((item: any, index: number) => {
        const name = item.product?.name || item.productId || `Item ${index + 1}`
        const wrappedName = doc.splitTextToSize(name, columns[0].width - 18)
        const rowHeight = Math.max(34, wrappedName.length * 12 + 18)

        if (y + rowHeight > pageHeight - 160) {
          doc.addPage()
          drawShell(doc, setting, logoData, documentTitle, documentNumberLabel, documentType)
          y = isInvoice ? 180 : 180
          drawTableHeader()
        }

        doc.setDrawColor(isInvoice ? 191 : 150, isInvoice ? 219 : 150, isInvoice ? 254 : 150)
        doc.setFillColor(index % 2 === 0 ? 255 : 243, index % 2 === 0 ? 255 : 248, index % 2 === 0 ? 255 : 255)
        if (isInvoice) doc.roundedRect(tableX, y - 4, pageWidth - 80, rowHeight, 4, 4, "FD")
        else doc.rect(tableX, y - 4, pageWidth - 80, rowHeight, "FD")
        doc.setTextColor(17, 24, 39)
        doc.setFont("Helvetica", "normal")
        doc.setFontSize(9)
        doc.text(wrappedName, columns[0].x + 10, y + 12)
        doc.text(String(item.quantity || 0), columns[1].x + 10, y + 12)
        doc.text(money(item.unitPrice, currency), columns[2].x + 10, y + 12)
        doc.text(money(item.discount, currency), columns[3].x + 10, y + 12)
        doc.setFont("Helvetica", "bold")
        doc.text(money(item.total, currency), columns[4].x + 10, y + 12)
        y += rowHeight + 4
      })

      y += 12
      if (y + (isInvoice ? 156 : 236) > pageHeight - 80) {
        doc.addPage()
        drawShell(doc, setting, logoData, documentTitle, documentNumberLabel, documentType)
        y = isInvoice ? 180 : 180
      }

      const totalX = pageWidth - 280
      doc.setDrawColor(isInvoice ? 191 : 150, isInvoice ? 219 : 150, isInvoice ? 254 : 150)
      doc.setFillColor(isInvoice ? 239 : 248, isInvoice ? 246 : 248, isInvoice ? 255 : 248)
      doc.roundedRect(totalX, y, 240, 112, isInvoice ? 4 : 0, isInvoice ? 4 : 0, "FD")
      const totalRows = [
        ["Subtotal", money(q.subtotal ?? q.total, currency)],
        ["Tax", money(q.taxAmount ?? 0, currency)],
        ["Discount", money(q.discountAmount ?? 0, currency)],
        ["Grand Total", money(q.total, currency)],
      ]
      totalRows.forEach(([label, value], index) => {
        const isGrandTotal = index === totalRows.length - 1
        const rowY = y + 22 + index * 22
        if (isInvoice && isGrandTotal) {
          doc.setFillColor(20, 84, 180)
          doc.rect(totalX, rowY - 15, 240, 28, "F")
        }
        doc.setFont("Helvetica", isGrandTotal ? "bold" : "normal")
        doc.setFontSize(isGrandTotal ? 12 : 10)
        doc.setTextColor(isInvoice && isGrandTotal ? 255 : isGrandTotal ? 17 : 100, isInvoice && isGrandTotal ? 255 : isGrandTotal ? 24 : 116, isInvoice && isGrandTotal ? 255 : isGrandTotal ? 39 : 139)
        doc.text(label, totalX + 14, rowY)
        doc.text(value, totalX + 226, rowY, { align: "right" })
      })

      const notesX = 40
      const notesWidth = totalX - 55
      if (q.notes || q.terms) {
        if (!isInvoice) {
          doc.setDrawColor(150, 150, 150)
          doc.rect(notesX, y, notesWidth, 112, "S")
        }
        doc.setFont("Helvetica", "bold")
        doc.setFontSize(10)
        doc.setTextColor(17, 24, 39)
        doc.text(isInvoice ? "Payment info and terms" : "Terms and Conditions", notesX + (isInvoice ? 0 : 12), y + 18)
        doc.setFont("Helvetica", "normal")
        doc.setFontSize(9)
        doc.setTextColor(71, 85, 105)
        const notes = doc.splitTextToSize([q.notes, q.terms].filter(Boolean).join("\n\n"), notesWidth - (isInvoice ? 0 : 24))
        doc.text(notes, notesX + (isInvoice ? 0 : 12), y + 38)
      }

      const signatureY = isInvoice ? pageHeight - 116 : pageHeight - 218
      if (setting.signatureImageUrl) {
        try {
          const signatureData = await getBase64ImageFromUrl(setting.signatureImageUrl)
          drawImageContain(doc, signatureData, 40, signatureY - 44, 150, 44)
        } catch (error) {
          console.warn("Could not render signature", error)
        }
      }
      doc.setDrawColor(isInvoice ? 20 : 17, isInvoice ? 84 : 24, isInvoice ? 180 : 39)
      doc.line(40, signatureY, 210, signatureY)
      doc.setFont("Helvetica", "normal")
      doc.setFontSize(9)
      doc.setTextColor(100, 116, 139)
      doc.text("Company authorized signature", 40, signatureY + 16)

      const acceptanceY = pageHeight - 144
      if (!isInvoice) {
        doc.setDrawColor(150, 150, 150)
        doc.setFillColor(248, 248, 248)
        doc.rect(40, acceptanceY, pageWidth - 80, 66, "FD")
        doc.setFont("Helvetica", "bold")
        doc.setFontSize(10)
        doc.setTextColor(17, 24, 39)
        doc.text("Customer Acceptance", pageWidth / 2, acceptanceY + 18, { align: "center" })
        doc.setFontSize(9)
        doc.text("Signature:", 52, acceptanceY + 48)
        doc.text("Name:", 255, acceptanceY + 48)
        doc.text("Date:", 438, acceptanceY + 48)
      }

      if (includeHistory) drawCustomerHistory(doc, setting, logoData, q.customer, currency)

      doc.save(`${q.quotationNumber || documentType}-${documentType}.pdf`)
    } catch (err) {
      console.error(err)
      alert("Failed to generate PDF")
    }
  }

  return (
    <button onClick={handleDownload} className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium transition-colors hover:bg-slate-200">
      {documentType === "invoice" ? "Download Invoice" : "Download PDF"}
    </button>
  )
}
