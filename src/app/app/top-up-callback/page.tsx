'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { auth, db } from '@/firebase/config'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc, updateDoc, setDoc, collection } from 'firebase/firestore'
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
            // Get pending top-up info
            const pendingTopUp = sessionStorage.getItem('pendingTopUp')
            if (!pendingTopUp) {
              setStatus('failed')
              setMessage('No pending top-up found. Please try again.')
              return
            }

            const topUpData = JSON.parse(pendingTopUp)
            const amountCents = topUpData.amountCents

            // Verify payment with Paystack
            const verifyRes = await fetch(
              `https://api.paystack.co/transaction/verify/${reference}`,
              {
                method: 'GET',
                headers: {
                  Authorization: `Bearer ${process.env.NEXT_PUBLIC_PAYSTACK_SECRET_KEY}`,
                },
              }
            )

            const verifyData = await verifyRes.json()

            if (!verifyData.status || verifyData.data.status !== 'success') {
              setStatus('failed')
              setMessage('Payment verification failed. Please contact support.')
              return
            }

            // Get user from canonical users/{uid} and get their phone
            const userRef = doc(db, 'users', authUser.uid)
            const userSnap = await getDoc(userRef)

            if (!userSnap.exists()) {
              setStatus('failed')
              setMessage('User profile not found')
              return
            }

            const userData = userSnap.data() as any
            const userPhone = userData.phone || userData.phoneE164
            const currentBalance = (userData.senderBalance || 0) as number
            const newBalance = currentBalance + amountCents

            // Update canonical user doc (users/{uid})
            await updateDoc(userRef, {
              senderBalance: newBalance,
              updatedAt: new Date(),
            })

            // Also update legacy users/{phone} doc for backward compatibility if phone exists
            if (userPhone) {
              try {
                const legacyUserRef = doc(db, 'users', userPhone)
                await updateDoc(legacyUserRef, {
                  senderBalance: newBalance,
                  updatedAt: new Date(),
                })
              } catch (e) {
                console.warn('Failed to update legacy user doc', e)
              }
            }

            // Create a notification for the top-up
            try {
              const notificationRef = doc(collection(db, 'notifications'))
              await setDoc(notificationRef, {
                userId: authUser.uid,
                title: '💰 Wallet Topped Up',
                body: `You added $${(amountCents / 100).toFixed(2)} to your wallet. Ready to send some Love across the world! 🌍`,
                read: false,
                type: 'payment',
                relatedId: topUpData.reference,
                createdAt: new Date(),
              })
            } catch (e) {
              console.warn('Failed to create notification', e)
            }

            // Clear pending top-up from sessionStorage
            sessionStorage.removeItem('pendingTopUp')

            setStatus('success')
            setMessage(`✅ Wallet topped up! You now have $${(newBalance / 100).toFixed(2)}\n💝 Ready to send some Love across the world!`)

            // Redirect after 3 seconds
            setTimeout(() => {
              router.push('/app/sender?tab=home')
            }, 3000)
          } catch (err: any) {
            console.error('Verification error:', err)
            setStatus('failed')
            setMessage(err.message || 'Failed to process top-up')
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-accent/5 px-4">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full border border-slate-200/50 text-center">
        {status === 'loading' && (
          <>
            <div className="flex justify-center mb-4">
              <Loader size={48} className="animate-spin text-primary" />
            </div>
            <h2 className="text-xl font-bold mb-2">Processing Payment</h2>
            <p className="text-muted-foreground text-sm">Please wait while we verify your payment...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="flex justify-center mb-4">
              <CheckCircle size={48} className="text-green-500" />
            </div>
            <h2 className="text-xl font-bold text-green-700 mb-2">Success!</h2>
            <p className="text-muted-foreground text-sm mb-4">{message}</p>
            <p className="text-xs text-muted-foreground">Redirecting to your wallet...</p>
          </>
        )}

        {status === 'failed' && (
          <>
            <div className="flex justify-center mb-4">
              <XCircle size={48} className="text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-red-700 mb-2">Payment Failed</h2>
            <p className="text-muted-foreground text-sm mb-4">{message}</p>
            <Button onClick={() => router.push('/app/sender')} className="w-full h-10 rounded-xl">
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
