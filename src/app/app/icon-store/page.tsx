'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { auth, db } from '@/firebase/config'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, getDocs, doc, getDoc, query, where } from 'firebase/firestore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowLeft, Heart, X } from 'lucide-react'
import toast from 'react-hot-toast'
import LottieIcon from '@/components/LottieIcon'

interface MicroGiftIcon {
  id: number
  name: string
  category: string
  amount: number
  lottieUrl: string
  active: boolean
}

interface User {
  phone: string
  senderBalance: number
  fullName: string
  handle: string
}

export default function IconStorePage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loveUnits, setLoveUnits] = useState(0)
  const [icons, setIcons] = useState<MicroGiftIcon[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIcon, setSelectedIcon] = useState<MicroGiftIcon | null>(null)
  const [recipientInput, setRecipientInput] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser: any) => {
      if (!authUser) {
        router.push('/auth')
        return
      }

      try {
        // Load user
        const userRef = doc(db, 'users', authUser.uid)
        const userSnap = await getDoc(userRef)
        if (userSnap.exists()) {
          const userData = userSnap.data() as User
          setUser(userData)
          setLoveUnits((userData.senderBalance || 0) / 100) // Convert cents to units, guard undefined
        }

        // Load active icons from Firestore
        const iconsQuery = query(
          collection(db, 'microGiftIcons'),
          where('active', '==', true)
        )
        const iconsSnap = await getDocs(iconsQuery)
        const loadedIcons = iconsSnap.docs.map((doc) => doc.data() as MicroGiftIcon)
        setIcons(loadedIcons.sort((a, b) => a.id - b.id))
      } catch (error) {
        console.error('Error loading icon store:', error)
        toast.error('Failed to load icon store')
      } finally {
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [router])

  const handleSendMicroGift = async () => {
    if (!selectedIcon || !recipientInput.trim()) {
      toast.error('Please enter recipient handle or phone')
      return
    }

    if (loveUnits < selectedIcon.amount) {
      toast.error(`Insufficient balance. Need ${selectedIcon.amount.toFixed(2)}, have ${loveUnits.toFixed(2)}`)
      return
    }

    setSending(true)
    try {
      const response = await fetch('/api/microgifts/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: auth.currentUser?.uid,
          iconId: selectedIcon.id,
          iconName: selectedIcon.name,
          amount: selectedIcon.amount.toString(),
          recipientHandle: recipientInput.trim(),
          message: '', // No message for tap-and-go
        }),
      })

      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Failed to send')

      toast.success(`💝 Love sent! Balance: $${json.newBalance.toFixed(2)}`)
      setLoveUnits(json.newBalance)
      setSelectedIcon(null)
      setRecipientInput('')
    } catch (error: any) {
      toast.error(error.message || 'Failed to send love')
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin mb-4 inline-block">
            <Heart size={40} className="text-primary" />
          </div>
          <p className="text-muted-foreground">Loading love store...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200/50 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              className="p-2"
            >
              <ArrowLeft size={20} />
            </Button>
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <Heart className="text-red-500" size={22} />
              Tap and Send
            </h1>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Preloaded</p>
            <p className="text-2xl font-bold text-primary">{(isNaN(loveUnits) ? 0 : loveUnits).toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Love Units</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Send Love Bottom Drawer */}
        {selectedIcon && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4">
            <div className="bg-white rounded-t-3xl w-full max-w-md p-6 space-y-4 animate-in slide-in-from-bottom">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Send Love</h2>
                <button
                  onClick={() => setSelectedIcon(null)}
                  className="p-1 hover:bg-slate-100 rounded-full transition"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Icon Preview */}
              <div className="flex flex-col items-center gap-2">
                <div className="w-24 h-24">
                  <LottieIcon
                    src={selectedIcon.lottieUrl}
                    themeColor="#1a9b8e"
                    className="w-full h-full"
                  />
                </div>
                <p className="text-sm text-muted-foreground">${selectedIcon.amount.toFixed(2)}</p>
              </div>

              {/* Recipient Input */}
              <div className="space-y-2">
                <label className="text-sm font-medium">To</label>
                <Input
                  placeholder="@handle or phone"
                  value={recipientInput}
                  onChange={(e) => setRecipientInput(e.target.value)}
                  className="border-slate-200 rounded-xl h-12 text-base"
                  autoFocus
                />
              </div>

              {/* Send Button */}
              <Button
                className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 font-semibold text-base"
                onClick={handleSendMicroGift}
                disabled={sending || !recipientInput.trim()}
              >
                {sending ? 'Sending...' : 'Send Love 💝'}
              </Button>
            </div>
          </div>
        )}

        {/* Icons Grid - All icons, no pagination */}
        {icons.length === 0 ? (
          <div className="text-center py-12">
            <Heart size={48} className="mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">No love available yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4 pb-8">
            {icons.map((icon) => (
              <button
                key={icon.id}
                onClick={() => setSelectedIcon(icon)}
                className="group relative rounded-lg p-1 hover:shadow-2xl transition-all hover:scale-105 active:scale-95"
                disabled={loveUnits < icon.amount}
                aria-label={`Send $${icon.amount.toFixed(2)}`}
              >
                {/* Icon Animation */}
                <div className="w-full aspect-square flex items-center justify-center">
                  <LottieIcon
                    src={icon.lottieUrl}
                    themeColor="#1a9b8e"
                    className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28"
                  />
                </div>

                {/* Price */}
                <div className="flex items-center justify-center gap-1 mt-1">
                  <Heart size={12} className="text-red-500" />
                  <p className="text-sm font-bold text-primary">${icon.amount.toFixed(2)}</p>
                </div>

                {/* Insufficient Balance Overlay */}
                {loveUnits < icon.amount && (
                  <div className="absolute inset-0 bg-black/40 rounded-lg flex items-center justify-center">
                    <p className="text-white text-xs font-semibold">Insufficient</p>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
