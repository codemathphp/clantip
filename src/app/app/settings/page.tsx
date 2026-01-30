'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { auth, db } from '@/firebase/config'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore'
import { User, Wallet } from '@/types'
import { SUPPORTED_COUNTRIES } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import toast from 'react-hot-toast'
import Image from 'next/image'
import { Menu, X, Home, Gift, History, Settings, LogOut, ArrowLeft, AlertCircle, QrCode } from 'lucide-react'

export default function SettingsPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [loading, setLoading] = useState(true)
  const [showDrawer, setShowDrawer] = useState(false)
  const [exchangeRates, setExchangeRates] = useState<any>(null)
  const [selectedCurrency, setSelectedCurrency] = useState<string>('ZAR')
  const [isConverting, setIsConverting] = useState(false)
  const [handleInput, setHandleInput] = useState<string>('')
  const [isUpdatingHandle, setIsUpdatingHandle] = useState(false)

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
        const phone = authUser.phoneNumber
        if (!phone) {
          console.error('No phone number in auth user')
          return
        }

        // Lookup user
        const userRef = doc(db, 'users', phone)
        const userSnap = await getDoc(userRef)
        if (userSnap.exists()) {
          const userData = userSnap.data() as User
          setUser(userData)
          setSelectedCurrency(userData.baseCurrency || 'ZAR')
          setHandleInput(userData.handle || '')

          // Lookup wallet
          const walletRef = doc(db, 'wallets', phone)
          const walletSnap = await getDoc(walletRef)
          if (walletSnap.exists()) {
            setWallet(walletSnap.data() as Wallet)
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error)
        toast.error('Failed to load settings')
      } finally {
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [router])

  const handleCurrencyChange = async () => {
    if (!user || !wallet || selectedCurrency === user.baseCurrency) {
      toast.error('Please select a different currency')
      return
    }

    if (!exchangeRates) {
      toast.error('Exchange rates not loaded. Please try again.')
      return
    }

    setIsConverting(true)
    try {
      const phone = user.phone
      const newCountry = SUPPORTED_COUNTRIES.find(c => c.currency === selectedCurrency)?.code || ''

      const res = await fetch('/api/user/change-base-currency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, newCurrency: selectedCurrency, newCountry }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Conversion failed')

      // Try to read returned summary (API returns amounts in units if available)
      const oldAmount = data.oldAmount !== undefined ? Number(data.oldAmount).toFixed(2) : ((wallet.availableCredits || 0) / 100).toFixed(2)
      const newAmount = data.convertedAmount !== undefined ? Number(data.convertedAmount).toFixed(2) : (data.finalAmount !== undefined ? Number(data.finalAmount).toFixed(2) : ((wallet.availableCredits || 0) / 100).toFixed(2))
      const feeAmount = data.fee !== undefined ? Number(data.fee).toFixed(2) : (((wallet.availableCredits || 0) - (data.finalAmount ? Math.round(data.finalAmount * 100) : (wallet.availableCredits || 0))) / 100).toFixed(2)

      toast.success(`✓ Currency changed to ${selectedCurrency}`)
      toast.custom(() => (
        <div className="bg-white rounded-lg p-4 shadow-lg border border-slate-200">
          <p className="font-semibold mb-2">Conversion Summary</p>
          <p className="text-sm text-muted-foreground mb-1">Before: {oldAmount} {user.baseCurrency}</p>
          <p className="text-sm text-muted-foreground mb-1">Fee (2%): {feeAmount} {user.baseCurrency}</p>
          <p className="text-sm font-semibold text-green-600">After: {newAmount} {selectedCurrency}</p>
        </div>
      ))

      // Refresh user and wallet from server-side state
      const userRef = doc(db, 'users', phone)
      const userSnap = await getDoc(userRef)
      if (userSnap.exists()) setUser(userSnap.data() as User)

      const walletRef = doc(db, 'wallets', phone)
      const walletSnap = await getDoc(walletRef)
      if (walletSnap.exists()) setWallet(walletSnap.data() as Wallet)
    } catch (error: any) {
      console.error('Error changing currency:', error)
      toast.error(error.message || 'Failed to change currency')
    } finally {
      setIsConverting(false)
    }
  }

  const handleUpdateHandle = async () => {
    if (!user) return
    const trimmed = handleInput.trim()
    if (!trimmed) {
      toast.error('Please enter a handle')
      return
    }
    if (trimmed === user.handle) {
      toast.error('No changes to save')
      return
    }

    setIsUpdatingHandle(true)
    try {
      const res = await fetch('/api/user/update-handle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: user.phone, handle: trimmed }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to update handle')

      setUser({ ...user, handle: data.data.handle })
      toast.success('✓ Handle updated successfully')
    } catch (error: any) {
      console.error('Error updating handle:', error)
      toast.error(error.message || 'Failed to update handle')
      setHandleInput(user.handle || '')
    } finally {
      setIsUpdatingHandle(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-accent/5">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent"></div>
          <p className="mt-4 text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    )
  }

  const currentCountry = SUPPORTED_COUNTRIES.find(c => c.currency === user?.baseCurrency)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-slate-200/50">
        <div className="px-4 py-3 flex items-center justify-between max-w-2xl mx-auto">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-slate-100 rounded-lg transition"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-lg font-bold">Settings</h1>
          <button
            onClick={() => setShowDrawer(!showDrawer)}
            className="p-2 hover:bg-slate-100 rounded-lg transition"
          >
            {showDrawer ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </header>

      {showDrawer && (
        <div className="fixed inset-0 z-50 bg-black/20" onClick={() => setShowDrawer(false)}>
          <div className="fixed inset-y-0 left-0 w-64 bg-white shadow-lg animate-in slide-in-from-left" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-200/50 flex items-center justify-between">
              <div className="relative w-24 h-8">
                <Image
                  src="/clantip_logo.png"
                  alt="ClanTip Logo"
                  fill
                  className="object-contain"
                />
              </div>
              <button onClick={() => setShowDrawer(false)} className="p-1 hover:bg-slate-100 rounded">
                <X size={20} />
              </button>
            </div>

            <nav className="p-4 space-y-2">
              <button
                onClick={() => {
                  router.push(user?.role === 'sender' ? '/app/sender' : '/app/recipient')
                  setShowDrawer(false)
                }}
                className="w-full flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-slate-100 transition text-left"
              >
                <Home size={20} />
                <span className="text-sm font-medium">Dashboard</span>
              </button>
              <button
                onClick={() => {
                  router.push('/app/receive')
                  setShowDrawer(false)
                }}
                className="w-full flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-slate-100 transition text-left"
              >
                <QrCode size={20} />
                <span className="text-sm font-medium">Receive Tip (SCAN)</span>
              </button>
              <button
                onClick={() => {
                  router.push('/app/settings')
                  setShowDrawer(false)
                }}
                className="w-full flex items-center gap-3 px-4 py-2 rounded-lg bg-slate-50 border border-slate-200 text-left"
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

      <main className="max-w-2xl mx-auto px-4 py-6 pb-24">
        <div className="space-y-6">
          {/* User Info */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/50">
            <h2 className="text-lg font-semibold mb-4">Account Information</h2>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Full Name</p>
                <p className="font-semibold">{user?.fullName}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Phone</p>
                <p className="font-semibold">{user?.phone}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Handle</p>
                {user?.handle ? (
                  <p className="font-semibold">@{user.handle}</p>
                ) : (
                  <p className="text-muted-foreground italic">Not set</p>
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Current Balance</p>
                <p className="font-semibold text-lg">{(wallet?.availableCredits || 0) / 100} {user?.baseCurrency || 'ZAR'}</p>
              </div>
            </div>
          </div>

          {/* Base Currency Settings */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/50">
            <h2 className="text-lg font-semibold mb-2">Base Currency</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Change your base currency if you're now in a different country. A 2% conversion fee will apply.
            </p>

            {/* Current Currency Info */}
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <p className="text-sm text-blue-900">
                <span className="font-semibold">Current:</span> {currentCountry?.name} ({user?.baseCurrency})
              </p>
            </div>

            {/* Currency Selector */}
            <div className="space-y-3 mb-4">
              <label className="text-sm font-medium">Select New Country</label>
              <select
                value={selectedCurrency}
                onChange={(e) => setSelectedCurrency(e.target.value)}
                disabled={isConverting}
                className="w-full px-3 py-2 border border-slate-200/50 rounded-2xl text-sm"
              >
                {SUPPORTED_COUNTRIES.map((country) => (
                  <option key={country.currency} value={country.currency}>
                    {country.name} ({country.currency})
                  </option>
                ))}
              </select>
            </div>

            {/* Conversion Preview */}
            {selectedCurrency !== user?.baseCurrency && exchangeRates && (
              <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
                <div className="flex gap-2 mb-2">
                  <AlertCircle size={16} className="text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-yellow-900">Conversion Preview</p>
                    <p className="text-xs text-yellow-800 mt-1">
                      Current: {(wallet?.availableCredits || 0) / 100} {user?.baseCurrency}
                    </p>
                    <p className="text-xs text-yellow-800">
                      Fee (2%): Will be deducted from your balance
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Action Button */}
            <Button
              onClick={handleCurrencyChange}
              disabled={isConverting || selectedCurrency === user?.baseCurrency}
              className="w-full h-11 rounded-2xl"
            >
              {isConverting ? 'Converting...' : 'Change Base Currency'}
            </Button>
          </div>

          {/* User Handle Settings */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/50">
            <h2 className="text-lg font-semibold mb-2">User Handle</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Create a unique handle so others can send gifts to you by username instead of phone number.
            </p>

            <div className="space-y-3 mb-4">
              <label className="text-sm font-medium">Your Handle</label>
              <Input
                type="text"
                placeholder="Enter handle (3-20 chars, alphanumeric + underscore)"
                value={handleInput}
                onChange={(e) => setHandleInput(e.target.value)}
                disabled={isUpdatingHandle}
                className="rounded-2xl"
              />
              <p className="text-xs text-muted-foreground">
                Hint: Use letters, numbers, and underscores only. Example: john_doe, user123
              </p>
            </div>

            <Button
              onClick={handleUpdateHandle}
              disabled={isUpdatingHandle || handleInput.trim() === user?.handle || !handleInput.trim()}
              className="w-full h-11 rounded-2xl"
            >
              {isUpdatingHandle ? 'Updating...' : 'Save Handle'}
            </Button>
          </div>

          {/* Important Notes */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/50">
            <h3 className="font-semibold text-sm mb-2">Important Notes</h3>
            <ul className="text-xs text-muted-foreground space-y-2">
              <li>• Your original currency balance is preserved</li>
              <li>• New vouchers will be sent in your new base currency</li>
              <li>• A 2% conversion fee applies to your balance</li>
              <li>• You can change back anytime (2% fee applies again)</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  )
}
