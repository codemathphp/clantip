export const PAYOUT_SLA = {
  DEFERRED_PAYOUT: 'Most redemptions are processed within 24–48 hours.',
  SAME_DAY_PAYOUT: 'Processed same business day.',
  FAST_PAYOUT: 'Usually processed within 1 hour (eligible requests).',
}

export const PAYOUT_MODE = (process.env.NEXT_PUBLIC_PAYOUT_MODE || 'DEFERRED_PAYOUT') as 'DEFERRED_PAYOUT' | 'SAME_DAY_PAYOUT' | 'FAST_PAYOUT'

export const PAYOUT_MIN_THRESHOLD = parseInt(process.env.PAYOUT_MIN_THRESHOLD || '10000')

export const CURRENCY = 'ZAR'
export const CURRENCY_SYMBOL = 'R'

// Supported countries and currencies (Paystack supported countries only)
export const SUPPORTED_COUNTRIES = [
  { code: 'ZA', name: 'South Africa', currency: 'ZAR', symbol: 'R' },
  { code: 'NG', name: 'Nigeria', currency: 'NGN', symbol: '₦' },
  { code: 'KE', name: 'Kenya', currency: 'KES', symbol: 'KSh' },
  { code: 'GH', name: 'Ghana', currency: 'GHS', symbol: '₵' },
]

// South African banks
export const SA_BANKS = [
  { code: '030', name: 'First National Bank' },
  { code: '031', name: 'Investec' },
  { code: '032', name: 'African Bank' },
  { code: '033', name: 'ABSA' },
  { code: '034', name: 'Ubank' },
  { code: '035', name: 'Capitec Bank' },
  { code: '036', name: 'Nedbank' },
  { code: '037', name: 'Standard Bank' },
]

// Status display mappings
export const STATUS_DISPLAY: Record<string, { label: string; color: string }> = {
  delivered: { label: 'Delivered', color: 'bg-blue-100 text-blue-800' },
  redemption_requested: { label: 'Redemption Requested', color: 'bg-yellow-100 text-yellow-800' },
  processing: { label: 'Processing', color: 'bg-purple-100 text-purple-800' },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-800' },
  paid: { label: 'Paid', color: 'bg-green-100 text-green-800' },
  failed: { label: 'Failed', color: 'bg-red-100 text-red-800' },
  reversed: { label: 'Reversed', color: 'bg-red-100 text-red-800' },
  redeemed: { label: 'Redeemed', color: 'bg-green-100 text-green-800' },
}

// Number formatting
export const formatCurrency = (cents: number): string => {
  return `${CURRENCY_SYMBOL}${(cents / 100).toFixed(2)}`
}

export const parseCurrency = (amount: number): number => {
  return Math.round(amount * 100)
}

// Phone formatting for South Africa
// Firebase requires E.164 format: +27XXXXXXXXX
export const formatPhone = (phone: string): string => {
  if (!phone) return ''
  // Remove all non-digits
  const cleaned = phone.replace(/\D/g, '')
  
  // If it's 10 digits starting with 0 (local format: 0123456789)
  if (cleaned.length === 10 && cleaned.startsWith('0')) {
    return `+27${cleaned.substring(1)}`
  }
  
  // If it's 11 digits starting with 27 (0027123456789)
  if (cleaned.length === 11 && cleaned.startsWith('27')) {
    return `+${cleaned}`
  }
  
  // If it's 12 digits starting with 0027
  if (cleaned.length === 12 && cleaned.startsWith('0027')) {
    return `+${cleaned.substring(2)}`
  }
  
  // If already in E.164 format (+27123456789)
  if (phone.startsWith('+27') && cleaned.length === 11) {
    return phone
  }
  
  // If it looks like a South African number, format it
  if (cleaned.length === 9) {
    return `+27${cleaned}`
  }
  
  return phone
}

export const unformatPhone = (phone: string): string => {
  return phone.replace(/\D/g, '')
}

// Firebase OTP requires E.164 format with country code
export const formatPhoneForFirebase = (phone: string): string => {
  const formatted = formatPhone(phone)
  if (!formatted.startsWith('+')) {
    return `+27${formatted.replace(/\D/g, '')}`
  }
  return formatted
}
