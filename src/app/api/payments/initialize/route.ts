import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/firebase/config'
import { collection, doc, setDoc, getDoc, Timestamp } from 'firebase/firestore'
import { initializePayment } from '@/lib/paystack'

// Get the callback URL based on the request
function getCallbackUrl(request: NextRequest): string {
  const origin = request.headers.get('origin') || 
                 request.headers.get('x-forwarded-proto') + '://' + request.headers.get('x-forwarded-host') ||
                 request.headers.get('host') ||
                 'http://localhost:3000'
  
  // Ensure proper format
  const baseUrl = origin.startsWith('http') ? origin : `https://${origin}`
  return `${baseUrl}/payment/callback`
}

// Get exchange rates from Firestore or return defaults
async function getExchangeRates() {
  try {
    const settingsDoc = await getDoc(doc(db, 'settings', 'exchangeRates'))
    
    if (settingsDoc.exists()) {
      return settingsDoc.data().rates
    }
    
    // Default rates
    return {
      USD_TO_ZAR: 18.50,
      GBP_TO_ZAR: 23.50,
      EUR_TO_ZAR: 20.00,
    }
  } catch (error) {
    console.error('Error fetching exchange rates:', error)
    // Return default rates on error
    return {
      USD_TO_ZAR: 18.50,
      GBP_TO_ZAR: 23.50,
      EUR_TO_ZAR: 20.00,
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const { email, amount, senderId, recipientId, recipientPhone, recipientHandle, message, currency = 'USD' } = await request.json()

    if (!email || !amount || !senderId || !recipientId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Get exchange rates
    const exchangeRates = await getExchangeRates()
    
    // Convert amount to ZAR if needed
    let amountInZAR = amount
    let conversionRate = 1
    
    if (currency !== 'ZAR') {
      const rateKey = `${currency}_TO_ZAR`
      if (exchangeRates[rateKey]) {
        conversionRate = exchangeRates[rateKey]
        amountInZAR = amount * conversionRate
        console.log(`💱 Converting ${amount} ${currency} to ZAR using rate ${conversionRate}: ${amountInZAR}`)
      } else {
        console.warn(`⚠️ No exchange rate found for ${currency}, using amount as-is`)
      }
    }

    // Convert to kobo (cents) - Paystack expects amount in kobo
    const amountInKobo = Math.round(amountInZAR * 100)

    // Generate reference
    const reference = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    console.log(`📱 Initializing payment:`)
    console.log(`  Amount: ${amount} ${currency}`)
    console.log(`  Converted: ${amountInZAR} ZAR`)
    console.log(`  In kobo: ${amountInKobo}`)
    console.log(`  Rate used: ${conversionRate}`)

    // Initialize Paystack payment with dynamic callback URL
    const callbackUrl = getCallbackUrl(request)
    const description = `Support voucher worth R${(amountInZAR / 100).toFixed(2)} for ${recipientPhone}`
    
    const paystackResponse = await initializePayment(
      email,
      amountInKobo,
      reference,
      {
        senderId,
        recipientId,
        recipientPhone,
        recipientHandle,
        message,
        originalAmount: amount,
        originalCurrency: currency,
        convertedAmount: amountInZAR,
        conversionRate: conversionRate,
      },
      callbackUrl,  // Pass the dynamic callback URL
      description   // Pass the description for Paystack form
    )

    if (!paystackResponse.status) {
      return NextResponse.json(
        { success: false, error: 'Failed to initialize payment' },
        { status: 400 }
      )
    }

    // Store payment record
    const paymentRef = doc(db, 'payments', reference)
    await setDoc(paymentRef, {
      reference,
      payerId: senderId,
      amount: amountInKobo,
      originalAmount: amount,
      originalCurrency: currency,
      convertedAmount: amountInZAR,
      conversionRate: conversionRate,
      currency: 'ZAR',
      status: 'pending',
      paystackData: paystackResponse.data,
      createdAt: Timestamp.now(),
    })

    return NextResponse.json({
      success: true,
      data: {
        ...paystackResponse.data,
        originalAmount: amount,
        originalCurrency: currency,
        convertedAmount: amountInZAR,
        conversionRate: conversionRate,
      },
    })
  } catch (error) {
    console.error('Payment initialization error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
