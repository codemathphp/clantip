import crypto from 'crypto-js'
import axios from 'axios'

const PAYSTACK_BASE_URL = 'https://api.paystack.co'
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY

// Verify webhook signature
export const verifyPaystackSignature = (
  body: any,
  signature: string
): boolean => {
  if (!PAYSTACK_SECRET) return false
  
  const hash = crypto
    .HmacSHA512(JSON.stringify(body), PAYSTACK_SECRET)
    .toString()
  
  return hash === signature
}

// Initialize payment
export const initializePayment = async (
  email: string,
  amount: number,
  reference: string,
  metadata?: Record<string, any>,
  callbackUrl?: string,
  description?: string
) => {
  try {
    // Use provided callback URL or fallback to environment variable
    const finalCallbackUrl = callbackUrl || process.env.PAYSTACK_CALLBACK_URL || 'http://localhost:3000/payment/callback'
    
    const payload = {
      email,
      amount: Math.round(amount), // Ensure integer
      reference,
      callback_url: finalCallbackUrl,
      description: description || 'ClanTip Gift Card',
      metadata,
    }
    
    console.log('🔗 Calling Paystack with payload:', payload)
    
    const response = await axios.post(
      `${PAYSTACK_BASE_URL}/transaction/initialize`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    )
    console.log('✓ Paystack response:', response.data)
    return response.data
  } catch (error: any) {
    console.error('Paystack initialization error:', error.response?.data || error.message)
    throw error
  }
}

// Verify transaction
export const verifyTransaction = async (reference: string) => {
  try {
    const response = await axios.get(
      `${PAYSTACK_BASE_URL}/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    )
    return response.data
  } catch (error) {
    console.error('Paystack verification error:', error)
    throw error
  }
}

// Create transfer recipient
export const createTransferRecipient = async (
  type: 'nuban' | 'mobile_money',
  name: string,
  accountNumber: string,
  bankCode: string,
  currency: string = 'ZAR'
) => {
  try {
    const response = await axios.post(
      `${PAYSTACK_BASE_URL}/transferrecipient`,
      {
        type: type === 'nuban' ? 'bank_account' : 'mobile_money',
        name,
        account_number: accountNumber,
        bank_code: bankCode,
        currency,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    )
    return response.data
  } catch (error) {
    console.error('Paystack recipient creation error:', error)
    throw error
  }
}

// Initiate transfer
export const initiateTransfer = async (
  recipientCode: string,
  amount: number,
  reason: string,
  reference: string,
  source: string = 'balance'
) => {
  try {
    const response = await axios.post(
      `${PAYSTACK_BASE_URL}/transfer`,
      {
        recipient: recipientCode,
        amount, // in kobo (cents)
        reason,
        reference,
        source,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    )
    return response.data
  } catch (error) {
    console.error('Paystack transfer error:', error)
    throw error
  }
}

// Get transfer details
export const getTransferDetails = async (transferCode: string) => {
  try {
    const response = await axios.get(
      `${PAYSTACK_BASE_URL}/transfer/${transferCode}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    )
    return response.data
  } catch (error) {
    console.error('Paystack transfer details error:', error)
    throw error
  }
}

// Get balance
export const getPaystackBalance = async () => {
  try {
    const response = await axios.get(
      `${PAYSTACK_BASE_URL}/balance`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    )
    return response.data
  } catch (error) {
    console.error('Paystack balance error:', error)
    throw error
  }
}
