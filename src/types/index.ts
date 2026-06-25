import { UserRole, QuotationStatus, PaymentStatus, PaymentMethod, FollowUpStatus } from "@prisma/client"

export interface AuthUser {
  id: string
  email: string
  name: string
  role: UserRole
}

export interface DashboardStats {
  totalQuotations: number
  totalRevenue: number
  totalCustomers: number
  conversionRate: number
  quotationsByStatus: Record<QuotationStatus, number>
  topProducts: Array<{
    id: string
    name: string
    sales: number
    revenue: number
  }>
  recentQuotations: Array<{
    id: string
    quotationNumber: string
    customerName: string
    total: number
    status: QuotationStatus
  }>
}

export interface CreateQuotationInput {
  customerId: string
  items: Array<{
    productId: string
    quantity: number
    discount?: number
  }>
  notes?: string
  terms?: string
  validUntil?: Date | string
}

export interface UpdateQuotationInput {
  notes?: string
  terms?: string
  validUntil?: Date
  status?: QuotationStatus
}

export interface CreatePaymentInput {
  quotationId: string
  customerId?: string
  amount: number
  method: PaymentMethod
  reference?: string
  notes?: string
  paymentDate: Date | string
}

export interface CreateReceiptInput {
  quotationId: string
  customerId?: string
  amount: number
  paymentMethod: PaymentMethod
  reference?: string
  notes?: string
}

export interface CreateFollowUpInput {
  quotationId: string
  customerId: string
  employeeId?: string
  type: "CALL" | "EMAIL" | "MEETING" | "NOTE"
  callNotes?: string
  meetingNotes?: string
  feedback?: string
  nextFollowUpDate?: Date | string
  reminderDate?: Date | string
}

export interface ApiResponse<T = any> {
  success: boolean
  message?: string
  data?: T
  error?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}
