'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { auth, db } from '@/firebase/config'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore'
import { User, Voucher, Wallet } from '@/types'
import { formatCurrency, SUPPORTED_COUNTRIES } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NotificationCenter } from '@/components/NotificationCenter'
import toast from 'react-hot-toast'
import Image from 'next/image'
import { Menu, X, Home, Gift, History, Settings, LogOut, ChevronRight, ShoppingBag } from 'lucide-react'

export default function SenderDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [loading, setLoading] = useState(true)
  const [showDrawer, setShowDrawer] = useState(false)
  const [activeTab, setActiveTab] = useState<'home' | 'gift' | 'history' | 'store'>('home')
  const [balanceTab, setBalanceTab] = useState<'sent' | 'pending' | 'redeemed'>('sent')
  const [exchangeRates, setExchangeRates] = useState<any>(null)
  const [storeVouchers] = useState<any[]>([
    { id: 1, name: 'Quick $10', amount: 10, popular: false },
    { id: 2, name: 'Popular $50', amount: 50, popular: true },
    { id: 3, name: 'Premium $100', amount: 100, popular: false },
    { id: 4, name: 'Deluxe $250', amount: 250, popular: false },
    { id: 5, name: 'Elite $500', amount: 500, popular: false },
  ])
  const [giftForm, setGiftForm] = useState({
    recipientPhone: '',
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser: any) => {
      if (!authUser) {
        router.push('/auth')
        return
      }

      try {
        // Get phone from auth user
        const phone = authUser.phoneNumber
        if (!phone) {
          console.error('No phone number in auth user')
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

          const vouchersQuery = query(
            collection(db, 'vouchers'),
            where('senderId', '==', authUser.uid)
          )
          const vouchersSnap = await getDocs(vouchersQuery)
          setVouchers(
            vouchersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Voucher))
          )
        }
      } catch (error) {
        console.error('Error fetching data:', error)
        toast.error('Failed to load dashboard')
      } finally {
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [router])

  const handleGiftCredits = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!giftForm.recipientPhone || !giftForm.amount) {
      toast.error('Please fill in required fields')
      return
    }

    const formattedRecipientPhone = giftForm.recipientPhone.replace(/\D/g, '')
    const formattedUserPhone = user?.phone?.replace(/\D/g, '') || ''
    
    if (formattedRecipientPhone === formattedUserPhone) {
      toast.error('You cannot send credits to yourself')
      return
    }

    setLoading(true)
    try {
      // Calculate fees: 5% platform + 10% processing + fixed fee
      const baseAmount = parseFloat(giftForm.amount)
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
          recipientPhone: giftForm.recipientPhone,
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
      // Senders always send in USD
      const senderAmount = voucher.originalAmount || 0
      
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
            <NotificationCenter />
            <button
              onClick={() => setShowDrawer(!showDrawer)}
              className="p-2 hover:bg-slate-100 rounded-lg transition"
            >
              {showDrawer ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </header>

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
                onClick={() => setShowDrawer(false)}
                className="w-full flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-slate-100 transition text-left"
              >
                <Settings size={20} />
                <span className="text-sm font-medium">Settings</span>
              </button>
            </nav>

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
                      <div className="text-4xl font-bold mb-2">{formatCurrency(totalSent)}</div>
                  <p className="text-sm text-muted-foreground">{vouchers.length} gifts sent</p>
                </>
              )}
              {balanceTab === 'pending' && (
                <>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Pending Redemption</p>
                  <div className="text-4xl font-bold mb-2">{formatCurrency(pendingAmount)}</div>
                  <p className="text-sm text-muted-foreground">Waiting to be redeemed</p>
                </>
              )}
              {balanceTab === 'redeemed' && (
                <>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Successfully Redeemed</p>
                  <div className="text-4xl font-bold mb-2">{formatCurrency(redeemedAmount)}</div>
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
                onClick={() => setActiveTab('store')}
                variant="outline"
                className="h-14 text-base"
              >
                <ShoppingBag className="mr-2" size={20} />
                Store
              </Button>
            </div>

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
                  {vouchers.slice(0, 3).map((voucher) => (
                    <div key={voucher.id} className="bg-white rounded-lg p-3 flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-semibold text-sm">{voucher.originalCurrency === 'USD' && typeof voucher.originalAmount === 'number' ? `$${Number(voucher.originalAmount).toFixed(2)}` : formatCurrency(voucher.amount)}</p>
                        {voucher.message && (
                          <p className="text-xs text-muted-foreground truncate">{voucher.message}</p>
                        )}
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {voucher.status}
                      </Badge>
                    </div>
                  ))}
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

                <Button type="submit" className="w-full h-12 rounded-2xl">
                  Proceed to Payment
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
                      {voucher.amount} ZAR
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
            onClick={() => setActiveTab('gift')}
            className={`flex-1 py-3 flex flex-col items-center gap-1 transition ${
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
            className={`flex-1 py-3 flex flex-col items-center gap-1 transition ${
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
