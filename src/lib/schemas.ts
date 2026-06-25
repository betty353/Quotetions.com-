import { z } from "zod"

// Auth Schemas
export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
})

export const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
  firstName: z.string().min(2, "First name is required"),
  lastName: z.string().min(2, "Last name is required"),
  phone: z.string().optional(),
  companyName: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})

export const createProductSchema = z.object({
  sku: z.string().min(1, "SKU is required"),
  name: z.string().min(2, "Product name is required"),
  description: z.string().optional(),
  categoryId: z.string().min(1, "Category is required"),
  unitPrice: z.coerce.number().min(0, "Price must be positive"),
  currency: z.string().default("USD"),
  stock: z.coerce.number().default(0),
  reorderLevel: z.coerce.number().optional(),
  image: z.string().optional(),
  status: z.string().optional(),
})

export const createQuotationSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  items: z.array(z.object({
    productId: z.string().min(1, "Product is required"),
    quantity: z.coerce.number().min(1, "Quantity must be at least 1"),
    discount: z.coerce.number().default(0),
  })).min(1, "At least one item is required"),
  notes: z.string().optional(),
  terms: z.string().optional(),
  validUntil: z.coerce.date().optional(),
})

export const companySettingsSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  companyEmail: z.string().email("Valid company email is required"),
  companyPhone: z.string().min(6, "Company phone is required"),
  companyAddress: z.string().optional(),
  companyCity: z.string().optional(),
  companyRegion: z.string().optional(),
  companyCountry: z.string().optional(),
  companyPostalCode: z.string().optional(),
  companyTaxId: z.string().optional(),
  companyRegistration: z.string().optional(),
  defaultCurrency: z.string().default("USD"),
  taxRate: z.number().min(0, "Tax rate cannot be negative"),
  quotationPrefix: z.string().min(1, "Quotation prefix is required"),
  receiptPrefix: z.string().min(1, "Receipt prefix is required"),
  paymentPrefix: z.string().min(1, "Payment prefix is required"),
  quotationValidDays: z.number().int().min(1, "Quotation valid days must be at least 1"),
  companyWebsite: z.preprocess((value) => {
    if (value === "") return undefined
    return value
  }, z.string().url().optional()),
  companyLogo: z.preprocess((value) => {
    if (value === "") return undefined
    return value
  }, z.string().url().optional()),
  signatureImageUrl: z.preprocess((value) => {
    if (value === "") return undefined
    return value
  }, z.string().url().optional()),
  documentFont: z.enum(["Helvetica", "Times", "Courier"]).default("Helvetica"),
})

export const createPaymentSchema = z.object({
  quotationId: z.string().min(1, "Quotation is required"),
  amount: z.coerce.number().min(0, "Amount must be positive"),
  method: z.enum(["CASH", "BANK_TRANSFER", "MOBILE_MONEY", "CARD", "CHEQUE", "OTHER"]),
  reference: z.string().optional(),
  notes: z.string().optional(),
  paymentDate: z.coerce.date(),
})

export const createReceiptSchema = z.object({
  quotationId: z.string().min(1, "Quotation is required"),
  amount: z.coerce.number().min(0, "Amount must be positive"),
  paymentMethod: z.enum(["CASH", "BANK_TRANSFER", "MOBILE_MONEY", "CARD", "CHEQUE", "OTHER"]),
  reference: z.string().optional(),
  notes: z.string().optional(),
})

export const createFollowUpSchema = z.object({
  quotationId: z.string().min(1, "Quotation is required"),
  customerId: z.string().min(1, "Customer is required"),
  employeeId: z.string().optional(),
  type: z.enum(["CALL", "EMAIL", "MEETING", "NOTE"]),
  callNotes: z.string().optional(),
  meetingNotes: z.string().optional(),
  feedback: z.string().optional(),
  nextFollowUpDate: z.coerce.date().optional(),
  reminderDate: z.coerce.date().optional(),
})

export const updateQuotationStatusSchema = z.object({
  status: z.enum(["DRAFT", "SENT", "VIEWED", "APPROVED", "REJECTED", "EXPIRED", "COMPLETED"]),
  rejectionReason: z.string().optional(),
  notes: z.string().optional(),
  terms: z.string().optional(),
  validUntil: z.coerce.date().optional(),
})

export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type CreateProductInput = z.infer<typeof createProductSchema>
export type CreateQuotationInput = z.infer<typeof createQuotationSchema>
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>
export type CreateReceiptInput = z.infer<typeof createReceiptSchema>
export type CreateFollowUpInput = z.infer<typeof createFollowUpSchema>
