import { z } from "zod"

// Auth Schemas
export const loginSchema = z.object({
  email: z.string().email("Invalid email address").transform((email) => email.trim().toLowerCase()),
  password: z.string().min(6, "Password must be at least 6 characters"),
})

const baseRegistrationSchema = z.object({
  firstName: z.string().trim().min(2, "First name is required"),
  lastName: z.string().trim().min(2, "Last name is required"),
  email: z.string().email("Invalid email address").transform((email) => email.trim().toLowerCase()),
  phone: z.string().trim().min(6, "Phone is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
})

const confirmPasswordsMatch = {
  message: "Passwords don't match",
  path: ["confirmPassword"],
}

export const businessRegistrationSchema = baseRegistrationSchema.extend({
  accountType: z.literal("BUSINESS").default("BUSINESS"),
  companyName: z.string().trim().min(2, "Company name is required"),
}).refine((data) => data.password === data.confirmPassword, confirmPasswordsMatch)

export const customerRegistrationSchema = baseRegistrationSchema.extend({
  accountType: z.literal("CUSTOMER").default("CUSTOMER"),
  companySlug: z.string().trim().optional(),
  companyId: z.string().trim().optional(),
}).refine((data) => data.password === data.confirmPassword, confirmPasswordsMatch)

export const registerSchema = z.union([
  businessRegistrationSchema,
  customerRegistrationSchema,
])

export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address").transform((email) => email.trim().toLowerCase()),
})

export const resetPasswordSchema = z.object({
  token: z.string().min(24, "Reset token is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
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

export const onboardingSchema = z.object({
  companyName: z.string().trim().min(1, "Company name is required"),
  companyEmail: z.string().email("Valid company email is required"),
  companyPhone: z.string().trim().min(6, "Company phone is required"),
  about: z.string().trim().optional(),
  logoUrl: z.preprocess((value) => value === "" ? undefined : value, z.string().url("Logo must be a valid URL").optional()),
  address: z.string().trim().optional(),
  city: z.string().trim().optional(),
  region: z.string().trim().optional(),
  country: z.string().trim().optional(),
  postalCode: z.string().trim().optional(),
  taxId: z.string().trim().optional(),
  registrationNumber: z.string().trim().optional(),
  website: z.preprocess((value) => value === "" ? undefined : value, z.string().url("Website must be a valid URL").optional()),
  defaultCurrency: z.string().trim().min(3).max(3).default("USD"),
  taxRate: z.coerce.number().min(0, "Tax rate cannot be negative").default(0),
  quotationPrefix: z.string().trim().min(1, "Quotation prefix is required").default("QT"),
  receiptPrefix: z.string().trim().min(1, "Receipt prefix is required").default("RC"),
  paymentPrefix: z.string().trim().min(1, "Payment prefix is required").default("PM"),
  quotationValidDays: z.coerce.number().int().min(1, "Quotation valid days must be at least 1").default(30),
})

export const createPaymentSchema = z.object({
  quotationId: z.string().min(1, "Quotation is required"),
  amount: z.coerce.number().positive("Amount must be positive"),
  method: z.enum(["CASH", "BANK_TRANSFER", "MOBILE_MONEY", "CARD", "CHEQUE", "AIRTEL_MONEY", "MTN_MOBILE_MONEY", "ZAMTEL_KWACHA", "OTHER"]),
  reference: z.string().optional(),
  notes: z.string().optional(),
  paymentDate: z.coerce.date(),
})

export const createReceiptSchema = z.object({
  quotationId: z.string().min(1, "Quotation is required"),
  amount: z.coerce.number().positive("Amount must be positive"),
  paymentMethod: z.enum(["CASH", "BANK_TRANSFER", "MOBILE_MONEY", "CARD", "CHEQUE", "AIRTEL_MONEY", "MTN_MOBILE_MONEY", "ZAMTEL_KWACHA", "OTHER"]),
  reference: z.string().optional(),
  notes: z.string().optional(),
})

export const paymentSetupSchema = z.object({
  settlementMethod: z.enum(["BANK_ACCOUNT", "AIRTEL_MONEY", "MTN_MOBILE_MONEY", "ZAMTEL_KWACHA"]),
  bankName: z.string().optional(),
  accountName: z.string().optional(),
  accountNumber: z.string().optional(),
  branch: z.string().optional(),
  swiftCode: z.string().optional(),
  mobileMoneyNetwork: z.string().optional(),
  mobileMoneyBusinessName: z.string().optional(),
  mobileMoneyNumber: z.string().optional(),
  dpoCompanyToken: z.string().optional(),
  dpoServiceType: z.string().optional(),
  dpoMerchantId: z.string().optional(),
  dpoCallbackUrl: z.string().url("Valid callback URL is required").optional(),
  dpoReturnUrl: z.string().url("Valid return URL is required").optional(),
  dpoEnvironment: z.enum(["SANDBOX", "PRODUCTION"]).default("SANDBOX"),
  paymentEnabled: z.boolean().default(true),
}).superRefine((data, ctx) => {
  if (data.settlementMethod === "BANK_ACCOUNT") {
    for (const field of ["bankName", "accountName", "accountNumber", "branch"] as const) {
      if (!data[field]) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field], message: "Required for bank settlement" })
      }
    }
    return
  }

  for (const field of ["mobileMoneyBusinessName", "mobileMoneyNumber"] as const) {
    if (!data[field]) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field], message: "Required for mobile money settlement" })
    }
  }
})

export const createDpoPaymentSchema = z.object({
  quotationId: z.string().min(1, "Quotation is required"),
})

export const verifyDpoPaymentSchema = z.object({
  quotationId: z.string().optional(),
  transactionToken: z.string().optional(),
}).refine((data) => data.quotationId || data.transactionToken, {
  message: "quotationId or transactionToken is required",
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
export type BusinessRegistrationInput = z.infer<typeof businessRegistrationSchema>
export type CustomerRegistrationInput = z.infer<typeof customerRegistrationSchema>
export type CreateProductInput = z.infer<typeof createProductSchema>
export type CreateQuotationInput = z.infer<typeof createQuotationSchema>
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>
export type CreateReceiptInput = z.infer<typeof createReceiptSchema>
export type CreateFollowUpInput = z.infer<typeof createFollowUpSchema>
export type PaymentSetupInput = z.infer<typeof paymentSetupSchema>
export type OnboardingInput = z.infer<typeof onboardingSchema>
