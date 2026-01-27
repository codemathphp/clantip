'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { auth, db } from '@/firebase/config'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore'
import { User, Voucher, Wallet, Redemption } from '@/types'
import { formatCurrency, SA_BANKS } from '@/lib/constants'
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
  const [activeTab, setActiveTab] = useState<'home' | 'vouchers' | 'redeem' | 'history'>('home')
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
            where('recipientId', '==', authUser.uid)
          )
          const vouchersSnap = await getDocs(vouchersQuery)
          setVouchers(
            vouchersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Voucher))
          )

          const redemptionsQuery = query(
            collection(db, 'redemptions'),
            where('userId', '==', authUser.uid)
          )
          const redemptionsSnap = await getDocs(redemptionsQuery)
          setRedemptions(
            redemptionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Redemption))
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
                className="w-full flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-slate-100 transition text-left bg-slate-50 border border-slate-200"
              >
                <Gift size={20} />
                <span className="text-sm font-medium">Receive Credits</span>
              </button>
              <button
                onClick={() => router.push('/app/sender')}
                className="w-full flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-slate-100 transition text-left"
              >
                <Home size={20} />
                <span className="text-sm font-medium">Send Credits</span>
              </button>

              <div className="my-3 border-t border-slate-200"></div>

              <button
                onClick={() => {
                  setActiveTab('vouchers')
                  setShowDrawer(false)
                }}
                className="w-full flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-slate-100 transition text-left"
              >
                <Gift size={20} />
                <span className="text-sm font-medium">My Vouchers</span>
              </button>
              <button
                onClick={() => {
                  setActiveTab('redeem')
                  setShowDrawer(false)
                }}
                className="w-full flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-slate-100 transition text-left"
              >
                <WalletIcon size={20} />
                <span className="text-sm font-medium">Redeem Funds</span>
              </button>
              <button
                onClick={() => {
                  setActiveTab('history')
                  setShowDrawer(false)
                }}
                className="w-full flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-slate-100 transition text-left"
              >
                <History size={20} />
                <span className="text-sm font-medium">Redemption History</span>
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
              <Button
                onClick={() => setActiveTab('redeem')}
                variant="outline"
                className="h-14 text-base"
              >
                <WalletIcon className="mr-2" size={20} />
                Redeem
              </Button>
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
                      <span className="text-muted-foreground">Amount</span>
                      <span className="font-semibold text-lg">{formatCurrency(selectedVoucher.amount)}</span>
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
                        <p className="italic text-foreground">"{selectedVoucher.message}"</p>
                      </div>
                    )}

                    <div className="pt-4">
                      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                        <p className="text-sm text-blue-900">
                          <span className="font-semibold">💡 Tip:</span> Save your voucher code in a safe place. You'll need it when redeeming your credits.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-6 border-t border-slate-200/50">
                    <Button className="w-full h-12 rounded-2xl">
                      Print / Save Receipt
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
                              <div className="font-bold text-lg">{formatCurrency(voucher.amount)}</div>
                              <Badge className={voucher.status === 'redeemed' || voucher.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                                {voucher.status}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground font-mono mb-1">Code: {voucher.code}</p>
                            {voucher.message && (
                              <p className="text-sm text-muted-foreground italic line-clamp-1">"{voucher.message}"</p>
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
                    <Button className="w-full h-12 rounded-2xl">
                      Print / Save Receipt
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
