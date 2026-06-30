import { generateQuotationNumber } from "@/lib/utils"

type QuotationNumberClient = {
  quotation: {
    findMany: (args: {
      where: { companyId: string; quotationNumber: { startsWith: string } }
      select: { quotationNumber: true }
    }) => Promise<Array<{ quotationNumber: string }>>
  }
}

export function quotationValidUntil(days = 7) {
  const validDays = Number.isFinite(days) && days > 0 ? days : 7
  const date = new Date()
  date.setDate(date.getDate() + validDays)
  return date
}

export async function generateNextQuotationNumber(
  client: QuotationNumberClient,
  companyId: string,
  prefix = "QT",
  offset = 1
) {
  const safePrefix = prefix.trim() || "QT"
  const year = new Date().getFullYear()
  const base = `${safePrefix}-${year}-`
  const existing = await client.quotation.findMany({
    where: { companyId, quotationNumber: { startsWith: base } },
    select: { quotationNumber: true },
  })
  const maxNumber = existing.reduce((max, item) => {
    const raw = item.quotationNumber.replace(base, "")
    const value = Number.parseInt(raw, 10)
    return Number.isFinite(value) ? Math.max(max, value) : max
  }, 0)

  return generateQuotationNumber(safePrefix, maxNumber + offset)
}
