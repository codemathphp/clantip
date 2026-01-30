'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { auth, db } from '@/firebase/config'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { User } from '@/types'
import { Button } from '@/components/ui/button'
import toast from 'react-hot-toast'
import { ArrowLeft, Copy, Share2, QrCode } from 'lucide-react'
import QRCode from 'qrcode'

export default function ReceiveTipPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [qrCode, setQrCode] = useState<string>('')
  const [shareLink, setShareLink] = useState<string>('')

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser: any) => {
      if (!authUser) {
        router.push('/auth')
        return
      }

      try {
        const phone = authUser.phoneNumber
        const userRef = doc(db, 'users', phone)
        const userSnap = await getDoc(userRef)

        if (userSnap.exists()) {
          const userData = userSnap.data() as User
          setUser(userData)

          // Generate shareable link using handle (preferred) or phone
          const identifier = userData.handle ? `@${userData.handle}` : phone
          const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
          const link = `${baseUrl}/app/sender?to=${encodeURIComponent(identifier)}`
          setShareLink(link)

          // Generate QR code
          try {
            const qr = await QRCode.toDataURL(link, {
              width: 400,
              margin: 1,
            })
            setQrCode(qr)
          } catch (qrError) {
            console.error('QR generation error:', qrError)
            toast.error('Failed to generate QR code')
          }
        }
        setLoading(false)
      } catch (error) {
        console.error('Error fetching user:', error)
        toast.error('Failed to load user data')
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [router])

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink)
      toast.success('Link copied to clipboard!')
    } catch (error) {
      console.error('Error copying:', error)
      toast.error('Failed to copy link')
    }
  }

  const handleShare = async () => {
    const shareText = `Support me on ClanTip! Scan this link or QR code to send me a tip:\n\n${shareLink}`

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Receive Tip on ClanTip',
          text: shareText,
          url: shareLink,
        })
        toast.success('Shared successfully!')
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error('Share error:', error)
        }
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(shareText)
        toast.success('Share text copied to clipboard!')
      } catch (error) {
        console.error('Error copying:', error)
        toast.error('Failed to copy share text')
      }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-slate-200/50">
        <div className="px-4 py-3 flex items-center gap-3 max-w-2xl mx-auto">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-slate-100 rounded-lg transition"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-lg font-bold">Receive Tips</h1>
            <p className="text-xs text-muted-foreground">Share your QR code or link</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* QR Code Card */}
          <div className="bg-white rounded-3xl p-8 border border-slate-200/50 shadow-lg">
            <div className="flex flex-col items-center space-y-6">
              {/* QR Code Display */}
              <div className="bg-gradient-to-br from-primary/5 to-accent/5 rounded-2xl p-6 border-2 border-dashed border-primary/20">
                {qrCode ? (
                  <Image
                    src={qrCode}
                    alt="Receive QR Code"
                    width={256}
                    height={256}
                    className="w-64 h-64 mx-auto rounded-lg shadow-md"
                  />
                ) : (
                  <div className="w-64 h-64 flex items-center justify-center bg-slate-100 rounded-lg">
                    <QrCode size={64} className="text-muted-foreground/30" />
                  </div>
                )}
              </div>

              {/* User Info */}
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-1">Your receive identifier</p>
                <div className="bg-slate-50 rounded-xl px-4 py-3 inline-block">
                  <p className="font-bold text-lg">
                    {user?.handle ? (
                      <>
                        <span className="text-primary">@</span>
                        {user.handle}
                      </>
                    ) : (
                      user?.phone
                    )}
                  </p>
                </div>
                {user?.handle && (
                  <p className="text-xs text-muted-foreground mt-2">{user.phone}</p>
                )}
              </div>

              {/* Instructions */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 w-full">
                <p className="text-sm text-blue-900">
                  <span className="font-semibold">💡 How it works:</span> Share this QR code or link. When someone scans it, they can instantly send you a tip in ClanTip!
                </p>
              </div>

              {/* Action Buttons */}
              <div className="w-full space-y-3">
                <Button
                  onClick={handleShare}
                  className="w-full h-12 rounded-2xl bg-gradient-to-r from-primary to-primary/80"
                >
                  <Share2 size={18} className="mr-2" />
                  Share QR & Link
                </Button>

                <Button
                  onClick={handleCopyLink}
                  variant="outline"
                  className="w-full h-12 rounded-2xl"
                >
                  <Copy size={18} className="mr-2" />
                  Copy Link
                </Button>
              </div>
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-green-50 border border-green-200 rounded-2xl p-6">
            <h3 className="font-semibold text-sm text-green-900 mb-3">Benefits of sharing your QR code:</h3>
            <ul className="space-y-2 text-sm text-green-800">
              <li className="flex items-start gap-2">
                <span className="text-lg">✨</span>
                <span>Friends can send you tips instantly by scanning</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-lg">🔗</span>
                <span>Share on social media, WhatsApp, or anywhere</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-lg">⚡</span>
                <span>No app download needed for friends to send</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-lg">💰</span>
                <span>Receive tips in ClanTip instantly</span>
              </li>
            </ul>
          </div>

          {/* Share Link Display */}
          <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200/50">
            <p className="text-xs text-muted-foreground mb-2">Share this link:</p>
            <div className="bg-white rounded-lg p-3 border border-slate-200 break-all text-sm font-mono text-primary">
              {shareLink}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
