'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { auth, db } from '@/firebase/config'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc, collection, query, where, getDocs, onSnapshot, addDoc, serverTimestamp, deleteDoc } from 'firebase/firestore'
import LottieIcon from '@/components/LottieIcon'
import { Button } from '@/components/ui/button'
import { Heart, Users, Share2, Clock } from 'lucide-react'
import toast from 'react-hot-toast'

export default function PublicGiftStreamPage() {
  const router = useRouter()
  const params = useParams()
  const id = (params && (params as any).id) || null
  const [stream, setStream] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [icons, setIcons] = useState<any[]>([])
  const [selectedIcon, setSelectedIcon] = useState<any | null>(null)
  const [user, setUser] = useState<any | null>(null)
  const [loveUnits, setLoveUnits] = useState(0)
  const [sending, setSending] = useState(false)
  const [connectedUsers, setConnectedUsers] = useState(0)
  const [recentGifts, setRecentGifts] = useState<any[]>([])
  const [presenceDocId, setPresenceDocId] = useState<string | null>(null)
  const [animatingGifts, setAnimatingGifts] = useState<any[]>([])
  const [isExpired, setIsExpired] = useState(false)

  useEffect(() => {
    const load = async () => {
      if (!id) return
      try {
        const ref = doc(db, 'giftStreams', id)
        const snap = await getDoc(ref)
        if (!snap.exists()) {
          setStream(null)
          setLoading(false)
          return
        }
        const data = snap.data()
        setStream({ id: snap.id, ...data })

        // Check if stream has expired (24 hours)
        if (data.createdAt) {
          const createdTime = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt)
          const expiryTime = new Date(createdTime.getTime() + 24 * 60 * 60 * 1000)
          if (new Date() > expiryTime) {
            setIsExpired(true)
          }
        }

        // load active icons
        const iconsQuery = query(collection(db, 'microGiftIcons'))
        const iconsSnap = await getDocs(iconsQuery)
        const loaded = iconsSnap.docs.map((d) => d.data()).filter((i: any) => i.active)
        setIcons(loaded.sort((a: any, b: any) => (a.id || 0) - (b.id || 0)))
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  // Presence tracking and gift notifications listener
  useEffect(() => {
    if (!id || !user) return

    let unsubscribePresence: (() => void) | null = null
    let unsubscribeGifts: (() => void) | null = null

    const setupPresenceAndGifts = async () => {
      try {
        // Create presence document for this user on this stream
        const presenceRef = collection(db, `giftStreams/${id}/presence`)
        const presenceDoc = await addDoc(presenceRef, {
          uid: user.uid,
          userName: user.displayName || 'Guest',
          connectedAt: serverTimestamp(),
          lastActivity: serverTimestamp()
        })
        setPresenceDocId(presenceDoc.id)

        // Listen to all presence documents to count connected users
        unsubscribePresence = onSnapshot(presenceRef, (snapshot) => {
          setConnectedUsers(snapshot.size)
        })

        // Listen to gift notifications on this stream
        const giftsRef = collection(db, `giftStreams/${id}/giftNotifications`)
        const giftsQuery = query(giftsRef)
        unsubscribeGifts = onSnapshot(giftsQuery, (snapshot) => {
          const gifts = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }))
          setRecentGifts(gifts)
        })
      } catch (error) {
        console.error('Error setting up presence:', error)
      }
    }

    setupPresenceAndGifts()

    // Cleanup: remove this user's presence and listeners on unmount
    return () => {
      if (unsubscribePresence) unsubscribePresence()
      if (unsubscribeGifts) unsubscribeGifts()
      if (presenceDocId) {
        deleteDoc(doc(db, `giftStreams/${id}/presence`, presenceDocId)).catch(
          error => console.error('Error removing presence:', error)
        )
      }
    }
  }, [id, user])

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u: any) => {
      setUser(u)
      if (u) {
        try {
          const userRef = doc(db, 'users', u.uid)
          const userSnap = await getDoc(userRef)
          if (userSnap.exists()) {
            const b = (userSnap.data()?.senderBalance || 0) / 100
            setLoveUnits(b)
          }
        } catch (e) {
          console.warn('Failed to load user balance', e)
        }
      } else {
        setLoveUnits(0)
      }
    })
    return () => unsub()
  }, [])

  const handleShare = async () => {
    if (!id) return
    const shareUrl = `${window.location.origin}/gift-stream/${id}`
    const shareTitle = stream?.title || 'Check out this live stream'
    
    try {
      await navigator.clipboard.writeText(shareUrl)
      toast.success('Link copied to clipboard!')
    } catch (e) {
      console.warn('Failed to copy to clipboard')
    }

    // Try native share if available
    if ((navigator as any).share) {
      try {
        await (navigator as any).share({
          title: shareTitle,
          url: shareUrl
        })
      } catch (e) {
        // User cancelled native share, that's ok
      }
    }
  }

  const handleSend = async () => {
    if (!selectedIcon) return
    if (!user) {
      toast('Please sign in to send gifts')
      router.push('/auth')
      return
    }
    if (loveUnits < selectedIcon.amount) {
      toast.error('Insufficient balance')
      return
    }
    if (!stream?.creatorHandle) {
      toast.error('Recipient handle missing')
      return
    }

    setSending(true)
    try {
      const res = await fetch('/api/microgifts/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: auth.currentUser?.uid,
          iconId: selectedIcon.id,
          iconName: selectedIcon.name,
          amount: selectedIcon.amount.toString(),
          recipientHandle: stream.creatorHandle,
          message: `Gifted via stream: ${stream.title || ''}`,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to send')

      // Broadcast gift to other viewers (without amount)
      try {
        const giftNotif = {
          id: Math.random().toString(36),
          giverName: user.displayName || 'Guest',
          iconName: selectedIcon.name,
          timestamp: new Date(),
          iconId: selectedIcon.id,
          iconUrl: selectedIcon.lottieUrl
        }
        
        // Add to animating gifts for visual celebration
        setAnimatingGifts(prev => [...prev, giftNotif])
        setTimeout(() => {
          setAnimatingGifts(prev => prev.filter(g => g.id !== giftNotif.id))
        }, 3000)

        await addDoc(collection(db, `giftStreams/${id}/giftNotifications`), {
          giverName: user.displayName || 'Guest',
          iconName: selectedIcon.name,
          timestamp: serverTimestamp(),
          iconId: selectedIcon.id
        })
      } catch (e) {
        console.warn('Failed to broadcast gift:', e)
      }

      toast.success(json.message || 'Gift sent')
      setLoveUnits(json.newBalance)
      setSelectedIcon(null)
    } catch (e: any) {
      console.error(e)
      toast.error(e.message || 'Failed to send')
    } finally {
      setSending(false)
    }
  }

  if (loading) return <div className="p-6">Loading...</div>
  if (!stream) return <div className="p-6">Stream not found</div>

  if (isExpired) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <Clock className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-2">Stream Expired</h1>
          <p className="text-muted-foreground mb-6">
            This gift stream has expired after 24 hours. It was meant to support a live stream that has ended.
          </p>
          <Button onClick={() => router.push('/')}>Back to Home</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-3xl mx-auto p-6">
        {/* Connected users indicator */}
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-primary">
          <Users className="w-4 h-4" />
          <span>{connectedUsers} {connectedUsers === 1 ? 'person' : 'people'} watching</span>
        </div>

        <div className="flex flex-col md:flex-row gap-6 items-start mb-6">
          <div className="w-full md:w-1/3 h-48 md:h-40 bg-slate-200 rounded overflow-hidden relative">
            {stream.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={stream.thumbnailUrl} alt={stream.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">No thumbnail</div>
            )}
            {/* Host badge on thumbnail */}
            <div className="absolute top-2 right-2 bg-black/60 text-white text-xs font-semibold px-2 py-1 rounded flex items-center gap-1">
              <Users className="w-3 h-3" />
              Hosted by {stream.creatorName || stream.creatorHandle}
            </div>
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold mb-2">{stream.title}</h1>
            <div className="flex items-center gap-4 mb-4">
              <Button variant="outline" size="sm" onClick={handleShare} className="gap-2">
                <Share2 className="w-4 h-4" />
                Share Stream
              </Button>
              <a href={stream.streamUrl} target="_blank" rel="noreferrer" className="text-primary underline text-sm font-medium hover:no-underline">
                Watch Live
              </a>
            </div>
          </div>
          <div className="w-full md:w-auto ml-0 md:ml-auto text-right">
            <p className="text-sm text-muted-foreground">Your balance</p>
            <div className="text-2xl font-bold text-primary">{(isNaN(loveUnits) ? 0 : loveUnits).toFixed(2)}</div>
          </div>
        </div>

        <div className="mb-4">
          <p className="text-sm text-muted-foreground">Tap an icon to gift the creator from your preloaded balance</p>
        </div>

        <div className="overflow-x-auto py-4 px-2">
          <div className="flex gap-4 w-max">
            {icons.map((icon) => {
              const hasBalance = loveUnits >= icon.amount
              return (
                <button
                  key={icon.id}
                  onClick={() => hasBalance && setSelectedIcon(icon)}
                  className={`relative transition-all ${
                    hasBalance ? 'hover:scale-125 cursor-pointer' : 'opacity-30 cursor-not-allowed'
                  }`}
                  disabled={!hasBalance}
                  aria-label={icon.name}
                  title={icon.name}
                >
                  <div className={`w-14 h-14 flex items-center justify-center ${!hasBalance ? 'grayscale' : ''}`}>
                    <LottieIcon src={icon.lottieUrl} themeColor={hasBalance ? '#1a9b8e' : '#9ca3af'} className="w-full h-full" />
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {selectedIcon && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4">
            <div className="bg-white rounded-t-3xl w-full max-w-md max-h-96 p-6 space-y-4 animate-in slide-in-from-bottom flex flex-col">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Send Gift</h2>
                <button onClick={() => setSelectedIcon(null)} className="p-1 hover:bg-slate-100 rounded-full">Close</button>
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-slate-50 p-2 rounded">
                <Users className="w-4 h-4" />
                <span>{connectedUsers} {connectedUsers === 1 ? 'person' : 'people'} watching</span>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-16 h-16">
                  <LottieIcon src={selectedIcon.lottieUrl} themeColor="#1a9b8e" className="w-full h-full" />
                </div>
                <div>
                  <p className="font-semibold">{selectedIcon.name}</p>
                  <p className="text-sm text-muted-foreground">Amount: ${selectedIcon.amount.toFixed(2)}</p>
                </div>
              </div>

              <div className="pt-2">
                <Button className="w-full" onClick={handleSend} disabled={sending}>
                  {sending ? 'Sending...' : 'Send Gift'}
                </Button>
              </div>

              {recentGifts.length > 0 && (
                <div className="border-t pt-4 overflow-y-auto flex-1">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Recent gifts</p>
                  <div className="space-y-2">
                    {recentGifts.slice(-5).reverse().map((gift) => (
                      <div key={gift.id} className="text-sm flex items-center gap-2 py-1">
                        <span className="font-medium">{gift.giverName}</span>
                        <span className="text-muted-foreground">sent</span>
                        <span>{gift.iconName}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Animated gift celebrations */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          {animatingGifts.map((gift) => (
            <div
              key={gift.id}
              className="absolute animate-pulse"
              style={{
                left: Math.random() * 80 + '%',
                bottom: '0%',
                animation: `slideUp 3s ease-out forwards`,
              }}
            >
              <div className="flex flex-col items-center gap-2">
                <div className="w-16 h-16 bg-white rounded-full shadow-lg p-2 flex items-center justify-center">
                  <LottieIcon src={gift.iconUrl} themeColor="#1a9b8e" className="w-full h-full" />
                </div>
                <div className="text-center text-sm font-semibold text-white drop-shadow-lg bg-black/50 px-2 py-1 rounded">
                  {gift.giverName} sent a gift! 🎉
                </div>
              </div>
            </div>
          ))}
        </div>

        <style>{`
          @keyframes slideUp {
            0% {
              transform: translateY(0) scale(0.5);
              opacity: 0;
            }
            10% {
              opacity: 1;
            }
            90% {
              opacity: 1;
            }
            100% {
              transform: translateY(-120vh) scale(1);
              opacity: 0;
            }
          }
        `}</style>
      </div>
    </div>
  )
}
