'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { auth, db } from '@/firebase/config'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, updateDoc, getDoc, Timestamp, collection, addDoc } from 'firebase/firestore'
import toast from 'react-hot-toast'

export default function PreloadCallbackPage() {
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
          router.push('/app/recipient')
        }
        return
      }

      try {
        console.log('🔍 Verifying preload payment with reference:', reference)

        // Call our verification endpoint
        const response = await fetch(`/api/payments/verify?reference=${reference}`, {
          method: 'GET',
        })

        const result = await response.json()
        console.log('✓ Verification response:', result)

        if (result.success && result.data.status === 'success') {
          console.log('✅ Preload payment verified successfully')
          
          // Get preload data from sessionStorage
          const preloadData = sessionStorage.getItem('pendingPreload')
          if (preloadData) {
            const data = JSON.parse(preloadData)
            
            try {
              // Get user's wallet document by phone
              const userRef = doc(db, 'users', authUser.uid)
              const userSnap = await getDoc(userRef)
              
              if (userSnap.exists()) {
                const userData = userSnap.data()
                const userPhone = userData.phone || userData.phoneE164 || authUser.phoneNumber
                
                if (userPhone) {
                  // Update wallet - add funds to senderBalance (for recipients to send gifts)
                  const walletRef = doc(db, 'wallets', userPhone)
                  
                  // Amount in kobo (cents) from Paystack
                  const amountInKobo = result.data?.amount || null
                  const amountToAdd = amountInKobo !== null ? amountInKobo / 100 : (data.baseAmount || 0)
                  
                  console.log(`💰 Adding ${amountToAdd} USD to wallet for ${userPhone}`)
                  
                  // Get existing wallet
                  const walletSnap = await getDoc(walletRef)
                  const existingBalance = walletSnap.exists() ? (walletSnap.data().senderBalance || 0) : 0
                  
                  // Update wallet with new balance
                  await updateDoc(walletRef, {
                    senderBalance: existingBalance + Math.round(amountToAdd * 100), // Store in cents
                    lastPreloadDate: Timestamp.now(),
                    updatedAt: Timestamp.now(),
                  })
                  
                  console.log('✓ Wallet updated successfully')
                  
                  // Create preload transaction record for history
                  const transactionRef = await addDoc(collection(db, 'preloadTransactions'), {
                    userId: authUser.uid,
                    userPhone: userPhone,
                    amount: Math.round(amountToAdd * 100), // Store in cents
                    originalAmount: amountToAdd,
                    currency: 'USD',
                    reference,
                    status: 'completed',
                    createdAt: Timestamp.now(),
                  })
                  
                  console.log('✓ Preload transaction record created:', transactionRef.id)
                  
                  // Create notification for successful preload
                  try {
                    await addDoc(collection(db, 'notifications'), {
                      userId: authUser.uid,
                      title: '💰 Wallet Loaded Successfully!',
                      body: `Your wallet has been preloaded with $${amountToAdd.toFixed(2)}. You can now send gifts and tips.`,
                      type: 'preload',
                      relatedId: transactionRef.id,
                      read: false,
                      createdAt: Timestamp.now(),
                    })
                    console.log('✓ Notification created for preload')
                  } catch (notifError) {
                    console.error('Warning: Failed to create notification:', notifError)
                    // Don't fail the preload if notification fails
                  }
                  
                  // Clear sessionStorage
                  sessionStorage.removeItem('pendingPreload')
                  
                  setSuccess(true)
                  
                  // Show success and redirect
                  toast.success(`✅ Wallet loaded with $${amountToAdd.toFixed(2)}! You can now send gifts.`)
                  setTimeout(() => {
                    router.push('/app/recipient')
                  }, 2000)
                } else {
                  throw new Error('User phone number not found')
                }
              } else {
                throw new Error('User record not found')
              }
            } catch (error) {
              console.error('Error updating wallet:', error)
              toast.error('Payment verified but failed to update wallet. Please contact support.')
              setSuccess(false)
              setTimeout(() => {
                router.push('/app/recipient')
              }, 2000)
            }
          } else {
            console.error('No preload data found in sessionStorage')
            toast.error('Preload data not found. Please try again.')
            setSuccess(false)
            setTimeout(() => {
              router.push('/app/recipient')
            }, 2000)
          }
        } else {
          console.error('❌ Payment verification failed:', result)
          toast.error('Payment verification failed. Please try again.')
          setSuccess(false)
          setTimeout(() => {
            router.push('/app/recipient')
          }, 2000)
        }
      } catch (error) {
        console.error('Error verifying preload payment:', error)
        toast.error('Error verifying payment')
        setSuccess(false)
        setTimeout(() => {
          router.push('/app/recipient')
        }, 2000)
      } finally {
        setVerifying(false)
      }
    })

    return () => unsubscribe()
  }, [router, reference])

  if (verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent"></div>
          <p className="mt-4 text-muted-foreground dark:text-slate-300">Verifying preload payment...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950">
      <div className="text-center">
        {success ? (
          <>
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-foreground dark:text-slate-100 mb-2">Wallet Loaded!</h1>
            <p className="text-muted-foreground dark:text-slate-300 mb-6">Your funds have been added. You can now send gifts.</p>
            <button 
              onClick={() => router.push('/app/recipient')}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition"
            >
              Back to Dashboard
            </button>
          </>
        ) : (
          <>
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-foreground dark:text-slate-100 mb-2">Payment Failed</h1>
            <p className="text-muted-foreground dark:text-slate-300 mb-6">Your payment could not be verified. Please try again.</p>
            <button 
              onClick={() => router.push('/app/recipient')}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition"
            >
              Back to Dashboard
            </button>
          </>
        )}
      </div>
    </div>
  )
}
