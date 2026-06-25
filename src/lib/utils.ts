import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(
  amount: number | string | { toString(): string } | null | undefined,
  currency: string = "USD"
): string {
  const num = typeof amount === "number" ? amount : parseFloat(amount?.toString() ?? "0")
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}

export function formatDate(date: Date | string, format: "short" | "long" = "short"): string {
  const d = typeof date === "string" ? new Date(date) : date
  if (format === "short") {
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function generateQuotationNumber(prefix: string = "QT", number: number): string {
  return `${prefix}-${new Date().getFullYear()}-${String(number).padStart(6, "0")}`
}

export function generateReceiptNumber(prefix: string = "RC", number: number): string {
  return `${prefix}-${new Date().getFullYear()}-${String(number).padStart(6, "0")}`
}

export function generateEmployeeId(number: number): string {
  return `EMP-${String(number).padStart(5, "0")}`
}

export function calculateTotal(subtotal: number, tax: number, discount: number): number {
  return Math.max(0, subtotal + tax - discount)
}

export function truncate(str: string, length: number = 50): string {
  return str.length > length ? `${str.substring(0, length)}...` : str
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
