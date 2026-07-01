import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"

export async function generateUniqueReceiptNumber(prefix = "RCT") {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "")
  const dayStart = new Date()
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(dayStart)
  dayEnd.setDate(dayEnd.getDate() + 1)

  const count = await prisma.receipt.count({
    where: {
      createdAt: {
        gte: dayStart,
        lt: dayEnd,
      },
    },
  })

  return `${prefix}-${datePart}-${String(count + 1).padStart(6, "0")}`
}

export async function generateUniqueReceiptNumberInTransaction(tx: Prisma.TransactionClient, prefix = "RCT") {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "")
  const dayStart = new Date()
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(dayStart)
  dayEnd.setDate(dayEnd.getDate() + 1)

  const count = await tx.receipt.count({
    where: {
      createdAt: {
        gte: dayStart,
        lt: dayEnd,
      },
    },
  })

  return `${prefix}-${datePart}-${String(count + 1).padStart(6, "0")}`
}
