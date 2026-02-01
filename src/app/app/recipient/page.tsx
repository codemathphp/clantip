'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { auth, db } from '@/firebase/config'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, query, where, getDocs, doc, getDoc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore'
import { ensureUserRecord } from '@/lib/userSync'
import { usePwaPrompt } from '@/lib/usePwaPrompt'
import { createNotification } from '@/lib/createNotification'
import { useTheme } from '@/context/ThemeContext'
import { User, Voucher, Wallet, Redemption } from '@/types'
import { formatCurrency, SA_BANKS, SUPPORTED_COUNTRIES } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NotificationCenter } from '@/components/NotificationCenter'
import toast from 'react-hot-toast'
import Image from 'next/image'
import { Menu, X, Home, Gift, History, Settings, LogOut, ChevronRight, Wallet as WalletIcon, ArrowRightLeft, QrCode, Sun, Moon } from 'lucide-react'

export default function RecipientDashboard() {
  const { theme, toggleTheme } = useTheme()
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [redemptions, setRedemptions] = useState<Redemption[]>([])
  const [loading, setLoading] = useState(true)
  const [showDrawer, setShowDrawer] = useState(false)
  const [needsPhone, setNeedsPhone] = useState(false)
  const [activeTab, setActiveTab] = useState<'home' | 'vouchers' | 'gift' | 'redeem' | 'history'>('home')
  const { showPrompt: showPwaPrompt, handleInstall: handlePwaInstall, handleDismiss: handlePwaDismiss } = usePwaPrompt()
  const [balanceTab, setBalanceTab] = useState<'available' | 'pending' | 'received'>('received')
  const [paymentMethod, setPaymentMethod] = useState<'eft' | 'mobile_wallet' | null>(null)
  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null)
  const [selectedRedemption, setSelectedRedemption] = useState<Redemption | null>(null)
  const [tinyGifts, setTinyGifts] = useState<any[]>([])
  const [vouchersTab, setVouchersTab] = useState<'custom' | 'tiny'>('custom')
  const [selectedTinyGiftIcon, setSelectedTinyGiftIcon] = useState<string | null>(null)
  const [redeemForm, setRedeemForm] = useState({
    bankCode: '',
    accountNumber: '',
    accountName: '',
    amount: '',
  })
  const [exchangeRates, setExchangeRates] = useState<any>(null)
  const [giftForm, setGiftForm] = useState({
    recipientPhone: '',
    recipientCountry: 'ZA',
    amount: '',
    message: '',
  })
  const [giftPaymentMethod, setGiftPaymentMethod] = useState<'sender-balance' | 'available-credits' | 'checkout' | null>(null)
  const [giftLoading, setGiftLoading] = useState(false)
  const [preloadForm, setPreloadForm] = useState({
    amount: '',
  })
  const [preloadPaymentMethod, setPreloadPaymentMethod] = useState<'checkout' | null>(null)
  const [preloadLoading, setPreloadLoading] = useState(false)
  const [billingInfo, setBillingInfo] = useState<any>(null)

  useEffect(() => {
    // Load exchange rates for converting ZAR -> recipient currency
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

  useEffect(() => {
    let unsubscribeVouchers: (() => void) | null = null

    const setupData = async (authUser: any) => {
      try {
        const uid = authUser.uid

        // Try to ensure a canonical users/{uid} and get phoneE164 if available
        const onboardPhone = sessionStorage.getItem('onboardPhone') || authUser.phoneNumber || undefined
        const ensured = await ensureUserRecord(uid, onboardPhone as string | undefined)

        // Load the canonical user document users/{uid}
        const userRef = doc(db, 'users', uid)
        const userSnap = await getDoc(userRef)
        if (userSnap.exists()) {
          const userData = userSnap.data() as User
          setUser(userData)

          // Load wallet by phone if we have one
          const phone = userData.phoneE164 || ensured.phone || userData.phone || ''
          if (!phone) {
            // No phone available for this account — show a non-blocking prompt to add one
            setNeedsPhone(true)
            toast('Add your mobile number to receive gifts', { icon: 'ℹ️' })
          }

          if (phone) {
            const walletRef = doc(db, 'wallets', phone)
            const walletSnap = await getDoc(walletRef)
            if (walletSnap.exists()) {
              setWallet(walletSnap.data() as Wallet)
            }

            // Set up REAL-TIME listener for vouchers using phone as recipientId
            const vouchersQuery = query(
              collection(db, 'vouchers'),
              where('recipientId', '==', phone)
            )
            unsubscribeVouchers = onSnapshot(vouchersQuery, (snapshot) => {
              const vouchersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Voucher))
              setVouchers(vouchersList)
              console.log(`🔔 [Recipient] Updated ${vouchersList.length} vouchers in real-time`)
            })

            // Set up REAL-TIME listener for tiny gifts (microgifts)
            const tinyGiftsQuery = query(
              collection(db, 'microgifts'),
              where('recipientId', '==', phone)
            )
            onSnapshot(tinyGiftsQuery, (snapshot) => {
              const tinyGiftsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
              setTinyGifts(tinyGiftsList)
              console.log(`💝 [Recipient] Updated ${tinyGiftsList.length} tiny gifts in real-time`)
            })
          }

          const redemptionsQuery = query(
            collection(db, 'redemptions'),
            where('userId', '==', uid)
          )
          const redemptionsSnap = await getDocs(redemptionsQuery)
          setRedemptions(
            redemptionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Redemption))
          )
        }

        setLoading(false)
      } catch (error) {
        console.error('Error fetching data:', error)
        toast.error('Failed to load dashboard')
        setLoading(false)
      }
    }

    const unsubscribeAuth = onAuthStateChanged(auth, (authUser: any) => {
      if (!authUser) {
        router.push('/auth')
        return
      }
      setupData(authUser)
    })

    return () => {
      unsubscribeAuth()
      if (unsubscribeVouchers) {
        unsubscribeVouchers()
      }
    }
  }, [router])

  const handleRedeemVoucher = async (voucherToRedeem: Voucher) => {
    try {
      const response = await fetch('/api/vouchers/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voucherId: voucherToRedeem.id }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      toast.success(data.message)
      
      // Update local state
      setVouchers(prev => prev.map(v => 
        v.id === voucherToRedeem.id ? { ...v, status: 'redeemed' } : v
      ))
      if (selectedVoucher?.id === voucherToRedeem.id) {
        setSelectedVoucher({ ...selectedVoucher, status: 'redeemed' })
      }
      
      // Refresh wallet (availableCredits updated server-side)
      if (user?.phone) {
        const walletRef = doc(db, 'wallets', user.phone)
        const walletSnap = await getDoc(walletRef)
        if (walletSnap.exists()) {
          setWallet(walletSnap.data() as Wallet)
        }
      }
    } catch (error: any) {
      console.error('Redeem voucher error:', error)
      toast.error(error.message || 'Failed to redeem voucher')
    }
  }

  const handlePreloadInitiate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!preloadForm.amount) {
      toast.error('Please enter an amount')
      return
    }

    const baseAmount = parseFloat(preloadForm.amount)
    if (baseAmount <= 0) {
      toast.error('Amount must be greater than 0')
      return
    }

    setPreloadLoading(true)
    try {
      // Calculate charges (e.g., 5% processing fee)
      const processingFeePercent = 0.05
      const processingFee = baseAmount * processingFeePercent
      const totalAmount = baseAmount + processingFee

      // Show billing info
      setBillingInfo({
        baseAmount,
        processingFee,
        totalAmount,
        currency: 'USD',
      })

      const userEmail = user?.email || `user+${user?.phone}@clantip.com`
      const reference = `PRELOAD_${user?.phone}_${Date.now()}`

      // Initialize payment via server
      const initRes = await fetch('/api/payments/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail,
          amount: totalAmount,
          senderId: user?.phone || '',
          recipientId: user?.phone || '',
          recipientPhone: user?.phone || '',
          message: 'Preload funds for gifting',
          currency: 'USD',
          reference,
          type: 'preload',
        }),
      })

      const initJson = await initRes.json()
      if (!initJson.success) {
        throw new Error(initJson.error || 'Failed to initialize payment')
      }

      const paystackData = initJson.data

      // Store preload info in sessionStorage
      sessionStorage.setItem(
        'pendingPreload',
        JSON.stringify({
          baseAmount,
          totalAmount,
          processingFee,
          reference: paystackData.reference || reference,
          timestamp: Date.now(),
        })
      )

      // Redirect to payment gateway
      window.location.href = paystackData.authorization_url
    } catch (error: any) {
      console.error('Preload initiation error:', error)
      toast.error(error.message || 'Failed to initiate preload')
      setPreloadLoading(false)
      setBillingInfo(null)
    }
  }

  const handleSendGift = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!giftForm.recipientPhone || !giftForm.amount || !giftPaymentMethod) {
      toast.error('Please fill in all required fields')
      return
    }

    setGiftLoading(true)
    try {
      const baseAmount = parseFloat(giftForm.amount)
      const amountCents = Math.round(baseAmount * 100)
      
      // If using checkout, redirect to Paystack
      if (giftPaymentMethod === 'checkout') {
        const userEmail = user?.email || `user+${user?.phone}@clantip.com`
        const reference = `GIFT_${user?.phone}_${Date.now()}`

        // Initialize payment via server to avoid exposing secret keys
        const initRes = await fetch('/api/payments/initialize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: userEmail,
            amount: baseAmount,
            senderId: user?.phone || '',
            recipientId: giftForm.recipientPhone.replace(/\D/g, ''),
            recipientPhone: giftForm.recipientPhone.replace(/\D/g, ''),
            message: giftForm.message,
            currency: 'USD',
            reference,
          }),
        })

        const initJson = await initRes.json()
        if (!initJson.success) {
          throw new Error(initJson.error || 'Failed to initialize payment')
        }

        const paystackData = initJson.data

        // Store gift info in sessionStorage for callback
        sessionStorage.setItem(
          'pendingGift',
          JSON.stringify({
            amount: baseAmount,
            amountCents: amountCents,
            recipientPhone: giftForm.recipientPhone.replace(/\D/g, ''),
            message: giftForm.message,
            reference: paystackData.reference || reference,
            timestamp: Date.now(),
          })
        )

        // Redirect to provider checkout (server returned authorization_url)
        window.location.href = paystackData.authorization_url
        return
      }

      // If using balance, deduct from balance
      const balance = giftPaymentMethod === 'sender-balance' 
        ? (user?.senderBalance || 0)
        : (wallet?.availableCredits || 0)

      if (balance < amountCents) {
        const balanceName = giftPaymentMethod === 'sender-balance' ? 'Sender Balance' : 'Available Credits'
        toast.error(`Insufficient ${balanceName}. You have $${(balance / 100).toFixed(2)}`)
        setGiftLoading(false)
        return
      }

      const resolvedPhone = giftForm.recipientPhone.replace(/\D/g, '')
      const formattedUserPhone = user?.phone?.replace(/\D/g, '') || ''

      if (resolvedPhone === formattedUserPhone) {
        toast.error('You cannot send credits to yourself')
        setGiftLoading(false)
        return
      }

      // Generate voucher code
      const voucherCode = Math.random().toString(36).substring(2, 8).toUpperCase()

      // Create voucher document
      const voucherRef = doc(collection(db, 'vouchers'))
      const voucherData = {
        id: voucherRef.id,
        code: voucherCode,
        senderId: user?.phone || '',
        recipientId: resolvedPhone,
        amount: amountCents,
        recipientCurrency: 'ZAR',
        status: 'delivered',
        message: giftForm.message || '',
        paymentMethod: giftPaymentMethod === 'sender-balance' ? 'balance' : 'redeemed',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      // Update balance and create voucher
      const userRef = doc(db, 'users', user?.phone || '')
      const newBalance = balance - amountCents

      if (giftPaymentMethod === 'sender-balance') {
        // Deduct from senderBalance
        await Promise.all([
          setDoc(voucherRef, voucherData),
          updateDoc(userRef, {
            senderBalance: newBalance,
            updatedAt: new Date(),
          }),
        ])
        setUser((prev) => prev ? { ...prev, senderBalance: newBalance } : null)
      } else {
        // Deduct from availableCredits (wallet)
        const walletRef = doc(db, 'wallets', user?.phone || '')
        await Promise.all([
          setDoc(voucherRef, voucherData),
          updateDoc(walletRef, {
            availableCredits: newBalance,
            updatedAt: new Date(),
          }),
        ])
        setWallet((prev) => prev ? { ...prev, availableCredits: newBalance } : null)
      }

      // Create notification for the recipient
      try {
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

      toast.success('Gift sent!')
      setGiftForm({ recipientPhone: '', recipientCountry: 'ZA', amount: '', message: '' })
      setGiftPaymentMethod(null)
    } catch (error: any) {
      console.error('Send gift error:', error)
      toast.error(error.message || 'Failed to send gift')
      setGiftLoading(false)
    }
  }

  const handleRedeemCredits = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!redeemForm.bankCode || !redeemForm.accountNumber || !redeemForm.accountName || !redeemForm.amount) {
      toast.error('Please fill in all required fields')
      return
    }

    try {
      toast.success('Redemption request submitted!')
      setRedeemForm({ bankCode: '', accountNumber: '', accountName: '', amount: '' })
    } catch (error) {
      console.error('Error redeeming credits:', error)
      toast.error('Failed to submit redemption request')
    }
  }

  const handleShareReceipt = async (voucher: Voucher) => {
    if (!user) return

    const receiptText = `
💰 Gift Receipt - ClanTip

Amount Received: ${formatCurrency(voucher.amount)}
Receipt Number: ${voucher.code}
From: ${user?.fullName || 'Unknown'}
Date: ${formatDate(voucher.createdAt)}

✓ This gift has been received on ClanTip
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

  const formatDate = (timestamp: any) => {
    try {
      if (!timestamp) return 'N/A'
      // Handle Firebase Timestamp objects
      if (timestamp.toDate && typeof timestamp.toDate === 'function') {
        return new Date(timestamp.toDate()).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      }
      // Handle regular Date objects or strings
      return new Date(timestamp).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch (e) {
      return 'Invalid date'
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

  // Helper: convert ZAR amount (in subunits/cents) to target currency amount
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

  const formatVoucherAmount = (voucher: Voucher | null) => {
    if (!voucher) return ''
    try {
      const recipientCurrency = voucher.recipientCurrency || user?.baseCurrency || 'ZAR'
      const converted = convertZarToTarget(voucher.amount, recipientCurrency)
      const sym = getCurrencySymbol(recipientCurrency)
      if (converted === null) return formatCurrency(voucher.amount)
      return `${sym} ${Number(converted).toFixed(2)}`
    } catch (e) {
      console.error('formatVoucherAmount error', e)
      return formatCurrency(voucher.amount)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <header className="sticky top-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/50 dark:border-slate-700/50 dark:border-slate-700/50">
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
            <NotificationCenter />
            <button
              onClick={() => setShowDrawer(!showDrawer)}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition text-slate-600 dark:text-slate-300"
            >
              {showDrawer ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </header>

      {needsPhone && (
        <div className="max-w-2xl mx-auto px-4 py-2">
          <div className="rounded-md bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-300 px-4 py-2 flex items-center justify-between">
            <div className="text-sm">Your account is missing a mobile number. Add it to receive gifts.</div>
            <div>
              <Button size="sm" onClick={() => router.push('/auth')}>Add Phone</Button>
            </div>
          </div>
        </div>
      )}

      {showPwaPrompt && (
        <div className="max-w-2xl mx-auto px-4 py-2">
          <div className="rounded-md bg-blue-50 dark:bg-blue-950/20 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 px-4 py-2 flex items-center justify-between">
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
          <div className="fixed inset-y-0 left-0 w-64 bg-white dark:bg-slate-900 shadow-lg animate-in slide-in-from-left" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-200/50 dark:border-slate-700/50 dark:border-slate-700/50 flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center text-white font-bold">
                  {user?.fullName?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-sm dark:text-slate-100">{user?.fullName}</p>
                  <p className="text-xs text-muted-foreground dark:text-slate-400">{user?.phone}</p>
                </div>
              </div>
              <button onClick={() => setShowDrawer(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-600 dark:text-slate-300">
                <X size={20} />
              </button>
            </div>

            <nav className="p-4 space-y-2">
              <button
                onClick={() => {
                  setActiveTab('home')
                  setShowDrawer(false)
                }}
                className="w-full flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-slate-100 transition text-left bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
              >
                <Gift size={20} />
                <span className="text-sm font-medium dark:text-slate-100">Receive Credits</span>
              </button>
              <button
                onClick={() => router.push('/app/sender')}
                className="w-full flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition text-left dark:text-slate-100"
              >
                <Home size={20} />
                <span className="text-sm font-medium dark:text-slate-100">Send Credits</span>
              </button>

              <div className="my-3 border-t border-slate-200"></div>

              <button
                onClick={() => {
                  setActiveTab('vouchers')
                  setShowDrawer(false)
                }}
                className="w-full flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition text-left dark:text-slate-100"
              >
                <Gift size={20} />
                <span className="text-sm font-medium dark:text-slate-100">My Vouchers</span>
              </button>
              <button
                onClick={() => {
                  setActiveTab('redeem')
                  setShowDrawer(false)
                }}
                className="w-full flex items-center gap-3 px-4 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition text-left dark:text-slate-100"
              >
                <WalletIcon size={20} />
                <span className="text-sm font-medium dark:text-slate-100">Gifted Stream</span>
              </button>
              <button
                onClick={() => {
                  setActiveTab('history')
                  setShowDrawer(false)
                }}
                className="w-full flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition text-left dark:text-slate-100"
              >
                <History size={20} />
                <span className="text-sm font-medium dark:text-slate-100">Redemption History</span>
              </button>
              <button
                onClick={() => {
                  router.push('/app/settings')
                  setShowDrawer(false)
                }}
                className="w-full flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition text-left dark:text-slate-100"
              >
                <Settings size={20} />
                <span className="text-sm font-medium dark:text-slate-100">Settings</span>
              </button>

              <button
                onClick={(e) => e.preventDefault()}
                aria-disabled="true"
                className="w-full flex items-center gap-3 px-4 py-2 rounded-lg opacity-60 cursor-not-allowed transition text-left dark:text-slate-100"
              >
                {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
                <span className="text-sm font-medium dark:text-slate-100">{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
              </button>
            </nav>

            <div className="absolute bottom-16 left-4 right-4">
              <button
                onClick={() => {
                  router.push('/app/receive')
                  setShowDrawer(false)
                }}
                className="w-full flex flex-col items-center gap-2 px-4 py-4 rounded-2xl bg-gradient-to-br from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 transition text-white font-semibold"
              >
                <QrCode size={32} />
                <span className="text-sm">My Tip Code</span>
              </button>
            </div>

            <div className="absolute bottom-4 left-4 right-4">
              <Button
                variant="outline"
                className="w-full justify-start gap-2 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700 dark:hover:bg-slate-700"
                onClick={() => {
                  auth.signOut()
                  router.push('/')
                }}
              >
                <LogOut size={18} />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-2xl mx-auto px-4 pb-24 pt-4">
        {activeTab === 'home' && (
          <div className="space-y-4 animate-in fade-in">
            <div className="mb-6">
              <h1 className="text-2xl font-bold dark:text-slate-100">Hi, {user?.fullName}! 👋</h1>
              <p className="text-sm text-muted-foreground dark:text-slate-400">Manage your received credits</p>
            </div>

            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
              <button
                onClick={() => setBalanceTab('received')}
                className={`px-4 py-2 rounded-full whitespace-nowrap font-medium transition ${
                  balanceTab === 'received'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-white dark:bg-slate-800 text-muted-foreground dark:text-slate-100 border border-slate-200/50 dark:border-slate-700/50'
                }`}
              >
                Received
              </button>
              <button
                onClick={() => setBalanceTab('pending')}
                className={`px-4 py-2 rounded-full whitespace-nowrap font-medium transition ${
                  balanceTab === 'pending'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-white dark:bg-slate-800 text-muted-foreground dark:text-slate-100 border border-slate-200/50 dark:border-slate-700/50'
                }`}
              >
                Pending
              </button>
              <button
                onClick={() => setBalanceTab('available')}
                className={`px-4 py-2 rounded-full whitespace-nowrap font-medium transition ${
                  balanceTab === 'available'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-white dark:bg-slate-800 text-muted-foreground dark:text-slate-100 border border-slate-200/50 dark:border-slate-700/50'
                }`}
              >
                Available
              </button>
            </div>

            <div className="rounded-2xl bg-gradient-to-br from-green-500/10 to-green-500/5 p-6 text-center border border-slate-200/50 dark:border-slate-700/50">
              {balanceTab === 'received' && (
                <>
                  <p className="text-xs font-medium text-muted-foreground dark:text-slate-300 mb-2">Total Received</p>
                  <div className="text-4xl font-bold mb-2 text-slate-900 dark:text-slate-100">{formatCurrency(vouchers.reduce((sum, v) => sum + v.amount, 0))}</div>
                  <p className="text-sm text-muted-foreground dark:text-slate-300">{vouchers.length} vouchers</p>
                </>
              )}
              {balanceTab === 'pending' && (
                <>
                  <p className="text-xs font-medium text-muted-foreground dark:text-slate-300 mb-2">Pending Credits</p>
                  <div className="text-4xl font-bold mb-2 text-slate-900 dark:text-slate-100">{formatCurrency(wallet?.pendingCredits || 0)}</div>
                  <p className="text-sm text-muted-foreground dark:text-slate-300">Being processed</p>
                </>
              )}
              {balanceTab === 'available' && (
                <>
                  <p className="text-xs font-medium text-muted-foreground dark:text-slate-300 mb-2">Available to Redeem</p>
                  <div className="text-4xl font-bold mb-2 text-slate-900 dark:text-slate-100">{formatCurrency(wallet?.availableCredits || 0)}</div>
                  <p className="text-sm text-muted-foreground dark:text-slate-300">Ready for withdrawal</p>
                </>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 mt-6">
              <Button
                onClick={() => setActiveTab('vouchers')}
                className="bg-gradient-to-r from-primary to-primary/80 h-14 text-base text-primary-foreground rounded-2xl"
              >
                <Gift className="mr-2" size={20} />
                View Gifts
              </Button>
              <Button
                onClick={() => router.push('/app/gift-stream')}
                variant="outline"
                className="h-14 text-base rounded-2xl dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700 dark:hover:bg-slate-700"
              >
                <WalletIcon className="mr-2" size={20} />
                Gift Stream
              </Button>
            </div>

            <div className="mt-8">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-sm dark:text-slate-100">Recent Vouchers</h2>
                <button
                  onClick={() => setActiveTab('vouchers')}
                  className="text-primary text-xs font-medium flex items-center gap-1 dark:text-orange-400"
                >
                  View all <ChevronRight size={14} />
                </button>
              </div>
              
              {vouchers.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200/50 dark:border-slate-700/50">
                  <Gift size={32} className="mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-muted-foreground text-sm">No vouchers received yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {vouchers.slice(0, 3).map((voucher) => (
                    <button
                      key={voucher.id}
                      onClick={() => {
                        setSelectedVoucher(voucher)
                        setActiveTab('vouchers')
                      }}
                      className="w-full bg-slate-50 dark:bg-slate-900 dark:text-slate-100 rounded-lg p-3 flex items-center justify-between hover:shadow-md transition border border-slate-100 dark:border-slate-700 text-left"
                    >
                      <div className="flex-1">
                        <p className="font-semibold text-sm">{formatCurrency(voucher.amount)}</p>
                        <p className="text-xs text-muted-foreground font-mono">Code: {voucher.code}</p>
                        {voucher.message && (
                          <p className="text-xs text-muted-foreground truncate">{voucher.message}</p>
                        )}
                      </div>
                      <Badge variant="outline" className="text-xs flex-shrink-0 ml-2">
                        {voucher.status}
                      </Badge>
                    </button>
                  ))}
                </div>
              )} 
            </div>
          </div>
        )}

        {activeTab === 'vouchers' && (
          <div className="space-y-4 animate-in fade-in">
            <div>
              <h1 className="text-2xl font-bold dark:text-slate-100 mb-1">My Vouchers</h1>
              <p className="text-sm text-muted-foreground dark:text-slate-400">All gifts received</p>
            </div>

            {/* Tabs for Custom vs Tiny Gifts */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => {
                  setVouchersTab('custom')
                  setSelectedVoucher(null)
                }}
                className={`px-4 py-2 rounded-full font-medium transition ${
                  vouchersTab === 'custom'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-white dark:bg-slate-800 text-muted-foreground dark:text-slate-100 border border-slate-200/50 dark:border-slate-700/50'
                }`}
              >
                Custom Gifts
              </button>
              <button
                onClick={() => {
                  setVouchersTab('tiny')
                  setSelectedTinyGiftIcon(null)
                }}
                className={`px-4 py-2 rounded-full font-medium transition ${
                  vouchersTab === 'tiny'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-white dark:bg-slate-800 text-muted-foreground dark:text-slate-100 border border-slate-200/50 dark:border-slate-700/50'
                }`}
              >
                Tiny Gifts ({tinyGifts.length})
              </button>
            </div>

            {vouchersTab === 'custom' && selectedVoucher ? (
              // Custom Voucher Receipt View
              <div className="space-y-4">
                <button
                  onClick={() => setSelectedVoucher(null)}
                  className="text-sm text-primary flex items-center gap-1 hover:underline"
                >
                  ← Back to vouchers
                </button>

                <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/50">
                  <div className="text-center mb-6 pb-6 border-b border-slate-200/50 dark:border-slate-700/50">
                    <div className="inline-block bg-gradient-to-br from-primary/10 to-accent/10 rounded-full p-4 mb-3">
                      <Gift size={32} className="text-primary" />
                    </div>
                    <h2 className="text-2xl font-bold dark:text-slate-100 mb-2">Gift Receipt</h2>
                    <p className="text-sm text-muted-foreground">Voucher #{selectedVoucher.id.slice(0, 8)}</p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-700">
                      <span className="text-muted-foreground">Amount You Receive</span>
                      <span className="font-semibold text-lg">{formatVoucherAmount(selectedVoucher)}</span>
                    </div>

                    <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-700">
                      <span className="text-muted-foreground">Voucher Code</span>
                      <span className="font-mono font-bold text-lg text-primary bg-primary/5 px-3 py-1 rounded-lg">{selectedVoucher.code}</span>
                    </div>

                    <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-700">
                      <span className="text-muted-foreground">Status</span>
                      <Badge className={selectedVoucher.status === 'redeemed' || selectedVoucher.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                        {selectedVoucher.status}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-700">
                      <span className="text-muted-foreground">Received</span>
                      <span className="text-sm font-medium">{formatDate(selectedVoucher.createdAt)}</span>
                    </div>

                    {selectedVoucher.message && (
                      <div className="py-3 border-b border-slate-100 dark:border-slate-700">
                        <p className="text-muted-foreground mb-2">Message</p>
                        <p className="italic text-foreground">&quot;{selectedVoucher.message}&quot;</p>
                      </div>
                    )}

                    <div className="pt-4">
                      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 rounded-xl p-4">
                        <p className="text-sm text-blue-900">
                          <span className="font-semibold">💡 Tip:</span> Save your voucher code in a safe place. You&apos;ll need it when redeeming your credits.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-6 border-t border-slate-200/50 dark:border-slate-700/50 space-y-3">
                    {selectedVoucher.status === 'delivered' ? (
                      <>
                        <Button 
                          onClick={() => handleRedeemVoucher(selectedVoucher)}
                          className="w-full h-12 rounded-2xl bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
                        >
                          💰 Redeem to Balance
                        </Button>
                        <p className="text-xs text-center text-muted-foreground">
                          Adds {formatVoucherAmount(selectedVoucher)} to your available credits
                        </p>
                      </>
                    ) : selectedVoucher.status === 'redeemed' || selectedVoucher.status === 'paid' ? (
                      <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 rounded-xl p-4 text-center">
                        <p className="text-sm text-green-900">
                          ✓ This voucher has been redeemed to your balance
                        </p>
                      </div>
                    ) : (
                      <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 rounded-xl p-4 text-center">
                        <p className="text-sm text-slate-600">
                          This voucher is being processed
                        </p>
                      </div>
                    )}
                    <Button 
                      onClick={() => handleShareReceipt(selectedVoucher)}
                      variant="outline" 
                      className="w-full h-12 rounded-2xl"
                    >
                      📤 Share Receipt
                    </Button>
                  </div>
                </div>
              </div>
            ) : vouchersTab === 'custom' ? (
              // Custom Vouchers List View
              <>
                {vouchers.length === 0 ? (
                  <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-8 text-center border border-slate-200/50 dark:border-slate-700/50">
                    <Gift size={32} className="mx-auto text-muted-foreground/30 mb-3" />
                    <p className="text-muted-foreground text-sm">No custom gifts received yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {vouchers.map((voucher) => (
                      <button
                        key={voucher.id}
                        onClick={() => setSelectedVoucher(voucher)}
                        className="w-full bg-slate-50 dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 dark:bg-slate-900/50 dark:border-slate-700/50 hover:border-primary hover:shadow-md transition text-left"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <div className="font-bold text-lg">{formatVoucherAmount(voucher)}</div>
                              <Badge className={voucher.status === 'redeemed' || voucher.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                                {voucher.status}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground font-mono mb-1">Code: {voucher.code}</p>
                            {voucher.message && (
                              <p className="text-sm text-muted-foreground italic line-clamp-1">&quot;{voucher.message}&quot;</p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">{formatDate(voucher.createdAt)}</p>
                          </div>
                          <ChevronRight size={20} className="text-muted-foreground flex-shrink-0 ml-2" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : selectedTinyGiftIcon ? (
              // Tiny gifts list for selected icon
              <div className="space-y-4">
                <button
                  onClick={() => setSelectedTinyGiftIcon(null)}
                  className="text-sm text-primary flex items-center gap-1 hover:underline"
                >
                  ← Back to icons
                </button>
                <div className="space-y-3">
                  {tinyGifts.filter(tg => tg.iconId === selectedTinyGiftIcon).map((tinyGift) => (
                    <div
                      key={tinyGift.id}
                      className="w-full bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 dark:bg-slate-800/50 dark:border-slate-700/50 flex items-center justify-between"
                    >
                      <div className="flex-1">
                        <p className="font-semibold text-sm">{tinyGift.iconName}</p>
                        <p className="text-xs text-muted-foreground">${(tinyGift.amount / 100).toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground mt-1">from {tinyGift.senderName || 'Someone'}</p>
                      </div>
                      <Badge className={tinyGift.status === 'redeemed' || tinyGift.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                        {tinyGift.status}
                      </Badge>
                    </div>
                  ))}
                </div>
                <Button
                  onClick={() => {
                    const unredeemed = tinyGifts.filter(tg => tg.iconId === selectedTinyGiftIcon && (tg.status === 'delivered' || tg.status === 'pending'))
                    if (unredeemed.length > 0) {
                      toast.success(`Redeemed ${unredeemed.length} tiny gifts!`)
                    }
                  }}
                  className="w-full h-12 rounded-2xl bg-gradient-to-r from-green-500 to-green-600"
                >
                  Redeem All for This Icon
                </Button>
              </div>
            ) : (
              // Tiny gifts grouped by icon
              <>
                {tinyGifts.length === 0 ? (
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-8 text-center border border-slate-200/50 dark:border-slate-700/50">
                    <Gift size={32} className="mx-auto text-muted-foreground/30 mb-3" />
                    <p className="text-muted-foreground text-sm">No tiny gifts received yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {Array.from(
                      new Map(
                        tinyGifts.map((tg) => [
                          tg.iconId,
                          {
                            iconId: tg.iconId,
                            iconName: tg.iconName,
                            lottieUrl: tg.lottieUrl,
                            total: tinyGifts
                              .filter((x) => x.iconId === tg.iconId)
                              .reduce((sum, x) => sum + x.amount, 0),
                            count: tinyGifts.filter((x) => x.iconId === tg.iconId).length,
                            unredeemed: tinyGifts.filter(
                              (x) => x.iconId === tg.iconId && (x.status === 'delivered' || x.status === 'pending')
                            ).length,
                          },
                        ])
                      ).values()
                    ).map((group) => (
                      <button
                        key={group.iconId}
                        onClick={() => setSelectedTinyGiftIcon(group.iconId)}
                        className="w-full bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 dark:bg-slate-800/50 dark:border-slate-700/50 hover:border-primary hover:shadow-md transition text-left"
                      >
                        <div className="flex items-center gap-4">
                          {/* Icon on the left */}
                          <div className="w-16 h-16 flex-shrink-0 flex items-center justify-center bg-primary/5 rounded-lg">
                            <span className="text-2xl">💝</span>
                          </div>

                          {/* Middle: icon info */}
                          <div className="flex-1 text-left">
                            <p className="font-semibold text-sm">{group.iconName}</p>
                            <p className="text-xs text-muted-foreground">${(group.total / 100).toFixed(2)} total</p>
                            <p className="text-xs text-muted-foreground">{group.count} gifts</p>
                          </div>

                          {/* Right: redeem button */}
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-shrink-0 rounded-lg text-xs h-10"
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedTinyGiftIcon(group.iconId)
                            }}
                          >
                            {group.unredeemed} Redeem
                          </Button>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'gift' && (
          <div className="space-y-4 animate-in fade-in">
            <div>
              <h1 className="text-2xl font-bold dark:text-slate-100 mb-1">Send a Gift</h1>
              <p className="text-sm text-muted-foreground dark:text-slate-400">Load funds or share your balance</p>
            </div>

            {/* Tabs for Preload vs Gift */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => {
                  setPreloadPaymentMethod(null)
                  setBillingInfo(null)
                  setPreloadForm({ amount: '' })
                }}
                className={`px-4 py-2 rounded-full font-medium transition ${
                  !giftPaymentMethod
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-white dark:bg-slate-800 text-muted-foreground dark:text-slate-100 border border-slate-200/50 dark:border-slate-700/50'
                }`}
              >
                Load Funds
              </button>
              <button
                onClick={() => {
                  setGiftPaymentMethod(null)
                  setGiftForm({ recipientPhone: '', recipientCountry: 'ZA', amount: '', message: '' })
                }}
                className={`px-4 py-2 rounded-full font-medium transition ${
                  giftPaymentMethod
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-white dark:bg-slate-800 text-muted-foreground dark:text-slate-100 border border-slate-200/50 dark:border-slate-700/50'
                }`}
              >
                Send Gift
              </button>
            </div>

            {/* PRELOAD FLOW */}
            {!giftPaymentMethod && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/50 space-y-4">
                <div className="rounded-2xl bg-gradient-to-r from-primary/10 to-accent/10 p-4 border border-primary/20">
                  <p className="text-sm font-medium text-foreground mb-2">💳 Preload Your Wallet</p>
                  <p className="text-xs text-muted-foreground">Add funds to your account. You can immediately start showing love with your preloaded balance.</p>
                </div>

                {billingInfo ? (
                  // BILLING DETAILS VIEW
                  <div className="space-y-4">
                    <button
                      type="button"
                      onClick={() => {
                        setBillingInfo(null)
                        setPreloadForm({ amount: '' })
                        setPreloadPaymentMethod(null)
                      }}
                      className="text-sm text-primary flex items-center gap-1 hover:underline"
                    >
                      ← Edit amount
                    </button>

                    <div className="rounded-2xl bg-slate-50 dark:bg-slate-900 p-4 space-y-3 border border-slate-200">
                      <h3 className="font-semibold text-sm">Order Summary</h3>
                      
                      <div className="flex items-center justify-between py-2 border-b border-slate-200">
                        <span className="text-sm text-muted-foreground">Amount to Load</span>
                        <span className="font-semibold">${billingInfo.baseAmount.toFixed(2)}</span>
                      </div>

                      <div className="flex items-center justify-between py-2 border-b border-slate-200">
                        <span className="text-sm text-muted-foreground">Processing Fee (5%)</span>
                        <span className="font-semibold text-amber-600">${billingInfo.processingFee.toFixed(2)}</span>
                      </div>

                      <div className="flex items-center justify-between py-3 bg-white dark:bg-slate-900 dark:text-slate-100 rounded-lg px-3 border border-slate-200">
                        <span className="text-sm font-bold">Total to Pay</span>
                        <span className="text-lg font-bold text-primary">${billingInfo.totalAmount.toFixed(2)} USD</span>
                      </div>
                    </div>

                    <Button 
                      onClick={async () => {
                        setPreloadLoading(true)
                        setTimeout(() => {
                          // The redirect happens in the handlePreloadInitiate
                          // This ensures the button state is updated
                        }, 100)
                      }}
                      disabled={preloadLoading}
                      className="w-full h-12 rounded-2xl bg-gradient-to-r from-primary to-primary/80"
                    >
                      {preloadLoading ? 'Redirecting...' : 'Proceed to Payment'}
                    </Button>

                    <p className="text-xs text-center text-muted-foreground">
                      🔒 Secure payment via Paystack Gateway
                    </p>
                  </div>
                ) : (
                  // AMOUNT INPUT VIEW
                  <form onSubmit={handlePreloadInitiate} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="preloadAmount" className="text-sm font-medium dark:text-slate-100">Amount (USD)</Label>
                      <div className="relative">
                        <span className="absolute left-4 top-3 text-muted-foreground">$</span>
                        <Input
                          id="preloadAmount"
                          type="number"
                          placeholder="0.00"
                          value={preloadForm.amount}
                          onChange={(e) => {
                            setPreloadForm({ amount: e.target.value })
                          }}
                          className="rounded-2xl border-slate-200/50 dark:border-slate-700/50 pl-8"
                          step="0.01"
                          min="1"
                          max="10000"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">Minimum: $1 | Maximum: $10,000</p>
                    </div>

                    <Button 
                      type="submit" 
                      disabled={preloadLoading || !preloadForm.amount}
                      className="w-full h-12 rounded-2xl bg-gradient-to-r from-primary to-primary/80"
                    >
                      {preloadLoading ? 'Loading...' : 'Review Order'}
                    </Button>
                  </form>
                )}
              </div>
            )}

            {/* GIFT SENDING FLOW */}
            {giftPaymentMethod && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 dark:bg-slate-800/50 dark:border-slate-700/50">
                <form onSubmit={handleSendGift} className="space-y-4">
                  <button
                    type="button"
                    onClick={() => setGiftPaymentMethod(null)}
                    className="text-sm text-primary flex items-center gap-1 mb-2 hover:underline"
                  >
                    ← Back to payment methods
                  </button>

                  <div className="rounded-2xl bg-slate-50 dark:bg-slate-800 p-3 border border-slate-200">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Sending from</p>
                    <p className="text-sm font-semibold">{giftPaymentMethod === 'sender-balance' ? 'Preloaded Balance' : giftPaymentMethod === 'available-credits' ? 'Redeemed Credits' : 'Card Payment'}</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="recipientPhone" className="text-sm font-medium dark:text-slate-100">Recipient Phone or Handle</Label>
                    <Input
                      id="recipientPhone"
                      type="text"
                      placeholder="Phone number or @handle"
                      value={giftForm.recipientPhone}
                      onChange={(e) =>
                        setGiftForm({ ...giftForm, recipientPhone: e.target.value })
                      }
                      className="rounded-2xl border-slate-200/50 dark:border-slate-700/50"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="giftAmount" className="text-sm font-medium dark:text-slate-100">Amount</Label>
                    <Input
                      id="giftAmount"
                      type="number"
                      placeholder="Enter amount"
                      value={giftForm.amount}
                      onChange={(e) =>
                        setGiftForm({ ...giftForm, amount: e.target.value })
                      }
                      className="rounded-2xl border-slate-200/50 dark:border-slate-700/50"
                      step="0.01"
                      min="0"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="giftMessage" className="text-sm font-medium dark:text-slate-100">Message (Optional)</Label>
                    <Input
                      id="giftMessage"
                      type="text"
                      placeholder="Add a message to your gift"
                      value={giftForm.message}
                      onChange={(e) =>
                        setGiftForm({ ...giftForm, message: e.target.value })
                      }
                      className="rounded-2xl border-slate-200/50 dark:border-slate-700/50"
                    />
                  </div>

                  <Button 
                    type="submit" 
                    disabled={giftLoading}
                    className="w-full h-12 rounded-2xl bg-gradient-to-r from-primary to-primary/80"
                  >
                    {giftLoading ? 'Sending...' : '💝 Send Gift'}
                  </Button>
                </form>
              </div>
            )}

            {/* METHOD SELECTION (shown when neither tab is active) */}
            {!giftPaymentMethod && !billingInfo && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 dark:bg-slate-800/50 dark:border-slate-700/50">
                <div className="space-y-3 mb-6">
                  <p className="text-sm font-semibold text-foreground">Choose Payment Method</p>
                  
                  {((user?.senderBalance || 0) > 0) && (
                    <button
                      onClick={() => setGiftPaymentMethod('sender-balance')}
                      className={`w-full p-4 border-2 rounded-2xl transition text-left ${
                        giftPaymentMethod === 'sender-balance'
                          ? 'border-primary bg-primary/5'
                          : 'border-slate-200/50 dark:border-slate-700/50 hover:border-primary'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-sm">Preloaded Balance</p>
                          <p className="text-lg font-bold text-primary">${((user?.senderBalance || 0) / 100).toFixed(2)}</p>
                        </div>
                        {giftPaymentMethod === 'sender-balance' && (
                          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                            <span className="text-white text-sm">✓</span>
                          </div>
                        )}
                      </div>
                    </button>
                  )}

                  {(wallet?.availableCredits || 0) > 0 && (
                    <button
                      onClick={() => setGiftPaymentMethod('available-credits')}
                      className={`w-full p-4 border-2 rounded-2xl transition text-left ${
                        giftPaymentMethod === 'available-credits'
                          ? 'border-primary bg-primary/5'
                          : 'border-slate-200/50 dark:border-slate-700/50 hover:border-primary'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-sm">Redeemed Credits</p>
                          <p className="text-lg font-bold text-primary">{formatCurrency(wallet?.availableCredits || 0)}</p>
                        </div>
                        {giftPaymentMethod === 'available-credits' && (
                          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                            <span className="text-white text-sm">✓</span>
                          </div>
                        )}
                      </div>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'redeem' && (
          <div className="space-y-4 animate-in fade-in">
            <div>
              <h1 className="text-2xl font-bold dark:text-slate-100 mb-1">Redeem Credits</h1>
              <p className="text-sm text-muted-foreground dark:text-slate-400">Choose your withdrawal method</p>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 dark:bg-slate-800/50 dark:border-slate-700/50">
              <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 mb-6">
                <p className="text-xs text-muted-foreground">Available Balance</p>
                <p className="text-2xl font-bold">{formatCurrency(wallet?.availableCredits || 0)}</p>
              </div>

              {!paymentMethod ? (
                <div className="space-y-3">
                    <p className="text-sm font-semibold text-foreground dark:text-slate-100">Select Redemption Method</p>
                  <button
                    onClick={() => setPaymentMethod('eft')}
                    className="w-full p-4 border-2 border-slate-200/50 dark:border-slate-700/50 rounded-2xl hover:border-primary hover:bg-primary/5 transition text-left"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-sm">EFT (Electronic Funds Transfer)</p>
                        <p className="text-xs text-muted-foreground">Direct to your bank account</p>
                      </div>
                      <ChevronRight size={20} className="text-muted-foreground" />
                    </div>
                  </button>

                  <button
                    disabled
                    className="w-full p-4 border-2 border-slate-200/50 dark:border-slate-700/50 rounded-2xl bg-slate-50 dark:bg-slate-800/50 opacity-50 cursor-not-allowed text-left"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-sm text-slate-500">Mobile Wallet</p>
                        <p className="text-xs text-muted-foreground">Coming soon</p>
                      </div>
                      <div className="text-xs bg-slate-200 text-slate-600 px-2 py-1 rounded-lg">Soon</div>
                    </div>
                  </button>
                </div>
              ) : (
                <form onSubmit={handleRedeemCredits} className="space-y-4">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod(null)}
                    className="text-sm text-primary flex items-center gap-1 mb-2 hover:underline"
                  >
                    ← Back to methods
                  </button>

                  <div className="bg-primary/5 border border-slate-200/50 dark:border-slate-700/50 rounded-2xl p-3 mb-4">
                    <p className="text-sm font-semibold text-foreground">
                      {paymentMethod === 'eft' && 'EFT (Electronic Funds Transfer)'}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="amount" className="text-sm font-medium dark:text-slate-100">Amount (ZAR)</Label>
                    <Input
                      id="amount"
                      type="number"
                      placeholder={formatCurrency(wallet?.availableCredits || 0)}
                      value={redeemForm.amount}
                      onChange={(e) =>
                        setRedeemForm({ ...redeemForm, amount: e.target.value })
                      }
                      className="rounded-2xl border-slate-200/50 dark:border-slate-700/50"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bankCode" className="text-sm font-medium dark:text-slate-100">Bank Name</Label>
                    <select
                      id="bankCode"
                      className="w-full px-3 py-2 border border-slate-200/50 dark:border-slate-700/50 rounded-2xl text-sm"
                      value={redeemForm.bankCode}
                      onChange={(e) =>
                        setRedeemForm({ ...redeemForm, bankCode: e.target.value })
                      }
                    >
                      <option value="">Select a bank</option>
                      {SA_BANKS.map((bank) => (
                        <option key={bank.code} value={bank.code}>
                          {bank.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="accountNumber" className="text-sm font-medium dark:text-slate-100">Account Number</Label>
                    <Input
                      id="accountNumber"
                      type="text"
                      placeholder="Enter your account number"
                      value={redeemForm.accountNumber}
                      onChange={(e) =>
                        setRedeemForm({ ...redeemForm, accountNumber: e.target.value })
                      }
                      className="rounded-2xl border-slate-200/50 dark:border-slate-700/50"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="accountName" className="text-sm font-medium dark:text-slate-100">Account Name</Label>
                    <Input
                      id="accountName"
                      type="text"
                      placeholder="Account holder name"
                      value={redeemForm.accountName}
                      onChange={(e) =>
                        setRedeemForm({ ...redeemForm, accountName: e.target.value })
                      }
                      className="rounded-2xl border-slate-200/50 dark:border-slate-700/50"
                    />
                  </div>

                  <Button type="submit" className="w-full h-12 rounded-2xl">
                    Request Redemption
                  </Button>
                </form>
              )}
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-4 animate-in fade-in">
            <div>
              <h1 className="text-2xl font-bold dark:text-slate-100 mb-1">Redemption History</h1>
              <p className="text-sm text-muted-foreground dark:text-slate-400">Track your withdrawals</p>
            </div>

            {selectedRedemption ? (
              // Redemption Receipt View
              <div className="space-y-4">
                <button
                  onClick={() => setSelectedRedemption(null)}
                  className="text-sm text-primary flex items-center gap-1 hover:underline"
                >
                  ← Back to history
                </button>

                <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/50">
                  <div className="text-center mb-6 pb-6 border-b border-slate-200/50 dark:border-slate-700/50">
                    <div className="inline-block bg-gradient-to-br from-primary/10 to-accent/10 rounded-full p-4 mb-3">
                      <WalletIcon size={32} className="text-primary" />
                    </div>
                    <h2 className="text-2xl font-bold mb-2">Withdrawal Receipt</h2>
                    <p className="text-sm text-muted-foreground">Redemption #{selectedRedemption.id.slice(0, 8)}</p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-700">
                      <span className="text-muted-foreground">Amount</span>
                      <span className="font-semibold text-lg">{formatCurrency(selectedRedemption.amount)}</span>
                    </div>

                    <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-700">
                      <span className="text-muted-foreground">Method</span>
                      <span className="font-medium capitalize">{selectedRedemption.method.replace('_', ' ')}</span>
                    </div>

                    <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-700">
                      <span className="text-muted-foreground">Status</span>
                      <Badge className={
                        selectedRedemption.status === 'paid' ? 'bg-green-100 text-green-800' :
                        selectedRedemption.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                        selectedRedemption.status === 'redemption_requested' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }>
                        {selectedRedemption.status.replace('_', ' ')}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-700">
                      <span className="text-muted-foreground">Requested</span>
                      <span className="text-sm font-medium">{formatDate(selectedRedemption.createdAt)}</span>
                    </div>

                    {selectedRedemption.status === 'paid' && (
                      <div className="py-3 border-b border-slate-100 dark:border-slate-700">
                        <span className="text-muted-foreground">Completed</span>
                        <p className="text-sm font-medium mt-1">{formatDate(selectedRedemption.updatedAt)}</p>
                      </div>
                    )}

                    <div className="pt-4">
                      <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 rounded-xl p-4">
                        <p className="text-sm text-green-900">
                          <span className="font-semibold">✓ Received:</span> The funds have been transferred to your {selectedRedemption.method.replace('_', ' ')} account.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-6 border-t border-slate-200/50 dark:border-slate-700/50">
                    <Button 
                      onClick={() => handleShareReceipt(selectedRedemption as any)}
                      className="w-full h-12 rounded-2xl"
                    >
                      📤 Share Receipt
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              // List View
              <>
                {redemptions.length === 0 ? (
                  <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 text-center border border-slate-200/50 dark:border-slate-700/50">
                    <History size={32} className="mx-auto text-muted-foreground/30 mb-3" />
                    <p className="text-muted-foreground text-sm">No redemptions yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {redemptions.map((redemption) => (
                      <button
                        key={redemption.id}
                        onClick={() => setSelectedRedemption(redemption)}
                        className="w-full bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 dark:bg-slate-800/50 dark:border-slate-700/50 hover:border-primary hover:shadow-md transition text-left"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <div className="font-bold text-lg">{formatCurrency(redemption.amount)}</div>
                              <Badge className={
                                redemption.status === 'paid' ? 'bg-green-100 text-green-800' :
                                redemption.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                                redemption.status === 'redemption_requested' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }>
                                {redemption.status.replace('_', ' ')}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mb-1">{redemption.method.replace('_', ' ').toUpperCase()}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(redemption.createdAt)}</p>
                          </div>
                          <ChevronRight size={20} className="text-muted-foreground flex-shrink-0 ml-2" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200/50 dark:border-slate-700/50 z-20">
        <div className="flex items-center justify-around max-w-2xl mx-auto px-4">
          <button
            onClick={() => setActiveTab('home')}
            className={`flex-1 py-3 flex flex-col items-center gap-1 transition rounded-xl mx-1 ${
              activeTab === 'home'
                ? 'bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400'
                : 'text-muted-foreground dark:text-slate-400'
            }`}
          >
            <Home size={24} />
            <span className="text-xs font-medium dark:text-slate-400">Home</span>
          </button>
          <button
            onClick={() => setActiveTab('vouchers')}
            className={`flex-1 py-3 flex flex-col items-center gap-1 transition rounded-xl mx-1 ${
              activeTab === 'vouchers'
                ? 'bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400'
                : 'text-muted-foreground dark:text-slate-400'
            }`}
          >
            <Gift size={24} />
            <span className="text-xs font-medium dark:text-slate-400">Vouchers</span>
          </button>
          <button
            onClick={() => setActiveTab('redeem')}
            className={`flex-1 py-3 flex flex-col items-center gap-1 transition rounded-xl mx-1 ${
              activeTab === 'redeem'
                ? 'bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400'
                : 'text-muted-foreground dark:text-slate-400'
            }`}
          >
            <WalletIcon size={24} />
            <span className="text-xs font-medium dark:text-slate-400">Redeem</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-3 flex flex-col items-center gap-1 transition rounded-xl mx-1 ${
              activeTab === 'history'
                ? 'bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400'
                : 'text-muted-foreground dark:text-slate-400'
            }`}
          >
            <History size={24} />
            <span className="text-xs font-medium dark:text-slate-400">History</span>
          </button>
          <button
            onClick={() => router.push('/app/sender')}
            className="flex-1 py-3 flex flex-col items-center gap-1 transition text-muted-foreground dark:text-slate-400 hover:text-primary"
            title="Switch to Sender"
          >
            <ArrowRightLeft size={28} />
          </button>
        </div>
      </nav>
    </div>
  )
}







