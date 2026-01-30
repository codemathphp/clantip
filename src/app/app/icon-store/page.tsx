'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { auth, db } from '@/firebase/config'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, getDocs, doc, getDoc, query, where } from 'firebase/firestore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Heart } from 'lucide-react'
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

const ICONS_PER_PAGE = 9

export default function IconStorePage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loveUnits, setLoveUnits] = useState(0)
  const [icons, setIcons] = useState<MicroGiftIcon[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedIcon, setSelectedIcon] = useState<MicroGiftIcon | null>(null)
  const [recipientHandle, setRecipientHandle] = useState('')
  const [message, setMessage] = useState('')
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
          setLoveUnits(userData.senderBalance / 100) // Convert cents to dollars
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
    if (!selectedIcon || !recipientHandle) {
      toast.error('Please select an icon and enter a recipient')
      return
    }

    if (loveUnits < selectedIcon.amount) {
      toast.error(`Insufficient Love Units. You have ${loveUnits.toFixed(2)}, need ${selectedIcon.amount.toFixed(2)}`)
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
          recipientHandle: recipientHandle.trim(),
          message: message.trim(),
        }),
      })

      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Failed to send')

      toast.success(`💝 ${selectedIcon.name} sent! Love units: ${json.newBalance.toFixed(2)}`)
      setLoveUnits(json.newBalance)
      setSelectedIcon(null)
      setRecipientHandle('')
      setMessage('')
    } catch (error: any) {
      toast.error(error.message || 'Failed to send microgift')
    } finally {
      setSending(false)
    }
  }

  // Pagination
  const totalPages = Math.ceil(icons.length / ICONS_PER_PAGE)
  const startIdx = (currentPage - 1) * ICONS_PER_PAGE
  const paginatedIcons = icons.slice(startIdx, startIdx + ICONS_PER_PAGE)
  const groupedByCategory = paginatedIcons.reduce(
    (acc, icon) => {
      if (!acc[icon.category]) acc[icon.category] = []
      acc[icon.category].push(icon)
      return acc
    },
    {} as Record<string, MicroGiftIcon[]>
  )

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
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Heart className="text-red-500" size={28} />
              Love Store
            </h1>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Available</p>
            <p className="text-2xl font-bold text-primary">{loveUnits.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Love Units</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Quick Gift Modal */}
        {selectedIcon && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Send {selectedIcon.name}</h2>
                <button
                  onClick={() => setSelectedIcon(null)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              </div>

              <div className="flex justify-center p-4 bg-slate-50 rounded-lg">
                <div className="w-24 h-24">
                  <LottieIcon
                    src={selectedIcon.lottieUrl}
                    themeColor="#1a9b8e"
                    className="w-full h-full"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Recipient Handle</p>
                <Input
                  placeholder="@username or phone"
                  value={recipientHandle}
                  onChange={(e) => setRecipientHandle(e.target.value)}
                  className="border-slate-200"
                />
              </div>

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Message (optional)</p>
                <Input
                  placeholder="Add a personal touch..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="border-slate-200"
                  maxLength={100}
                />
                <p className="text-xs text-muted-foreground text-right">{message.length}/100</p>
              </div>

              <div className="bg-primary/10 rounded-lg p-3">
                <p className="text-sm font-semibold text-primary">
                  💝 {selectedIcon.amount.toFixed(2)} Love Units
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setSelectedIcon(null)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-primary hover:bg-primary/90"
                  onClick={handleSendMicroGift}
                  disabled={sending || !recipientHandle}
                >
                  {sending ? 'Sending...' : 'Send Love 💝'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Icons Grid */}
        {Object.entries(groupedByCategory).length === 0 ? (
          <div className="text-center py-12">
            <Heart size={48} className="mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">No love icons available yet</p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedByCategory).map(([category, categoryIcons]) => (
              <div key={category}>
                <h2 className="text-lg font-semibold mb-4 text-slate-700">{category}</h2>
                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {categoryIcons.map((icon) => (
                    <button
                      key={icon.id}
                      onClick={() => setSelectedIcon(icon)}
                      className="group relative bg-white rounded-xl p-4 hover:shadow-lg transition-all hover:scale-105 active:scale-95 border border-slate-200/50"
                      disabled={loveUnits < icon.amount}
                    >
                      {/* Icon Animation */}
                      <div className="w-full aspect-square mb-2">
                        <LottieIcon
                          src={icon.lottieUrl}
                          themeColor="#1a9b8e"
                          className="w-full h-full"
                        />
                      </div>

                      {/* Icon Name & Price */}
                      <p className="text-xs font-semibold text-center mb-1 text-foreground">
                        {icon.name}
                      </p>
                      <div className="flex items-center justify-center gap-1">
                        <Heart size={12} className="text-red-500" />
                        <p className="text-sm font-bold text-primary">
                          {icon.amount.toFixed(2)}
                        </p>
                      </div>

                      {/* Insufficient Balance */}
                      {loveUnits < icon.amount && (
                        <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center">
                          <p className="text-white text-xs font-semibold">Insufficient</p>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-12">
            <Button
              variant="outline"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              size="sm"
            >
              ← Previous
            </Button>
            <div className="flex gap-1">
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i + 1}
                  onClick={() => setCurrentPage(i + 1)}
                  className={`w-8 h-8 rounded text-sm font-medium transition ${
                    currentPage === i + 1
                      ? 'bg-primary text-white'
                      : 'bg-white border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <Button
              variant="outline"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              size="sm"
            >
              Next →
            </Button>
          </div>
        )}
      </main>
    </div>
  )
}
