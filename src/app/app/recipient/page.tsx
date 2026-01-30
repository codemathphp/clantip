'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { auth, db } from '@/firebase/config'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, query, where, getDocs, doc, getDoc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore'
import { User, Voucher, Wallet, Redemption } from '@/types'
import { formatCurrency, SA_BANKS, SUPPORTED_COUNTRIES } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NotificationCenter } from '@/components/NotificationCenter'
import toast from 'react-hot-toast'
import Image from 'next/image'
import { Menu, X, Home, Gift, History, Settings, LogOut, ChevronRight, Wallet as WalletIcon } from 'lucide-react'

export default function RecipientDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [redemptions, setRedemptions] = useState<Redemption[]>([])
  const [loading, setLoading] = useState(true)
  const [showDrawer, setShowDrawer] = useState(false)
  const [activeTab, setActiveTab] = useState<'home' | 'vouchers' | 'gift' | 'redeem' | 'history'>('home')
  const [balanceTab, setBalanceTab] = useState<'available' | 'pending' | 'received'>('received')
  const [paymentMethod, setPaymentMethod] = useState<'eft' | 'mobile_wallet' | null>(null)
  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null)
  const [selectedRedemption, setSelectedRedemption] = useState<Redemption | null>(null)
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
        // Get phone from auth user
        const phone = authUser.phoneNumber
        if (!phone) {
          console.error('No phone number in auth user')
          setLoading(false)
          return
        }

        // Lookup user by phone (document ID)
        const userRef = doc(db, 'users', phone)
        const userSnap = await getDoc(userRef)
        if (userSnap.exists()) {
          setUser(userSnap.data() as User)

          // Lookup wallet by phone
          const walletRef = doc(db, 'wallets', phone)
          const walletSnap = await getDoc(walletRef)
          if (walletSnap.exists()) {
            setWallet(walletSnap.data() as Wallet)
          }

          // Set up REAL-TIME listener for vouchers so new gifts appear immediately
          const vouchersQuery = query(
            collection(db, 'vouchers'),
            where('recipientId', '==', phone)
          )
          unsubscribeVouchers = onSnapshot(vouchersQuery, (snapshot) => {
            const vouchersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Voucher))
            setVouchers(vouchersList)
            console.log(`🔔 [Recipient] Updated ${vouchersList.length} vouchers in real-time`)
          })

          const redemptionsQuery = query(
            collection(db, 'redemptions'),
            where('userId', '==', authUser.uid)
          )
          const redemptionsSnap = await getDocs(redemptionsQuery)
          setRedemptions(
            redemptionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Redemption))
          )

          setLoading(false)
        } else {
          setLoading(false)
        }
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

        const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: userEmail,
            amount: amountCents,
            reference: reference,
            metadata: {
              type: 'gift',
              senderPhone: user?.phone,
              recipientPhone: giftForm.recipientPhone.replace(/\D/g, ''),
              message: giftForm.message,
            },
          }),
        })

        const paystackData = await paystackRes.json()
        if (!paystackData.status) {
          throw new Error(paystackData.message || 'Failed to initialize payment')
        }

        // Store gift info in sessionStorage for callback
        sessionStorage.setItem(
          'pendingGift',
          JSON.stringify({
            amount: baseAmount,
            amountCents: amountCents,
            recipientPhone: giftForm.recipientPhone.replace(/\D/g, ''),
            message: giftForm.message,
            reference: paystackData.data.reference,
            timestamp: Date.now(),
          })
        )

        // Redirect to Paystack
        window.location.href = paystackData.data.authorization_url
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">

      <main className="max-w-2xl mx-auto px-4 pb-24 pt-4">
        {activeTab === 'home' && (
          <div className="space-y-4 animate-in fade-in">
            <div className="mb-6">
              <h1 className="text-2xl font-bold">Hi, {user?.fullName}! 👋</h1>
              <p className="text-sm text-muted-foreground">Manage your received credits</p>
            </div>

            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
              <button
                onClick={() => setBalanceTab('received')}
                className={`px-4 py-2 rounded-full whitespace-nowrap font-medium transition ${
                  balanceTab === 'received'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-white text-muted-foreground border border-slate-200/50'
                }`}
              >
                Received
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
                onClick={() => setBalanceTab('available')}
                className={`px-4 py-2 rounded-full whitespace-nowrap font-medium transition ${
                  balanceTab === 'available'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-white text-muted-foreground border border-slate-200/50'
                }`}
              >
                Available
              </button>
            </div>

            <div className="rounded-2xl bg-gradient-to-br from-green-500/10 to-green-500/5 p-6 text-center border border-slate-200/50">
              {balanceTab === 'received' && (
                <>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Total Received</p>
                  <div className="text-4xl font-bold mb-2">{formatCurrency(vouchers.reduce((sum, v) => sum + v.amount, 0))}</div>
                  <p className="text-sm text-muted-foreground">{vouchers.length} vouchers</p>
                </>
              )}
              {balanceTab === 'pending' && (
                <>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Pending Credits</p>
                  <div className="text-4xl font-bold mb-2">{formatCurrency(wallet?.pendingCredits || 0)}</div>
                  <p className="text-sm text-muted-foreground">Being processed</p>
                </>
              )}
              {balanceTab === 'available' && (
                <>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Available to Redeem</p>
                  <div className="text-4xl font-bold mb-2">{formatCurrency(wallet?.availableCredits || 0)}</div>
                  <p className="text-sm text-muted-foreground">Ready for withdrawal</p>
                </>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 mt-6">
              <Button
                onClick={() => setActiveTab('vouchers')}
                className="bg-gradient-to-r from-primary to-primary/80 h-14 text-base"
              >
                <Gift className="mr-2" size={20} />
                View Gifts
              </Button>
              {((user?.senderBalance || 0) > 0 || (wallet?.availableCredits || 0) > 0) ? (
                <Button
                  onClick={() => setActiveTab('gift')}
                  variant="outline"
                  className="h-14 text-base"
                >
                  💝 Send Gift
                </Button>
              ) : (
                <Button
                  onClick={() => setActiveTab('redeem')}
                  variant="outline"
                  className="h-14 text-base"
                >
                  <WalletIcon className="mr-2" size={20} />
                  Redeem
                </Button>
              )}
            </div>

            <div className="mt-8">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-sm">Recent Vouchers</h2>
                <button
                  onClick={() => setActiveTab('vouchers')}
                  className="text-primary text-xs font-medium flex items-center gap-1"
                >
                  View all <ChevronRight size={14} />
                </button>
              </div>
              
              {vouchers.length === 0 ? (
                <div className="text-center py-8 bg-white rounded-2xl border border-slate-200/50">
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
                      className="w-full bg-white rounded-lg p-3 flex items-center justify-between hover:shadow-md transition border border-slate-100 text-left"
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
              <h1 className="text-2xl font-bold mb-1">My Vouchers</h1>
              <p className="text-sm text-muted-foreground">All vouchers received</p>
            </div>

            {selectedVoucher ? (
              // Receipt View
              <div className="space-y-4">
                <button
                  onClick={() => setSelectedVoucher(null)}
                  className="text-sm text-primary flex items-center gap-1 hover:underline"
                >
                  ← Back to vouchers
                </button>

                <div className="bg-white rounded-2xl p-6 border border-slate-200/50">
                  <div className="text-center mb-6 pb-6 border-b border-slate-200/50">
                    <div className="inline-block bg-gradient-to-br from-primary/10 to-accent/10 rounded-full p-4 mb-3">
                      <Gift size={32} className="text-primary" />
                    </div>
                    <h2 className="text-2xl font-bold mb-2">Gift Receipt</h2>
                    <p className="text-sm text-muted-foreground">Voucher #{selectedVoucher.id.slice(0, 8)}</p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between py-3 border-b border-slate-100">
                      <span className="text-muted-foreground">Amount You Receive</span>
                      <span className="font-semibold text-lg">{formatVoucherAmount(selectedVoucher)}</span>
                    </div>

                    <div className="flex items-center justify-between py-3 border-b border-slate-100">
                      <span className="text-muted-foreground">Voucher Code</span>
                      <span className="font-mono font-bold text-lg text-primary bg-primary/5 px-3 py-1 rounded-lg">{selectedVoucher.code}</span>
                    </div>

                    <div className="flex items-center justify-between py-3 border-b border-slate-100">
                      <span className="text-muted-foreground">Status</span>
                      <Badge className={selectedVoucher.status === 'redeemed' || selectedVoucher.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                        {selectedVoucher.status}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between py-3 border-b border-slate-100">
                      <span className="text-muted-foreground">Received</span>
                      <span className="text-sm font-medium">{formatDate(selectedVoucher.createdAt)}</span>
                    </div>

                    {selectedVoucher.message && (
                      <div className="py-3 border-b border-slate-100">
                        <p className="text-muted-foreground mb-2">Message</p>
                        <p className="italic text-foreground">&quot;{selectedVoucher.message}&quot;</p>
                      </div>
                    )}

                    <div className="pt-4">
                      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                        <p className="text-sm text-blue-900">
                          <span className="font-semibold">💡 Tip:</span> Save your voucher code in a safe place. You&apos;ll need it when redeeming your credits.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-6 border-t border-slate-200/50 space-y-3">
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
                      <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                        <p className="text-sm text-green-900">
                          ✓ This voucher has been redeemed to your balance
                        </p>
                      </div>
                    ) : (
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
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
            ) : (
              // List View
              <>
                {vouchers.length === 0 ? (
                  <div className="bg-white rounded-2xl p-8 text-center border border-slate-200/50">
                    <Gift size={32} className="mx-auto text-muted-foreground/30 mb-3" />
                    <p className="text-muted-foreground text-sm">No vouchers received yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {vouchers.map((voucher) => (
                      <button
                        key={voucher.id}
                        onClick={() => setSelectedVoucher(voucher)}
                        className="w-full bg-white rounded-2xl p-4 border border-slate-200/50 hover:border-primary hover:shadow-md transition text-left"
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
            )}
          </div>
        )}

        {activeTab === 'gift' && (
          <div className="space-y-4 animate-in fade-in">
            <div>
              <h1 className="text-2xl font-bold mb-1">Send a Gift</h1>
              <p className="text-sm text-muted-foreground">Share your balance or pay with card</p>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-slate-200/50">
              <div className="space-y-3 mb-6">
                <p className="text-sm font-semibold text-foreground">Choose Payment Method</p>
                
                {((user?.senderBalance || 0) > 0) && (
                  <button
                    onClick={() => setGiftPaymentMethod('sender-balance')}
                    className={`w-full p-4 border-2 rounded-2xl transition text-left ${
                      giftPaymentMethod === 'sender-balance'
                        ? 'border-primary bg-primary/5'
                        : 'border-slate-200/50 hover:border-primary'
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
                        : 'border-slate-200/50 hover:border-primary'
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

                <button
                  onClick={() => setGiftPaymentMethod('checkout')}
                  className={`w-full p-4 border-2 rounded-2xl transition text-left ${
                    giftPaymentMethod === 'checkout'
                      ? 'border-primary bg-primary/5'
                      : 'border-slate-200/50 hover:border-primary'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm">Pay with Card</p>
                      <p className="text-xs text-muted-foreground">Debit/Credit Card via Paystack</p>
                    </div>
                    {giftPaymentMethod === 'checkout' && (
                      <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                        <span className="text-white text-sm">✓</span>
                      </div>
                    )}
                  </div>
                </button>
              </div>

              {giftPaymentMethod && (
                <form onSubmit={handleSendGift} className="space-y-4">
                  <button
                    type="button"
                    onClick={() => setGiftPaymentMethod(null)}
                    className="text-sm text-primary flex items-center gap-1 mb-2 hover:underline"
                  >
                    ← Change payment method
                  </button>

                  <div className="space-y-2">
                    <Label htmlFor="recipientPhone" className="text-sm font-medium">Recipient Phone or Handle</Label>
                    <Input
                      id="recipientPhone"
                      type="text"
                      placeholder="Phone number or @handle"
                      value={giftForm.recipientPhone}
                      onChange={(e) =>
                        setGiftForm({ ...giftForm, recipientPhone: e.target.value })
                      }
                      className="rounded-2xl border-slate-200/50"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="giftAmount" className="text-sm font-medium">Amount</Label>
                    <Input
                      id="giftAmount"
                      type="number"
                      placeholder="Enter amount"
                      value={giftForm.amount}
                      onChange={(e) =>
                        setGiftForm({ ...giftForm, amount: e.target.value })
                      }
                      className="rounded-2xl border-slate-200/50"
                      step="0.01"
                      min="0"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="giftMessage" className="text-sm font-medium">Message (Optional)</Label>
                    <Input
                      id="giftMessage"
                      type="text"
                      placeholder="Add a message to your gift"
                      value={giftForm.message}
                      onChange={(e) =>
                        setGiftForm({ ...giftForm, message: e.target.value })
                      }
                      className="rounded-2xl border-slate-200/50"
                    />
                  </div>

                  <Button 
                    type="submit" 
                    disabled={giftLoading}
                    className="w-full h-12 rounded-2xl bg-gradient-to-r from-primary to-primary/80"
                  >
                    {giftLoading ? 'Processing...' : '💝 Send Gift'}
                  </Button>
                </form>
              )}
            </div>
          </div>
        )}

        {activeTab === 'redeem' && (
          <div className="space-y-4 animate-in fade-in">
            <div>
              <h1 className="text-2xl font-bold mb-1">Redeem Credits</h1>
              <p className="text-sm text-muted-foreground">Choose your withdrawal method</p>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-slate-200/50">
              <div className="bg-slate-50 rounded-2xl p-4 mb-6">
                <p className="text-xs text-muted-foreground">Available Balance</p>
                <p className="text-2xl font-bold">{formatCurrency(wallet?.availableCredits || 0)}</p>
              </div>

              {!paymentMethod ? (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-foreground">Select Redemption Method</p>
                  
                  <button
                    onClick={() => setPaymentMethod('eft')}
                    className="w-full p-4 border-2 border-slate-200/50 rounded-2xl hover:border-primary hover:bg-primary/5 transition text-left"
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
                    className="w-full p-4 border-2 border-slate-200/50 rounded-2xl bg-slate-50/50 opacity-50 cursor-not-allowed text-left"
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

                  <div className="bg-primary/5 border border-slate-200/50 rounded-2xl p-3 mb-4">
                    <p className="text-sm font-semibold text-foreground">
                      {paymentMethod === 'eft' && 'EFT (Electronic Funds Transfer)'}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="amount" className="text-sm font-medium">Amount (ZAR)</Label>
                    <Input
                      id="amount"
                      type="number"
                      placeholder={formatCurrency(wallet?.availableCredits || 0)}
                      value={redeemForm.amount}
                      onChange={(e) =>
                        setRedeemForm({ ...redeemForm, amount: e.target.value })
                      }
                      className="rounded-2xl border-slate-200/50"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bankCode" className="text-sm font-medium">Bank Name</Label>
                    <select
                      id="bankCode"
                      className="w-full px-3 py-2 border border-slate-200/50 rounded-2xl text-sm"
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
                    <Label htmlFor="accountNumber" className="text-sm font-medium">Account Number</Label>
                    <Input
                      id="accountNumber"
                      type="text"
                      placeholder="Enter your account number"
                      value={redeemForm.accountNumber}
                      onChange={(e) =>
                        setRedeemForm({ ...redeemForm, accountNumber: e.target.value })
                      }
                      className="rounded-2xl border-slate-200/50"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="accountName" className="text-sm font-medium">Account Name</Label>
                    <Input
                      id="accountName"
                      type="text"
                      placeholder="Account holder name"
                      value={redeemForm.accountName}
                      onChange={(e) =>
                        setRedeemForm({ ...redeemForm, accountName: e.target.value })
                      }
                      className="rounded-2xl border-slate-200/50"
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
              <h1 className="text-2xl font-bold mb-1">Redemption History</h1>
              <p className="text-sm text-muted-foreground">Track your withdrawals</p>
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

                <div className="bg-white rounded-2xl p-6 border border-slate-200/50">
                  <div className="text-center mb-6 pb-6 border-b border-slate-200/50">
                    <div className="inline-block bg-gradient-to-br from-primary/10 to-accent/10 rounded-full p-4 mb-3">
                      <WalletIcon size={32} className="text-primary" />
                    </div>
                    <h2 className="text-2xl font-bold mb-2">Withdrawal Receipt</h2>
                    <p className="text-sm text-muted-foreground">Redemption #{selectedRedemption.id.slice(0, 8)}</p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between py-3 border-b border-slate-100">
                      <span className="text-muted-foreground">Amount</span>
                      <span className="font-semibold text-lg">{formatCurrency(selectedRedemption.amount)}</span>
                    </div>

                    <div className="flex items-center justify-between py-3 border-b border-slate-100">
                      <span className="text-muted-foreground">Method</span>
                      <span className="font-medium capitalize">{selectedRedemption.method.replace('_', ' ')}</span>
                    </div>

                    <div className="flex items-center justify-between py-3 border-b border-slate-100">
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

                    <div className="flex items-center justify-between py-3 border-b border-slate-100">
                      <span className="text-muted-foreground">Requested</span>
                      <span className="text-sm font-medium">{formatDate(selectedRedemption.createdAt)}</span>
                    </div>

                    {selectedRedemption.status === 'paid' && (
                      <div className="py-3 border-b border-slate-100">
                        <span className="text-muted-foreground">Completed</span>
                        <p className="text-sm font-medium mt-1">{formatDate(selectedRedemption.updatedAt)}</p>
                      </div>
                    )}

                    <div className="pt-4">
                      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                        <p className="text-sm text-green-900">
                          <span className="font-semibold">✓ Received:</span> The funds have been transferred to your {selectedRedemption.method.replace('_', ' ')} account.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-6 border-t border-slate-200/50">
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
                  <div className="bg-white rounded-2xl p-8 text-center border border-slate-200/50">
                    <History size={32} className="mx-auto text-muted-foreground/30 mb-3" />
                    <p className="text-muted-foreground text-sm">No redemptions yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {redemptions.map((redemption) => (
                      <button
                        key={redemption.id}
                        onClick={() => setSelectedRedemption(redemption)}
                        className="w-full bg-white rounded-2xl p-4 border border-slate-200/50 hover:border-primary hover:shadow-md transition text-left"
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

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200/50 z-20">
        <div className="flex items-center justify-around max-w-2xl mx-auto px-4">
          <button
            onClick={() => setActiveTab('home')}
            className={`flex-1 py-3 flex flex-col items-center gap-1 transition ${
              activeTab === 'home'
                ? 'text-primary'
                : 'text-muted-foreground'
            }`}
          >
            <Home size={24} />
            <span className="text-xs font-medium">Home</span>
          </button>
          <button
            onClick={() => setActiveTab('vouchers')}
            className={`flex-1 py-3 flex flex-col items-center gap-1 transition ${
              activeTab === 'vouchers'
                ? 'text-primary'
                : 'text-muted-foreground'
            }`}
          >
            <Gift size={24} />
            <span className="text-xs font-medium">Vouchers</span>
          </button>
          <button
            onClick={() => setActiveTab('redeem')}
            className={`flex-1 py-3 flex flex-col items-center gap-1 transition ${
              activeTab === 'redeem'
                ? 'text-primary'
                : 'text-muted-foreground'
            }`}
          >
            <WalletIcon size={24} />
            <span className="text-xs font-medium">Redeem</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-3 flex flex-col items-center gap-1 transition ${
              activeTab === 'history'
                ? 'text-primary'
                : 'text-muted-foreground'
            }`}
          >
            <History size={24} />
            <span className="text-xs font-medium">History</span>
          </button>
        </div>
      </nav>
    </div>
  )
}
