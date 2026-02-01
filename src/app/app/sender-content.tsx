'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { auth, db } from '@/firebase/config'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, query, where, getDocs, doc, getDoc, updateDoc, setDoc, onSnapshot } from 'firebase/firestore'
import { ensureUserRecord } from '@/lib/userSync'
import { User, Voucher, Wallet } from '@/types'
import { formatCurrency, SUPPORTED_COUNTRIES } from '@/lib/constants'
import { usePwaPrompt } from '@/lib/usePwaPrompt'
import { createNotification } from '@/lib/createNotification'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NotificationCenter } from '@/components/NotificationCenter'
import toast from 'react-hot-toast'
import Image from 'next/image'
import { Menu, X, Home, Gift, History, Settings, LogOut, ChevronRight, ShoppingBag, Wallet as WalletIcon, ArrowRightLeft, QrCode } from 'lucide-react'
import QRScanner from '@/components/QRScanner'

export default function SenderDashboard() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [user, setUser] = useState<User | null>(null)
  const [otherSideGiftsCount, setOtherSideGiftsCount] = useState<number>(0)
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [loading, setLoading] = useState(true)
  const [showDrawer, setShowDrawer] = useState(false)
  const [needsPhone, setNeedsPhone] = useState(false)
  const [activeTab, setActiveTab] = useState<'home' | 'gift' | 'top-up' | 'history' | 'store'>('home')
  const { showPrompt: showPwaPrompt, handleInstall: handlePwaInstall, handleDismiss: handlePwaDismiss } = usePwaPrompt()
  const [balanceTab, setBalanceTab] = useState<'sent' | 'pending' | 'redeemed'>('sent')
  const [exchangeRates, setExchangeRates] = useState<any>(null)
  const [paymentMethod, setPaymentMethod] = useState<'balance' | 'checkout' | null>(null)
  const [topUpAmount, setTopUpAmount] = useState('')
  const [topUpLoading, setTopUpLoading] = useState(false)
  const [showScannerModal, setShowScannerModal] = useState(false)

  // Helper: convert ZAR to USD
  const convertZarToUsd = (zarCents: number): number => {
    if (!exchangeRates) return 0
    const zarAmount = zarCents / 100
    const rate = exchangeRates['USD_TO_ZAR']
    if (!rate) return 0
    return zarAmount / rate
  }

  // Get total balance in USD (senderBalance + converted availableCredits)
  const getTotalBalanceUsd = (): number => {
    const senderUsd = (user?.senderBalance || 0) / 100
    const availableUsd = convertZarToUsd(wallet?.availableCredits || 0)
    return senderUsd + availableUsd
  }

  const [storeVouchers] = useState<any[]>([
    { id: 1, name: 'Quick $10', amount: 10, popular: false },
    { id: 2, name: 'Popular $50', amount: 50, popular: true },
    { id: 3, name: 'Premium $100', amount: 100, popular: false },
    { id: 4, name: 'Deluxe $250', amount: 250, popular: false },
    { id: 5, name: 'Elite $500', amount: 500, popular: false },
  ])
  const [giftForm, setGiftForm] = useState({
    recipientPhone: '', // accepts phone or handle (e.g. @alice)
    recipientCountry: 'ZA',
    amount: '',
    message: '',
  })

  // Load exchange rates
  useEffect(() => {
    const loadRates = async () => {
      try {
        const res = await fetch('/api/admin/exchange-rates')
        if (res.ok) {
          const json = await res.json()
          const rates = json.data?.rates || json?.rates || null
          setExchangeRates(rates)
        }
      } catch (e) {
        console.error('Failed to load exchange rates', e)
      }
    }
    loadRates()
  }, [])

  // Handle ?to= query parameter from QR code
  useEffect(() => {
    const recipientParam = searchParams.get('to')
    if (recipientParam) {
      setGiftForm((prev) => ({
        ...prev,
        recipientPhone: recipientParam,
      }))
      // Switch to gift tab
      setActiveTab('gift')
    }
  }, [searchParams])

  useEffect(() => {
    let unsubscribeVouchers: (() => void) | null = null

    const setupData = async (authUser: any) => {
      try {
        const uid = authUser.uid

        const onboardPhone = sessionStorage.getItem('onboardPhone') || authUser.phoneNumber || undefined
        const ensured = await ensureUserRecord(uid, onboardPhone as string | undefined)

        // Load canonical users/{uid}
        const userRef = doc(db, 'users', uid)
        const userSnap = await getDoc(userRef)
        if (userSnap.exists()) {
          const userData = userSnap.data() as User
          setUser(userData)

          const phone = userData.phoneE164 || ensured.phone || userData.phone || ''
          if (!phone) {
            setNeedsPhone(true)
            toast('Add your mobile number to receive gifts', { icon: 'ℹ️' })
          }

          if (phone) {
            const walletRef = doc(db, 'wallets', phone)
            const walletSnap = await getDoc(walletRef)
            if (walletSnap.exists()) {
              setWallet(walletSnap.data() as Wallet)
            }

            const vouchersQuery = query(
              collection(db, 'vouchers'),
              where('senderId', '==', uid)
            )
            const vouchersSnap = await getDocs(vouchersQuery)
            setVouchers(
              vouchersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Voucher))
            )
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error)
        toast.error('Failed to load dashboard')
      } finally {
        setLoading(false)
      }
    }

    const unsubscribe = onAuthStateChanged(auth, (authUser: any) => {
      if (!authUser) {
        router.push('/auth')
        return
      }
      setupData(authUser)
    })

    return () => unsubscribe()
  }, [router])

  // Listen for vouchers where this user is the recipient (gifts on the other side)
  useEffect(() => {
    if (!user?.phone) return
    const q = query(
      collection(db, 'vouchers'),
      where('recipientId', '==', user.phone)
    )
    const unsub = onSnapshot(q, (snapshot) => {
      setOtherSideGiftsCount(snapshot.size)
    }, (err) => {
      console.warn('Error listening for other-side vouchers', err)
    })

    return () => unsub()
  }, [user])

  const handleGiftCredits = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!giftForm.recipientPhone || !giftForm.amount) {
      toast.error('Please fill in required fields')
      return
    }

    // Determine whether input is a phone or a handle
    const input = giftForm.recipientPhone.trim()
    let resolvedPhone = input
    let resolvedHandle: string | null = null

    const digitsOnly = input.replace(/\D/g, '')
    if (!digitsOnly) {
      // treat as handle
      const handle = input.replace(/^@/, '')
      try {
        const res = await fetch('/api/user/resolve-handle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ handle }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Handle not found')
        resolvedPhone = json.data.phone
        resolvedHandle = json.data.handle
      } catch (err: any) {
        console.error('Handle resolution failed', err)
        toast.error(err.message || 'Failed to resolve handle')
        return
      }
    }

    const formattedRecipientPhone = resolvedPhone.replace(/\D/g, '')
    const formattedUserPhone = user?.phone?.replace(/\D/g, '') || ''

    if (formattedRecipientPhone === formattedUserPhone) {
      toast.error('You cannot send credits to yourself')
      return
    }

    setLoading(true)
    try {
      const baseAmount = parseFloat(giftForm.amount)

      // If using balance, send from balance (client-side Firestore)
      if (paymentMethod === 'balance') {
        const amountCents = Math.round(baseAmount * 100)
        const totalBalanceUsd = getTotalBalanceUsd()
        const totalBalanceCents = Math.round(totalBalanceUsd * 100)

        if (totalBalanceCents < amountCents) {
          toast.error(`Insufficient balance. You have $${totalBalanceUsd.toFixed(2)}`)
          setLoading(false)
          return
        }

        // Generate voucher code
        const voucherCode = Math.random().toString(36).substring(2, 8).toUpperCase()

        // Get recipient's base currency
        let recipientCurrency = 'ZAR'
        try {
          const recipientRef = doc(db, 'users', resolvedPhone)
          const recipientSnap = await getDoc(recipientRef)
          if (recipientSnap.exists()) {
            recipientCurrency = recipientSnap.data()?.baseCurrency || 'ZAR'
          }
        } catch (err) {
          console.warn('Failed to get recipient currency', err)
        }

        // Create voucher document
        const voucherRef = doc(collection(db, 'vouchers'))
        const voucherData = {
          id: voucherRef.id,
          code: voucherCode,
          senderId: user?.phone || '',
          recipientId: resolvedPhone,
          amount: amountCents,
          recipientCurrency: recipientCurrency,
          status: 'delivered',
          message: giftForm.message || '',
          paymentMethod: 'balance',
          createdAt: new Date(),
          updatedAt: new Date(),
        }

        // Determine how to deduct from balance (prioritize senderBalance, then availableCredits)
        const userRef = doc(db, 'users', user?.phone || '')
        const walletRef = doc(db, 'wallets', user?.phone || '')
        
        let newSenderBalance = user?.senderBalance || 0
        let newAvailableCredits = wallet?.availableCredits || 0
        let amountToDeductFromSender = amountCents

        if (newSenderBalance >= amountToDeductFromSender) {
          // Enough in sender balance
          newSenderBalance -= amountToDeductFromSender
        } else {
          // Not enough in sender balance, use both
          const remainingAmount = amountToDeductFromSender - newSenderBalance
          const remainingInZar = Math.round(remainingAmount * (exchangeRates?.['USD_TO_ZAR'] || 1))
          newSenderBalance = 0
          newAvailableCredits -= remainingInZar
        }

        await Promise.all([
          setDoc(voucherRef, voucherData),
          updateDoc(userRef, {
            senderBalance: newSenderBalance,
            updatedAt: new Date(),
          }),
          updateDoc(walletRef, {
            availableCredits: newAvailableCredits,
            updatedAt: new Date(),
          }),
        ])

        // Create notification for the recipient
        try {
          // Get recipient's uid if possible
          const recipientDocRef = doc(db, 'users', resolvedPhone)
          const recipientSnap = await getDoc(recipientDocRef)
          let recipientUid = resolvedPhone
          if (recipientSnap.exists()) {
            recipientUid = (recipientSnap.data() as any).id || recipientSnap.data()?.authUid || resolvedPhone
          }
          
          await createNotification(
            recipientUid,
            `💰 You received a TIP! ${formatCurrency(amountCents)}`,
            `${user?.fullName || 'Someone'} tipped you. ${giftForm.message ? `Message: "${giftForm.message}"` : 'Check it out!'}`,
            'voucher',
            voucherRef.id
          )
        } catch (e) {
          console.warn('Failed to create gift notification', e)
        }

        toast.success(`✅ Gift sent to ${resolvedHandle || resolvedPhone}! They've been notified. 🎉`)
        setGiftForm({ recipientPhone: '', recipientCountry: 'ZA', amount: '', message: '' })
        setPaymentMethod(null)
        setUser((prev) => prev ? { ...prev, senderBalance: newSenderBalance } : null)
        setWallet((prev) => prev ? { ...prev, availableCredits: newAvailableCredits } : null)
        return
      }

      // Otherwise, calculate fees and checkout with Paystack
      const platformFee = baseAmount * 0.05
      const processingFee = baseAmount * 0.10
      const fixedFee = 0.20
      const total = baseAmount + platformFee + processingFee + fixedFee

      // Store checkout data
      sessionStorage.setItem(
        'pendingCheckout',
        JSON.stringify({
          baseAmount,
          platformFee,
          processingFee,
          fixedFee,
          total,
          recipientPhone: resolvedPhone,
          recipientHandle: resolvedHandle,
          recipientCountry: giftForm.recipientCountry,
          currency: 'USD',
          message: giftForm.message,
          timestamp: Date.now(),
        })
      )

      // Redirect to payment page
      router.push('/payment')
      toast.success('Redirecting to payment...')
    } catch (error) {
      console.error('Error initiating gift:', error)
      toast.error('Failed to initiate gift')
    } finally {
      setLoading(false)
    }
  }

  const handleTopUpWallet = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!topUpAmount || parseFloat(topUpAmount) <= 0) {
      toast.error('Please enter a valid amount')
      return
    }

    setTopUpLoading(true)
    try {
      const amountCents = Math.round(parseFloat(topUpAmount) * 100)
      const userEmail = user?.email || `user+${user?.phone}@clantip.com`

      // Initialize payment via server (keeps secret keys server-side)
      const initRes = await fetch('/api/payments/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail,
          amount: parseFloat(topUpAmount),
          senderId: user?.phone || '',
          recipientId: user?.phone || '',
          message: 'Wallet top-up',
          currency: 'USD',
          reference: `WALLET_${user?.phone}_${Date.now()}`,
        }),
      })

      const initJson = await initRes.json()
      if (!initJson.success) {
        throw new Error(initJson.error || 'Failed to initialize payment')
      }

      const paystackData = initJson.data

      // Store top-up info in sessionStorage for callback handling
      sessionStorage.setItem(
        'pendingTopUp',
        JSON.stringify({
          amount: parseFloat(topUpAmount),
          amountCents: amountCents,
          reference: paystackData.reference,
          timestamp: Date.now(),
        })
      )

      // Redirect to provider checkout URL returned by server
      window.location.href = paystackData.authorization_url
    } catch (error: any) {
      console.error('Top-up error:', error)
      toast.error(error.message || 'Failed to initiate top-up')
      setTopUpLoading(false)
    }
  }

  const handleShareReceipt = async (voucher: Voucher) => {
    if (!user) return

    const receiptText = `
💰 Gift Sent Receipt - ClanTip

Amount Sent: ${formatCurrency(voucher.amount)}
Receipt Number: ${voucher.code}
To: ${voucher.recipientId}
Date: ${new Date(voucher.createdAt).toLocaleDateString('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
})}

✓ Gift sent successfully via ClanTip
Recipient has been notified
    `

    // Try to use Web Share API if available
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'ClanTip Gift Receipt',
          text: receiptText,
        })
        toast.success('Receipt shared successfully!')
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error('Error sharing:', error)
          toast.error('Failed to share receipt')
        }
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(receiptText)
        toast.success('Receipt copied to clipboard!')
      } catch (error) {
        console.error('Error copying:', error)
        toast.error('Failed to copy receipt')
      }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-accent/5">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent"></div>
          <p className="mt-4 text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  // Helper: convert ZAR to recipient currency
  const convertZarToTarget = (zarSubunits: number, targetCurrency: string) => {
    try {
      if (!exchangeRates) return null
      const amountZar = zarSubunits / 100

      // Direct ZAR -> target
      const directKey = `ZAR_TO_${targetCurrency}`
      if (exchangeRates[directKey]) {
        return amountZar * exchangeRates[directKey]
      }

      // Target is USD: use USD_TO_ZAR to invert
      if (targetCurrency === 'USD' && exchangeRates['USD_TO_ZAR']) {
        return amountZar / exchangeRates['USD_TO_ZAR']
      }

      // Fallback: via USD bridge
      if (exchangeRates['USD_TO_ZAR'] && exchangeRates[`USD_TO_${targetCurrency}`]) {
        const usdToZar = exchangeRates['USD_TO_ZAR']
        const usdToTarget = exchangeRates[`USD_TO_${targetCurrency}`]
        const rate = (1 / usdToZar) * usdToTarget
        return amountZar * rate
      }

      return null
    } catch (e) {
      console.error('Conversion error', e)
      return null
    }
  }

  const getCurrencySymbol = (currency: string) => {
    const found = SUPPORTED_COUNTRIES.find((c: any) => c.currency === currency)
    if (found) return found.symbol
    if (currency === 'ZWL' || currency === 'ZW') return 'Z$'
    if (currency === 'USD') return '$'
    return currency
  }

  // Format amount for sender: show USD amount sent + what recipient gets in their currency
  const formatSenderVoucherAmount = (voucher: any) => {
    try {
      let senderAmount = voucher.originalAmount
      
      // If originalAmount is missing (old voucher), calculate from ZAR using exchange rate
      if (!senderAmount && exchangeRates && exchangeRates['USD_TO_ZAR']) {
        const zarAmount = voucher.amount / 100 // convert from subunits
        const usdToZar = exchangeRates['USD_TO_ZAR']
        senderAmount = zarAmount / usdToZar // convert ZAR back to USD
      }
      
      // Fallback if still no amount
      if (!senderAmount) {
        senderAmount = 0
      }
      
      // Recipient currency and what they'll receive
      const recipientCurrency = voucher.recipientCurrency || 'ZAR'
      const recipientConverted = convertZarToTarget(voucher.amount, recipientCurrency)
      const recipientSym = getCurrencySymbol(recipientCurrency)

      return {
        mainAmount: `$${Number(senderAmount).toFixed(2)}`,
        subtitle: recipientConverted !== null 
          ? `Recipient gets ${recipientSym} ${Number(recipientConverted).toFixed(2)}`
          : `Recipient gets ${formatCurrency(voucher.amount)}`,
      }
    } catch (e) {
      console.error('Format error:', e)
      return {
        mainAmount: `$${Number(voucher.originalAmount || 0).toFixed(2)}`,
        subtitle: formatCurrency(voucher.amount),
      }
    }
  }

  const totalSent = vouchers.reduce((sum, v) => sum + v.amount, 0)
  const pendingAmount = vouchers.filter(v => v.status === 'delivered').reduce((sum, v) => sum + v.amount, 0)
  const redeemedAmount = vouchers.filter(v => v.status === 'paid').reduce((sum, v) => sum + v.amount, 0)

  // Helper: calculate total in USD
  const getTotalInUSD = (voucherList: Voucher[]) => {
    return voucherList.reduce((total, v) => {
      let usdAmount = v.originalAmount || 0
      // If no originalAmount, derive from ZAR
      if (!usdAmount && exchangeRates && exchangeRates['USD_TO_ZAR']) {
        const zarAmount = v.amount / 100
        usdAmount = zarAmount / exchangeRates['USD_TO_ZAR']
      }
      return total + usdAmount
    }, 0)
  }

  const totalSentUSD = getTotalInUSD(vouchers)
  const pendingAmountUSD = getTotalInUSD(vouchers.filter(v => v.status === 'delivered'))
  const redeemedAmountUSD = getTotalInUSD(vouchers.filter(v => v.status === 'paid'))

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-slate-200/50">
        <div className="px-4 py-3 flex items-center justify-between max-w-2xl mx-auto">
          <div className="relative w-32 h-10">
            <Image
              src="/clantip_logo.png"
              alt="ClanTip Logo"
              fill
              className="object-contain"
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <NotificationCenter />
              {otherSideGiftsCount > 0 && (
                <span className="absolute -top-1 -right-1 inline-flex items-center justify-center h-5 min-w-[20px] px-1 rounded-full bg-red-600 text-white text-xs font-semibold">
                  {otherSideGiftsCount}
                </span>
              )}
            </div>
            <button
              onClick={() => setShowDrawer(!showDrawer)}
              className="p-2 hover:bg-slate-100 rounded-lg transition"
            >
              {showDrawer ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </header>

      {needsPhone && (
        <div className="max-w-2xl mx-auto px-4 py-2">
          <div className="rounded-md bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-2 flex items-center justify-between">
            <div className="text-sm">Your account is missing a mobile number. Add it to receive gifts.</div>
            <div>
              <Button size="sm" onClick={() => router.push('/auth')}>Add Phone</Button>
            </div>
          </div>
        </div>
      )}

      {showPwaPrompt && (
        <div className="max-w-2xl mx-auto px-4 py-2">
          <div className="rounded-md bg-blue-50 border border-blue-200 text-blue-800 px-4 py-2 flex items-center justify-between">
            <div className="text-sm">Install ClanTip on your device for quick access and offline support.</div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handlePwaInstall} className="rounded-md bg-blue-600 hover:bg-blue-700">Install</Button>
              <Button size="sm" variant="outline" onClick={handlePwaDismiss} className="rounded-md">Later</Button>
            </div>
          </div>
        </div>
      )}

      {showDrawer && (
        <div className="fixed inset-0 z-50 bg-black/20" onClick={() => setShowDrawer(false)}>
          <div className="fixed inset-y-0 left-0 w-64 bg-white shadow-lg animate-in slide-in-from-left" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-200/50 flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center text-white font-bold">
                  {user?.fullName?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-sm">{user?.fullName}</p>
                  <p className="text-xs text-muted-foreground">{user?.phone}</p>
                </div>
              </div>
              <button onClick={() => setShowDrawer(false)} className="p-1 hover:bg-slate-100 rounded">
                <X size={20} />
              </button>
            </div>

            <nav className="p-4 space-y-2">
              <button
                onClick={() => {
                  setActiveTab('home')
                  setShowDrawer(false)
                }}
                className="w-full flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-slate-100 transition text-left"
              >
                <Home size={20} />
                <span className="text-sm font-medium">Send Credits</span>
              </button>
              <button
                onClick={() => router.push('/app/recipient')}
                className="w-full flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-slate-100 transition text-left bg-slate-50 border border-slate-200"
              >
                <Gift size={20} />
                <span className="text-sm font-medium">Receive Credits</span>
              </button>

              <div className="my-3 border-t border-slate-200"></div>

              <button
                onClick={() => {
                  setActiveTab('gift')
                  setShowDrawer(false)
                }}
                className="w-full flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-slate-100 transition text-left"
              >
                <Gift size={20} />
                <span className="text-sm font-medium">Send Custom Gift</span>
              </button>
              <button
                onClick={() => {
                  setActiveTab('store')
                  setShowDrawer(false)
                }}
                className="w-full flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-slate-100 transition text-left"
              >
                <ShoppingBag size={20} />
                <span className="text-sm font-medium">Ready Made</span>
              </button>
              <button
                onClick={() => {
                  setActiveTab('history')
                  setShowDrawer(false)
                }}
                className="w-full flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-slate-100 transition text-left"
              >
                <History size={20} />
                <span className="text-sm font-medium">My Gifts</span>
              </button>
              <button
                  onClick={() => {
                    router.push('/app/settings')
                    setShowDrawer(false)
                  }}
                className="w-full flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-slate-100 transition text-left"
              >
                <Settings size={20} />
                <span className="text-sm font-medium">Settings</span>
              </button>
              <button
                  onClick={() => {
                    router.push('/app/icon-store')
                    setShowDrawer(false)
                  }}
                className="w-full flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-slate-100 transition text-left"
              >
                <Gift size={20} />
                <span className="text-sm font-medium">Tiny Gifts</span>
              </button>
            </nav>

            <div className="absolute bottom-16 left-4 right-4">
              <button
                onClick={() => {
                  setShowScannerModal(true)
                }}
                className="w-full flex flex-col items-center gap-2 px-4 py-4 rounded-2xl bg-gradient-to-br from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 transition text-white font-semibold"
              >
                <QrCode size={32} />
                <span className="text-sm">Scan To Tip</span>
              </button>
            </div>

            <div className="absolute bottom-4 left-4 right-4">
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={() => {
                  auth.signOut()
                  router.push('/')
                }}
              >
                <LogOut size={18} />
                Sign Out
              </Button>
            </div>

            {showScannerModal && (
              <QRScanner
                onDetected={(raw) => {
                  let recipient = raw
                  try {
                    const parsed = new URL(raw)
                    const to = parsed.searchParams.get('to')
                    if (to) recipient = to
                  } catch (e) {
                    // raw value is not a URL — use as-is
                  }
                  setGiftForm((prev) => ({ ...prev, recipientPhone: recipient }))
                  setActiveTab('gift')
                  setShowScannerModal(false)
                  setShowDrawer(false)
                }}
                onClose={() => setShowScannerModal(false)}
              />
            )}
          </div>
        </div>
      )}

      <main className="max-w-2xl mx-auto px-4 pb-24 pt-4">
        {activeTab === 'home' && (
          <div className="space-y-4 animate-in fade-in">
            <div className="mb-6">
              <h1 className="text-2xl font-bold">Hi, {user?.fullName}! 👋</h1>
              <p className="text-sm text-muted-foreground">Send credits and manage your gifts</p>
            </div>

            {/* Balance Display Card */}
            <div className="bg-gradient-to-br from-primary/10 to-accent/10 rounded-2xl p-6 border border-slate-200/50">
              <p className="text-xs font-medium text-muted-foreground mb-2">Available Balance</p>
              <p className="text-4xl font-bold mb-3">${getTotalBalanceUsd().toFixed(2)}</p>
              <p className="text-xs italic text-muted-foreground -mt-1">Worth Of Love Credit</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Preloaded</p>
                  <p className="font-semibold">${((user?.senderBalance || 0) / 100).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">From Credits</p>
                  <p className="font-semibold">${convertZarToUsd(wallet?.availableCredits || 0).toFixed(2)}</p>
                </div>
              </div>
              <Button
                onClick={() => setActiveTab('top-up')}
                variant="outline"
                size="sm"
                className="w-full mt-4 rounded-xl"
              >
                Add Funds
              </Button>
            </div>

            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
              <button
                onClick={() => setBalanceTab('sent')}
                className={`px-4 py-2 rounded-full whitespace-nowrap font-medium transition ${
                  balanceTab === 'sent'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-white text-muted-foreground border border-slate-200/50'
                }`}
              >
                Sent
              </button>
              <button
                onClick={() => setBalanceTab('pending')}
                className={`px-4 py-2 rounded-full whitespace-nowrap font-medium transition ${
                  balanceTab === 'pending'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-white text-muted-foreground border border-slate-200/50'
                }`}
              >
                Pending
              </button>
              <button
                onClick={() => setBalanceTab('redeemed')}
                className={`px-4 py-2 rounded-full whitespace-nowrap font-medium transition ${
                  balanceTab === 'redeemed'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-white text-muted-foreground border border-slate-200/50'
                }`}
              >
                Redeemed
              </button>
            </div>

            <div className="rounded-2xl bg-gradient-to-br from-blue-500/10 to-blue-500/5 p-6 text-center border border-slate-200/50">
                  {balanceTab === 'sent' && (
                <>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Total Sent</p>
                      <div className="text-4xl font-bold mb-2">${Number(totalSentUSD).toFixed(2)}</div>
                  <p className="text-sm text-muted-foreground">{vouchers.length} gifts sent</p>
                </>
              )}
              {balanceTab === 'pending' && (
                <>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Pending Redemption</p>
                  <div className="text-4xl font-bold mb-2">${Number(pendingAmountUSD).toFixed(2)}</div>
                  <p className="text-sm text-muted-foreground">Waiting to be redeemed</p>
                </>
              )}
              {balanceTab === 'redeemed' && (
                <>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Successfully Redeemed</p>
                  <div className="text-4xl font-bold mb-2">${Number(redeemedAmountUSD).toFixed(2)}</div>
                  <p className="text-sm text-muted-foreground">Completed redemptions</p>
                </>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 mt-6">
              <Button
                onClick={() => setActiveTab('gift')}
                className="bg-gradient-to-r from-primary to-primary/80 h-14 text-base"
              >
                <Gift className="mr-2" size={20} />
                Custom Gift
              </Button>
              <Button
                onClick={() => router.push('/app/icon-store')}
                variant="outline"
                className="h-14 text-base rounded-2xl"
              >
                <Gift className="mr-2" size={20} />
                Tiny Gifts
              </Button>
            </div>

            {/* Promo cards removed (Tiny Gifts is accessible via button) */}

            <div className="mt-8">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-sm">Recent Gifts</h2>
                <button
                  onClick={() => setActiveTab('history')}
                  className="text-primary text-xs font-medium flex items-center gap-1"
                >
                  View all <ChevronRight size={14} />
                </button>
              </div>
              
              {vouchers.length === 0 ? (
                <div className="text-center py-8 bg-white rounded-2xl border border-slate-200/50">
                  <Gift size={32} className="mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-muted-foreground text-sm">No gifts sent yet</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3"
                    onClick={() => setActiveTab('gift')}
                  >
                    Send Your First Gift
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {vouchers.slice(0, 3).map((voucher) => {
                    const formatted = formatSenderVoucherAmount(voucher)
                    return (
                      <div key={voucher.id} className="bg-white rounded-lg p-3 flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-semibold text-sm">{formatted.mainAmount}</p>
                          <p className="text-xs text-muted-foreground">{formatted.subtitle}</p>
                          {voucher.message && (
                            <p className="text-xs text-muted-foreground truncate">{voucher.message}</p>
                          )}
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {voucher.status}
                        </Badge>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'gift' && (
          <div className="space-y-4 animate-in fade-in">
            <div>
              <h1 className="text-2xl font-bold mb-1">Create Custom Gift</h1>
              <p className="text-sm text-muted-foreground">Send credits to anyone</p>
            </div>

            <div className="bg-white rounded-2xl p-4 space-y-4 border border-slate-200/50">
              <form onSubmit={handleGiftCredits} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="recipientPhone" className="text-sm font-medium">Recipient Phone</Label>
                  <Input
                    id="recipientPhone"
                    type="tel"
                    placeholder="+27 123 456 7890"
                    value={giftForm.recipientPhone}
                    onChange={(e) =>
                      setGiftForm({ ...giftForm, recipientPhone: e.target.value })
                    }
                    className="rounded-2xl border-slate-200/50"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="country" className="text-sm font-medium">Where is the recipient?</Label>
                  <select
                    id="country"
                    className="w-full px-3 py-2 border border-slate-200/50 rounded-2xl text-sm"
                    value={giftForm.recipientCountry}
                    onChange={(e) =>
                      setGiftForm({ ...giftForm, recipientCountry: e.target.value })
                    }
                  >
                    {SUPPORTED_COUNTRIES.map((country) => (
                      <option key={country.code} value={country.code}>
                        {country.name} ({country.currency})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">Select the country where your recipient is located</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount" className="text-sm font-medium">Amount (USD)</Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="50"
                    min="1"
                    step="0.01"
                    value={giftForm.amount}
                    onChange={(e) =>
                      setGiftForm({ ...giftForm, amount: e.target.value })
                    }
                    className="rounded-2xl border-slate-200/50"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message" className="text-sm font-medium">Message (Optional)</Label>
                  <Input
                    id="message"
                    type="text"
                    placeholder="Add a personal message"
                    value={giftForm.message}
                    onChange={(e) =>
                      setGiftForm({ ...giftForm, message: e.target.value })
                    }
                    className="rounded-2xl border-slate-200/50"
                  />
                </div>

                {/* Payment Method Selector */}
                {getTotalBalanceUsd() > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Payment Method</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('balance')}
                        className={`p-3 rounded-2xl border-2 transition ${
                          paymentMethod === 'balance'
                            ? 'border-primary bg-primary/5'
                            : 'border-slate-200/50 hover:border-primary/50'
                        }`}
                      >
                        <p className="font-semibold text-sm">💰 From Balance</p>
                        <p className="text-xs text-muted-foreground">
                          ${getTotalBalanceUsd().toFixed(2)} available
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('checkout')}
                        className={`p-3 rounded-2xl border-2 transition ${
                          paymentMethod === 'checkout'
                            ? 'border-primary bg-primary/5'
                            : 'border-slate-200/50 hover:border-primary/50'
                        }`}
                      >
                        <p className="font-semibold text-sm">💳 Card Payment</p>
                        <p className="text-xs text-muted-foreground">New payment</p>
                      </button>
                    </div>
                  </div>
                )}

                <Button type="submit" className="w-full h-12 rounded-2xl">
                  {paymentMethod === 'balance' ? 'Send from Balance' : 'Proceed to Payment'}
                </Button>
              </form>
            </div>
          </div>
        )}

        {activeTab === 'store' && (
          <div className="space-y-4 animate-in fade-in">
            <div>
              <h1 className="text-2xl font-bold mb-1">Ready Made Vouchers</h1>
              <p className="text-sm text-muted-foreground">Quick and easy gift options</p>
            </div>

            <div className="space-y-3">
              {storeVouchers.map((voucher) => (
                <div
                  key={voucher.id}
                  className={`bg-white rounded-2xl p-4 flex items-center justify-between transition border border-slate-200/50 ${
                    voucher.popular ? 'ring-2 ring-primary' : ''
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{voucher.name}</h3>
                      {voucher.popular && (
                        <Badge className="bg-primary/20 text-primary border-0">Popular</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      ${voucher.amount} USD
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="rounded-lg"
                    onClick={() => {
                      setGiftForm({
                        ...giftForm,
                        amount: voucher.amount.toString()
                      })
                      setActiveTab('gift')
                    }}
                  >
                    Select <ChevronRight size={16} className="ml-1" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="bg-gradient-to-br from-primary/10 to-accent/10 rounded-2xl p-4 text-center border border-slate-200/50">
              <p className="text-sm text-muted-foreground">
                Can&apos;t find what you need? Create a custom gift amount instead.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => setActiveTab('gift')}
              >
                Custom Amount
              </Button>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-4 animate-in fade-in">
            <div>
              <h1 className="text-2xl font-bold mb-1">Gift History</h1>
              <p className="text-sm text-muted-foreground">All your sent vouchers</p>
            </div>

            {vouchers.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center border border-slate-200/50">
                <History size={32} className="mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground text-sm">No gifts sent yet</p>
                <Button
                  size="sm"
                  className="mt-4"
                  onClick={() => setActiveTab('gift')}
                >
                  Send a Gift
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {vouchers.map((voucher) => {
                  const formatted = formatSenderVoucherAmount(voucher)
                  return (
                    <div key={voucher.id} className="bg-white rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex-1">
                          <p className="font-semibold text-lg">{formatted.mainAmount}</p>
                          <p className="text-xs text-muted-foreground">{formatted.subtitle}</p>
                          <p className="text-xs text-muted-foreground font-mono mt-1">Code: {voucher.code}</p>
                          {voucher.message && (
                            <p className="text-sm text-muted-foreground mt-1">{voucher.message}</p>
                          )}
                        </div>
                        <Badge variant="outline">{voucher.status}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">
                        {new Date(voucher.createdAt).toLocaleDateString()}
                      </p>
                      <Button
                        onClick={() => handleShareReceipt(voucher)}
                        variant="outline"
                        size="sm"
                        className="w-full text-xs h-8"
                      >
                        📤 Share Receipt
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'top-up' && (
          <div className="space-y-4 animate-in fade-in">
            <div>
              <h1 className="text-2xl font-bold mb-1">Top Up Wallet</h1>
              <p className="text-sm text-muted-foreground">Add funds for quick tipping</p>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-slate-200/50">
              <div className="bg-gradient-to-br from-primary/10 to-accent/10 rounded-2xl p-6 mb-6 text-center">
                <p className="text-xs text-muted-foreground mb-1">Total Available Balance</p>
                <p className="text-4xl font-bold">${getTotalBalanceUsd().toFixed(2)}</p>
                <p className="text-xs text-muted-foreground mt-2 space-y-1">
                  <div>Preloaded: ${((user?.senderBalance || 0) / 100).toFixed(2)}</div>
                  <div>From Redeemed Credits: ${convertZarToUsd(wallet?.availableCredits || 0).toFixed(2)}</div>
                </p>
              </div>

              <form onSubmit={handleTopUpWallet} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="topUpAmount" className="text-sm font-medium">Amount (USD)</Label>
                  <Input
                    id="topUpAmount"
                    type="number"
                    placeholder="50"
                    min="1"
                    step="0.01"
                    value={topUpAmount}
                    onChange={(e) => setTopUpAmount(e.target.value)}
                    className="rounded-2xl border-slate-200/50 text-lg"
                  />
                  <p className="text-xs text-muted-foreground">Minimum: $1.00</p>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <p className="text-sm text-blue-900">
                    <span className="font-semibold">💡 Tip:</span> Preload your wallet to send tips instantly without checking out each time!
                  </p>
                </div>

                <div className="pt-4 space-y-2">
                  <Button
                    type="submit"
                    disabled={topUpLoading}
                    className="w-full h-12 rounded-2xl bg-gradient-to-r from-primary to-primary/80"
                  >
                    {topUpLoading ? 'Processing...' : `Add $${topUpAmount || '0'} to Wallet`}
                  </Button>
                  <p className="text-xs text-center text-muted-foreground">
                    Securely processed by Card Payment
                  </p>
                </div>
              </form>

              <div className="mt-6 pt-6 border-t border-slate-200/50 space-y-3">
                <h3 className="font-semibold text-sm">Benefits of Preloading:</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span>⚡</span>
                    <span>Send tips instantly from your balance</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span>🚀</span>
                    <span>No payment checkout needed</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span>📊</span>
                    <span>Track your spending easily</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span>🌍</span>
                    <span>Send to recipients worldwide</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200/50 z-20">
        <div className="flex items-center justify-around max-w-2xl mx-auto px-4 overflow-x-auto">
          <button
            onClick={() => setActiveTab('home')}
            className={`flex-1 py-3 flex flex-col items-center gap-1 transition whitespace-nowrap ${
              activeTab === 'home'
                ? 'text-primary'
                : 'text-muted-foreground'
            }`}
          >
            <Home size={24} />
            <span className="text-xs font-medium">Home</span>
          </button>
          <button
            onClick={() => setActiveTab('gift')}
            className={`flex-1 py-3 flex flex-col items-center gap-1 transition whitespace-nowrap ${
              activeTab === 'gift'
                ? 'text-primary'
                : 'text-muted-foreground'
            }`}
          >
            <Gift size={24} />
            <span className="text-xs font-medium">Gift</span>
          </button>
          <button
            onClick={() => setActiveTab('store')}
            className={`flex-1 py-3 flex flex-col items-center gap-1 transition whitespace-nowrap ${
              activeTab === 'store'
                ? 'text-primary'
                : 'text-muted-foreground'
            }`}
          >
            <ShoppingBag size={24} />
            <span className="text-xs font-medium">Store</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-3 flex flex-col items-center gap-1 transition whitespace-nowrap ${
              activeTab === 'history'
                ? 'text-primary'
                : 'text-muted-foreground'
            }`}
          >
            <History size={24} />
            <span className="text-xs font-medium">History</span>
          </button>
          <button
            onClick={() => router.push('/app/recipient')}
            className="flex-1 py-3 flex flex-col items-center gap-1 transition text-muted-foreground hover:text-primary whitespace-nowrap"
            title="Switch to Recipient"
          >
            <ArrowRightLeft size={28} />
          </button>
        </div>
      </nav>
    </div>
  )
}
