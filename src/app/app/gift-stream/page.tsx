'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { auth, db } from '@/firebase/config'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, addDoc, doc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import toast from 'react-hot-toast'

export default function CreatorGiftStreamPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [streamUrl, setStreamUrl] = useState('')
  const [thumbnailUrl, setThumbnailUrl] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) {
        router.push('/auth')
        return
      }
      setUser(u)
      setLoading(false)
    })
    return () => unsub()
  }, [router])

  const handleCreate = async () => {
    if (!user) return
    if (!streamUrl || !title) {
      toast.error('Please provide title and stream URL')
      return
    }
    setCreating(true)
    try {
      const docRef = await addDoc(collection(db, 'giftStreams'), {
        title,
        streamUrl,
        thumbnailUrl: thumbnailUrl || null,
        creatorUid: user.uid,
        creatorName: user.displayName || '',
        creatorHandle: (user?.displayName || '').replace(/\s+/g, '').toLowerCase(),
        createdAt: serverTimestamp(),
      })
      const publicUrl = `${window.location.origin}/gift-stream/${docRef.id}`
      toast.success('Stream created. Public link copied to clipboard')
      await navigator.clipboard.writeText(publicUrl)
      router.push(`/gift-stream/${docRef.id}`)
    } catch (e: any) {
      console.error('Failed to create stream', e)
      toast.error(e.message || 'Failed to create stream')
    } finally {
      setCreating(false)
    }
  }

  if (loading) return <div className="p-6">Checking auth...</div>

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Create Gift Stream Page</h1>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Title</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="My Live Stream" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Stream URL</label>
          <Input value={streamUrl} onChange={(e) => setStreamUrl(e.target.value)} placeholder="https://youtube.com/..." />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Thumbnail URL (optional)</label>
          <Input value={thumbnailUrl} onChange={(e) => setThumbnailUrl(e.target.value)} placeholder="https://.../thumb.jpg" />
        </div>
        <div className="pt-2">
          <Button onClick={handleCreate} disabled={creating}>
            {creating ? 'Creating...' : 'Create Public Stream Page'}
          </Button>
        </div>
      </div>
    </div>
  )
}
