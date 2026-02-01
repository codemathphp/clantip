'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { auth, db } from '@/firebase/config'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, updateDoc, getDoc } from 'firebase/firestore'
import { Button } from '@/components/ui/button'
import toast from 'react-hot-toast'
import { CheckCircle, XCircle, Loader } from 'lucide-react'

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-accent/5 px-4">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full border border-slate-200/50 text-center">
        <div className="flex justify-center mb-4">
          <Loader size={48} className="animate-spin text-primary" />
        </div>
        <h2 className="text-xl font-bold mb-2">Loading...</h2>
        <p className="text-muted-foreground text-sm">Please wait...</p>
      </div>
    </div>
  )
}

function TopUpCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'failed'>('loading')
  const [message, setMessage] = useState('')
  const [flowType, setFlowType] = useState<'preload' | 'gift' | 'unknown'>('unknown')

  useEffect(() => {
    let unsubscribeAuth: (() => void) | null = null

    const verifyPayment = async () => {
      try {
        const reference = searchParams.get('reference')
        if (!reference) {
          setStatus('failed')
          setMessage('No payment reference found')
          return
        }

        unsubscribeAuth = onAuthStateChanged(auth, async (authUser: any) => {
          if (!authUser) {
            router.push('/auth')
            return
          }

          try {
            // Check for preload flow
            const pendingPreload = sessionStorage.getItem('pendingPreload')
            const pendingGift = sessionStorage.getItem('pendingGift')
            
            if (pendingPreload) {
              setFlowType('preload')
              await handlePreloadSuccess(authUser, reference, pendingPreload)
            } else if (pendingGift) {
              setFlowType('gift')
              await handleGiftSuccess(authUser, reference, pendingGift)
            } else {
              setStatus('failed')
              setMessage('No pending transaction found. Please try again.')
            }
          } catch (err: any) {
            console.error('Verification error:', err)
            setStatus('failed')
            setMessage(err.message || 'Failed to process payment')
          }
        })
      } catch (error: any) {
        console.error('Callback error:', error)
        setStatus('failed')
        setMessage(error.message || 'An error occurred')
      }
    }

    verifyPayment()

    return () => {
      if (unsubscribeAuth) {
        unsubscribeAuth()
      }
    }
  }, [searchParams, router])

  const handlePreloadSuccess = async (authUser: any, reference: string, preloadDataJson: string) => {
    try {
      const preloadData = JSON.parse(preloadDataJson)
      const baseAmount = preloadData.baseAmount
      const totalAmount = preloadData.totalAmount
      const amountCents = Math.round(baseAmount * 100)

      // Add preloaded balance to user's senderBalance
      const userRef = doc(db, 'users', authUser.uid)
      const userSnap = await getDoc(userRef)
      
      if (userSnap.exists()) {
        const currentBalance = (userSnap.data()?.senderBalance || 0)
        const newBalance = currentBalance + amountCents

        await updateDoc(userRef, {
          senderBalance: newBalance,
          lastPreloadDate: new Date(),
          updatedAt: new Date(),
        })

        // Clear pending preload from sessionStorage
        sessionStorage.removeItem('pendingPreload')

        setStatus('success')
        setMessage(`✅ Funds Loaded Successfully!\n\nYou loaded $${baseAmount.toFixed(2)} USD to your wallet.\n\n💝 You can now send love and show appreciation!`)

        // Redirect after 3 seconds
        setTimeout(() => {
          router.push('/app/recipient?activeTab=gift')
        }, 3000)
      } else {
        throw new Error('User document not found')
      }
    } catch (error: any) {
      console.error('Preload processing error:', error)
      setStatus('failed')
      setMessage(error.message || 'Failed to process preload')
    }
  }

  const handleGiftSuccess = async (authUser: any, reference: string, giftDataJson: string) => {
    try {
      const giftData = JSON.parse(giftDataJson)
      
      // For gift flow, trigger the backend to create voucher
      const createVoucherRes = await fetch('/api/vouchers/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: authUser.uid,
          recipientPhone: giftData.recipientPhone,
          amount: Math.round(giftData.amount * 100),
          message: giftData.message,
          reference,
          paymentMethod: 'checkout',
        }),
      })

      const voucherResult = await createVoucherRes.json()
      if (!createVoucherRes.ok) {
        throw new Error(voucherResult.error || 'Failed to create voucher')
      }

      // Clear pending gift from sessionStorage
      sessionStorage.removeItem('pendingGift')

      setStatus('success')
      setMessage(`✅ Gift Sent Successfully!\n\nYou sent $${giftData.amount.toFixed(2)} to ${giftData.recipientPhone}\n\n💝 Your love has been delivered!`)

      // Redirect after 3 seconds
      setTimeout(() => {
        router.push('/app/recipient?activeTab=gift')
      }, 3000)
    } catch (error: any) {
      console.error('Gift processing error:', error)
      setStatus('failed')
      setMessage(error.message || 'Failed to process gift')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-accent/5 px-4">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full border border-slate-200/50 text-center">
        {status === 'loading' && (
          <>
            <div className="flex justify-center mb-4">
              <Loader size={48} className="animate-spin text-primary" />
            </div>
            <h2 className="text-xl font-bold mb-2">Processing Payment</h2>
            <p className="text-muted-foreground text-sm">Please wait while we verify and complete your transaction...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="flex justify-center mb-4">
              <CheckCircle size={48} className="text-green-500" />
            </div>
            <h2 className="text-xl font-bold text-green-700 mb-2">Success!</h2>
            <p className="text-muted-foreground text-sm mb-4 whitespace-pre-line">{message}</p>
            <p className="text-xs text-muted-foreground">Redirecting...</p>
          </>
        )}

        {status === 'failed' && (
          <>
            <div className="flex justify-center mb-4">
              <XCircle size={48} className="text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-red-700 mb-2">Payment Failed</h2>
            <p className="text-muted-foreground text-sm mb-4">{message}</p>
            <Button onClick={() => router.push('/app/recipient?activeTab=gift')} className="w-full h-10 rounded-xl">
              Back to Wallet
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

export default function TopUpCallbackPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <TopUpCallbackContent />
    </Suspense>
  )
}
