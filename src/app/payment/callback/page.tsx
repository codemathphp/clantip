'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { auth, db } from '@/firebase/config'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, setDoc, Timestamp, collection, addDoc } from 'firebase/firestore'
import toast from 'react-hot-toast'

export default function PaymentCallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [verifying, setVerifying] = useState(true)
  const [success, setSuccess] = useState(false)
  const reference = searchParams.get('reference')

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser: any) => {
      if (!authUser || !reference) {
        setVerifying(false)
        if (!reference) {
          toast.error('No payment reference found')
          router.push('/app/sender')
        }
        return
      }

      try {
        console.log('🔍 Verifying payment with reference:', reference)

        // Call our verification endpoint
        const response = await fetch(`/api/payments/verify?reference=${reference}`, {
          method: 'GET',
        })

        const result = await response.json()
        console.log('✓ Verification response:', result)
        console.log('📊 Full result data:', JSON.stringify(result, null, 2))

        if (result.success && result.data.status === 'success') {
          console.log('✅ Payment verified successfully')
          setSuccess(true)
          
          // Get checkout data from sessionStorage
          const checkoutData = sessionStorage.getItem('pendingCheckout')
          if (checkoutData) {
            const data = JSON.parse(checkoutData)
            
            // Create voucher record for recipient with 6-digit code
            const voucherId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
            const voucherCode = Math.floor(100000 + Math.random() * 900000).toString()
            const voucherRef = doc(db, 'vouchers', voucherId)
            
            // Use Paystack-verified amount (kobo) as the stored voucher amount (ZAR subunits)
            const paystackAmountKobo = result.data?.amount || null
            const amountToStore = paystackAmountKobo !== null ? paystackAmountKobo : Math.round((data.baseAmount || 0) * 100)

            // Infer recipient currency from phone number
            let recipientCurrency = 'ZAR' // default
            if (data.recipientPhone) {
              if (data.recipientPhone.startsWith('+234')) {
                recipientCurrency = 'NGN'
              } else if (data.recipientPhone.startsWith('+254')) {
                recipientCurrency = 'KES'
              } else if (data.recipientPhone.startsWith('+233')) {
                recipientCurrency = 'GHS'
              } else if (data.recipientPhone.startsWith('+27') || data.recipientPhone.startsWith('+263')) {
                recipientCurrency = 'ZAR'
              }
            }

            await setDoc(voucherRef, {
              id: voucherId,
              code: voucherCode,
              senderId: authUser.uid,
              senderPhone: authUser.phoneNumber,
              recipientPhone: data.recipientPhone,
              recipientId: data.recipientPhone, // Use phone as ID for consistency
              // `amount` stored as ZAR subunits (cents/kobo) so existing UI formatting works
              amount: amountToStore,
              // Preserve original payer currency and amount for correct display to sender
              originalAmount: data.baseAmount,
              originalCurrency: data.currency || 'USD',
              // Store recipient's currency for display
              recipientCurrency: recipientCurrency,
              status: 'delivered',
              message: data.message || '',
              paymentRef: reference,
              createdAt: Timestamp.now(),
              updatedAt: Timestamp.now(),
            })
            
            console.log('✓ Voucher created:', voucherId)
            
            // Create notification for recipient immediately
            try {
              const senderName = authUser.displayName || 'Someone'
              const amountDisplay = data.baseAmount ? `${data.currency} ${Number(data.baseAmount).toFixed(2)}` : `ZAR ${Number(amountToStore / 100).toFixed(2)}`
              
              await addDoc(collection(db, 'notifications'), {
                userId: data.recipientPhone,
                title: '🎁 You received a gift!',
                body: `${senderName} sent you ${amountDisplay}. Redeem it to add to your wallet.`,
                type: 'voucher',
                relatedId: voucherId,
                read: false,
                createdAt: Timestamp.now(),
              })
              console.log('✓ Notification created for recipient')
            } catch (notifError) {
              console.error('Warning: Failed to create notification:', notifError)
              // Don't fail the payment if notification fails
            }
            
            // Clear sessionStorage
            sessionStorage.removeItem('pendingCheckout')
            
            // Show success and redirect
            toast.success('Payment successful! Voucher sent.')
            setTimeout(() => {
              router.push('/app/sender')
            }, 2000)
          }
        } else {
          console.error('❌ Payment verification failed:', result)
          console.error('Success:', result.success, 'Status:', result.data?.status)
          toast.error('Payment verification failed')
          setSuccess(false)
          setTimeout(() => {
            router.push('/app/sender')
          }, 2000)
        }
      } catch (error) {
        console.error('Error verifying payment:', error)
        toast.error('Error verifying payment')
        setSuccess(false)
        setTimeout(() => {
          router.push('/app/sender')
        }, 2000)
      } finally {
        setVerifying(false)
      }
    })

    return () => unsubscribe()
  }, [router, reference])

  if (verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-accent/5">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent"></div>
          <p className="mt-4 text-muted-foreground">Verifying payment...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-accent/5">
      <div className="text-center">
        {success ? (
          <>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Payment Successful!</h1>
            <p className="text-muted-foreground mb-6">Your voucher has been sent to the recipient.</p>
            <button 
              onClick={() => router.push('/app/sender')}
              className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
            >
              Back to Dashboard
            </button>
          </>
        ) : (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Payment Failed</h1>
            <p className="text-muted-foreground mb-6">Your payment could not be verified. Please try again.</p>
            <button 
              onClick={() => router.push('/app/sender')}
              className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
            >
              Back to Dashboard
            </button>
          </>
        )}
      </div>
    </div>
  )
}
