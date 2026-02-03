'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { auth, db } from '@/firebase/config'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore'
import LottieIcon from '@/components/LottieIcon'
import { Button } from '@/components/ui/button'
import { Heart } from 'lucide-react'
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-3xl mx-auto p-6">
        <div className="flex gap-6 items-center mb-6">
          <div className="w-40 h-24 bg-slate-200 rounded overflow-hidden">
            {stream.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={stream.thumbnailUrl} alt={stream.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">No thumbnail</div>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{stream.title}</h1>
            <p className="text-sm text-muted-foreground">By {stream.creatorName || stream.creatorHandle}</p>
            <div className="mt-2">
              <a href={stream.streamUrl} target="_blank" rel="noreferrer" className="text-primary underline">Watch Stream</a>
            </div>
          </div>
          <div className="ml-auto text-right">
            <p className="text-sm text-muted-foreground">Your balance</p>
            <div className="text-2xl font-bold text-primary">{(isNaN(loveUnits) ? 0 : loveUnits).toFixed(2)}</div>
          </div>
        </div>

        <div className="mb-4">
          <p className="text-sm text-muted-foreground">Tap an icon to gift the creator from your preloaded balance</p>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-4">
          {icons.map((icon) => {
            const hasBalance = loveUnits >= icon.amount
            return (
              <button
                key={icon.id}
                onClick={() => hasBalance && setSelectedIcon(icon)}
                className={`group relative rounded-lg p-1 transition-all ${
                  hasBalance ? 'hover:shadow-2xl hover:scale-105 active:scale-95 cursor-pointer' : 'opacity-40 cursor-not-allowed'
                }`}
                disabled={!hasBalance}
                aria-label={`Send $${icon.amount.toFixed(2)}${!hasBalance ? ' (insufficient balance)' : ''}`}
              >
                <div className={`w-full aspect-square flex items-center justify-center transition-all ${
                  !hasBalance ? 'grayscale' : 'grayscale-0'
                }`}>
                  <LottieIcon src={icon.lottieUrl} themeColor={hasBalance ? '#1a9b8e' : '#9ca3af'} className="w-20 h-20" />
                </div>
                <div className="flex items-center justify-center gap-1 mt-1">
                  <Heart size={12} className={hasBalance ? 'text-red-500' : 'text-slate-400'} />
                  <p className={`text-sm font-bold ${hasBalance ? 'text-primary' : 'text-slate-400'}`}>{icon.amount.toFixed(2)}</p>
                </div>
              </button>
            )
          })}
        </div>

        {selectedIcon && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4">
            <div className="bg-white rounded-t-3xl w-full max-w-md p-6 space-y-4 animate-in slide-in-from-bottom">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Send Gift</h2>
                <button onClick={() => setSelectedIcon(null)} className="p-1 hover:bg-slate-100 rounded-full">Close</button>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-24 h-24">
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
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
