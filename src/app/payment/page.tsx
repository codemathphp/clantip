'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { auth, db } from '@/firebase/config'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/button'

declare global {
  interface Window {
    PaystackPop: any
  }
}

interface CheckoutData {
  baseAmount: number
  platformFee: number
  processingFee: number
  fixedFee: number
  total: number
  recipientPhone: string
  message?: string
  timestamp: number
}

interface User {
  email?: string
  fullName?: string
  phone?: string
}

export default function PaymentPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [checkoutData, setCheckoutData] = useState<CheckoutData | null>(null)
  const [userEmail, setUserEmail] = useState<string>('')
  const [exchangeRate, setExchangeRate] = useState<number>(18.50)
  const [convertedAmount, setConvertedAmount] = useState<number>(0)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser: any) => {
      if (!authUser) {
        router.push('/auth')
        return
      }

      try {
        // Get checkout data from sessionStorage
        const storedData = sessionStorage.getItem('pendingCheckout')
        if (!storedData) {
          toast.error('No payment data found')
          router.push('/app/sender')
          return
        }

        const data: CheckoutData = JSON.parse(storedData)
        setCheckoutData(data)

        // Fetch exchange rates
        try {
          const ratesResponse = await fetch('/api/admin/exchange-rates')
          const ratesData = await ratesResponse.json()
          if (ratesData.success && ratesData.data.rates) {
            const rate = ratesData.data.rates.USD_TO_ZAR || 18.50
            setExchangeRate(rate)
            setConvertedAmount(data.total * rate)
            console.log(`💱 Exchange rate fetched: 1 USD = R${rate}`)
          }
        } catch (error) {
          console.log('Using default exchange rate')
          setConvertedAmount(data.total * exchangeRate)
        }

        // Validate recipient phone
        const formattedRecipientPhone = data.recipientPhone.replace(/\D/g, '')
        const formattedUserPhone = authUser.phoneNumber?.replace(/\D/g, '') || ''

        if (formattedRecipientPhone === formattedUserPhone) {
          toast.error('You cannot send credits to yourself')
          router.push('/app/sender')
          return
        }

        // Fetch user email from Firestore
        const phone = authUser.phoneNumber || ''
        const userRef = doc(db, 'users', phone)
        const userSnap = await getDoc(userRef)
        
        if (userSnap.exists()) {
          const userData = userSnap.data() as User
          setUserEmail(userData.email || '')
          console.log('✓ User email fetched from Firestore:', userData.email)
        }

        // Load Paystack script
        const script = document.createElement('script')
        script.src = 'https://js.paystack.co/v1/inline.js'
        script.async = true
        
        script.onload = () => {
          console.log('✓ Paystack script loaded successfully')
          setLoading(false)
          // Auto-initiate payment
          initiatePayment(data, userSnap.exists() ? (userSnap.data() as User).email || '' : '', authUser.uid)
        }
        
        script.onerror = () => {
          console.error('❌ Failed to load Paystack script')
          toast.error('Failed to load payment system')
          setLoading(false)
          router.push('/app/sender')
        }
        
        document.body.appendChild(script)
      } catch (error) {
        console.error('Error loading payment:', error)
        toast.error('Failed to load payment')
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [router, exchangeRate])

  const initiatePayment = async (data: CheckoutData, email: string, userId: string) => {
    try {
      // Use stored email from user profile, or generate fallback
      const paymentEmail = email && email.includes('@') 
        ? email 
        : `user+${Date.now()}@clantip.local`
      
      const amount = Math.round(data.total * 100) // Ensure integer kobo amount
      
      console.log('📱 Initiating payment with:', { 
        email: paymentEmail, 
        amount: data.total,
        currency: 'USD',
        senderId: userId,
        recipientId: data.recipientPhone,
        recipientPhone: data.recipientPhone 
      })

      const response = await fetch('/api/payments/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: paymentEmail,
          amount: data.total, // Send in USD
          currency: 'USD', // Specify the currency
          senderId: userId,
          recipientId: data.recipientPhone,
          recipientPhone: data.recipientPhone,
          message: data.message || '',
        }),
      })

      const result = await response.json()
      console.log('✓ API Response received:', result)
      console.log('✓ Response status:', response.status)
      
      if (!response.ok) {
        console.error('❌ API returned error status:', response.status)
        toast.error('Failed to initialize payment: ' + (result.error || 'Unknown error'))
        return
      }
      
      if (!result.success || !result.data) {
        console.error('❌ Invalid response structure:', result)
        toast.error('Failed to initialize payment: ' + (result.error || 'Unknown error'))
        return
      }

      console.log('✓ Payment data received:', result.data)

      // Use the authorization URL from Paystack to open the payment page
      const authorizationUrl = result.data.authorization_url
      if (!authorizationUrl) {
        console.error('❌ No authorization URL from Paystack')
        toast.error('Payment authorization URL not available')
        return
      }

      console.log('🔐 Redirecting to Paystack checkout:', authorizationUrl)
      window.location.href = authorizationUrl
    } catch (error) {
      console.error('❌ Payment error:', error)
      toast.error('Payment failed: ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-accent/5">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent"></div>
          <p className="mt-4 text-muted-foreground">Processing payment...</p>
        </div>
      </div>
    )
  }

  if (!checkoutData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-accent/5">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">No payment data found</p>
          <Button onClick={() => router.push('/app/sender')}>Back to Dashboard</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-accent/5 p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold mb-6">Payment Processing</h1>
        <div className="space-y-3 mb-6">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Amount (USD)</span>
            <span className="font-semibold">${checkoutData.baseAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Fees (USD)</span>
            <span>${(checkoutData.platformFee + checkoutData.processingFee + checkoutData.fixedFee).toFixed(2)}</span>
          </div>
          <div className="border-t pt-3 flex justify-between font-bold mb-3">
            <span>Total USD</span>
            <span className="text-lg">${checkoutData.total.toFixed(2)}</span>
          </div>

          <div className="bg-blue-50 p-3 rounded-lg">
            <div className="text-xs text-blue-600 mb-2">Exchange Rate Applied</div>
            <div className="flex justify-between text-sm">
              <span className="text-blue-900">Rate: 1 USD =</span>
              <span className="font-semibold text-blue-900">R{exchangeRate.toFixed(2)} ZAR</span>
            </div>
          </div>

          <div className="border-t pt-3 flex justify-between font-bold">
            <span>Total ZAR</span>
            <span className="text-lg text-green-600">R{convertedAmount.toFixed(2)}</span>
          </div>
        </div>
        <p className="text-sm text-muted-foreground text-center mb-4">
          The payment will be processed in ZAR using the current exchange rate.
        </p>
        <Button variant="outline" onClick={() => router.push('/app/sender')} className="w-full">
          Cancel Payment
        </Button>
      </div>
    </div>
  )
}
