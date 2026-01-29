// User and Auth types
export type UserRole = 'sender' | 'recipient' | 'admin'
export type UserStatus = 'active' | 'suspended' | 'deleted'

export interface User {
  id: string
  phone: string
  fullName: string
  email?: string
  role: UserRole
  status: UserStatus
  createdAt: Date
  updatedAt: Date
  limits?: {
    monthlyLimit?: number
    dailyLimit?: number
  }
}

// Wallet types
export interface Wallet {
  userId: string
  availableCredits: number // in ZAR cents
  pendingCredits: number // in ZAR cents
  updatedAt: Date
}

// Payment types
export type PaymentStatus = 'pending' | 'successful' | 'failed' | 'cancelled'

export interface Payment {
  id: string
  reference: string // Paystack reference
  payerId: string
  amount: number // in ZAR cents
  currency: string
  status: PaymentStatus
  paystackData?: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

// Voucher types
export type VoucherStatus = 'delivered' | 'redeemed' | 'paid' | 'failed' | 'reversed'

export interface Voucher {
  id: string
  code: string // 6-digit code
  paymentRef: string
  senderId: string
  recipientId: string
  amount: number // in ZAR cents
  originalAmount?: number // original amount in sender's currency (smallest unit)
  originalCurrency?: string // sender's original currency (e.g., 'USD')
  message?: string
  status: VoucherStatus
  createdAt: Date
  updatedAt: Date
}

// Redemption types
export type RedemptionStatus = 'redemption_requested' | 'processing' | 'approved' | 'paid' | 'failed' | 'reversed'
export type RedemptionMethod = 'bank_account' | 'mobile_wallet'

export interface BankDetails {
  bankName: string
  bankCode: string
  accountNumber: string
  accountName: string
}

export interface Redemption {
  id: string
  userId: string
  amount: number // in ZAR cents
  method: RedemptionMethod
  details: BankDetails | Record<string, any>
  status: RedemptionStatus
  recipientCode?: string // Paystack recipient code
  transferCode?: string // Paystack transfer code
  createdAt: Date
  updatedAt: Date
  failureReason?: string
}

// Notification types
export interface Notification {
  id: string
  userId: string
  title: string
  body: string
  read: boolean
  type?: 'payment' | 'voucher' | 'redemption' | 'admin'
  relatedId?: string // reference to payment, voucher, or redemption
  createdAt: Date
}

// Audit Log types
export type AuditAction = 'create' | 'update' | 'delete' | 'approve' | 'reject' | 'process'
export type AuditTargetType = 'user' | 'payment' | 'voucher' | 'redemption' | 'wallet'

export interface AuditLog {
  id: string
  actorId: string
  action: AuditAction
  targetType: AuditTargetType
  targetId: string
  payload?: Record<string, any>
  createdAt: Date
}

// Payout configuration
export type PayoutMode = 'DEFERRED_PAYOUT' | 'SAME_DAY_PAYOUT' | 'FAST_PAYOUT'

// API Response types
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}
