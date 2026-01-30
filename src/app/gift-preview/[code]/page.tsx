'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { db } from '@/firebase/config'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { Voucher } from '@/types'
import { Button } from '@/components/ui/button'
import { Gift, ArrowRight, Share2 } from 'lucide-react'
import Image from 'next/image'
import toast from 'react-hot-toast'

export default function GiftPreviewPage() {
  const router = useRouter()
  const params = useParams()
  const code = params.code as string
  
  const [voucher, setVoucher] = useState<Voucher | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchVoucher = async () => {
      try {
        if (!code) {
          setError('Invalid gift code')
          setLoading(false)
          return
        }

        const q = query(
          collection(db, 'vouchers'),
          where('code', '==', code.toUpperCase())
        )
        const snapshot = await getDocs(q)

        if (snapshot.empty) {
          setError('Gift not found or already claimed')
          setLoading(false)
          return
        }

        const voucherData = snapshot.docs[0].data() as Voucher
        setVoucher(voucherData)
        setLoading(false)
      } catch (err) {
        console.error('Error fetching voucher:', err)
        setError('Failed to load gift')
        setLoading(false)
      }
    }

    fetchVoucher()
  }, [code])

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`
  }

  const handleClaimGift = () => {
    // Store the gift code so it can be redeemed after login
    sessionStorage.setItem('pendingGiftCode', code)
    router.push('/auth')
  }

  const handleShareGift = async () => {
    const shareText = `I just received a ClanTip gift with Value Attached! 🎁\n\nClaim your gift:\n${window.location.href}`
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'You Received a ClanTip Gift!',
          text: shareText,
          url: window.location.href,
        })
        toast.success('Gift shared successfully!')
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error('Share error:', error)
        }
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(shareText)
        toast.success('Gift link copied to clipboard!')
      } catch (error) {
        console.error('Error copying:', error)
        toast.error('Failed to copy link')
      }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent"></div>
          <p className="mt-4 text-muted-foreground">Loading your gift...</p>
        </div>
      </div>
    )
  }

  if (error || !voucher) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="text-5xl mb-4">🎁</div>
          <h1 className="text-2xl font-bold mb-2">Gift Not Found</h1>
          <p className="text-muted-foreground mb-6">{error || 'This gift may have already been claimed or the link is invalid.'}</p>
          <Button onClick={() => router.push('/')} className="w-full">
            Back to Home
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
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
          <p className="text-sm text-muted-foreground">Gift Preview</p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Gift Card */}
          <div className="bg-white rounded-3xl p-8 border border-slate-200/50 shadow-lg">
            {/* Icon/Logo */}
            <div className="flex justify-center mb-8">
              <div className="w-24 h-24 bg-gradient-to-br from-primary/20 to-accent/20 rounded-2xl flex items-center justify-center">
                <Gift size={56} className="text-primary" />
              </div>
            </div>

            {/* Gift Message */}
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold mb-2">You Just Received a ClanTip Gift! 🎉</h1>
              <p className="text-lg text-muted-foreground">Someone sent you some love on ClanTip</p>
            </div>

            {/* Gift Amount */}
            <div className="bg-gradient-to-br from-green-500/10 to-green-600/10 rounded-2xl p-8 text-center mb-8 border border-green-200/50">
              <p className="text-sm text-muted-foreground mb-2">Gift Amount</p>
              <p className="text-5xl font-bold text-green-600">{formatCurrency(voucher.amount)}</p>
              <p className="text-sm text-muted-foreground mt-2">In Credits Waiting For You</p>
            </div>

            {/* Gift Details */}
            <div className="space-y-4 mb-8">
              <div className="flex items-center justify-between py-3 border-b border-slate-100">
                <span className="text-muted-foreground">Gift Code</span>
                <span className="font-mono font-bold text-primary">{voucher.code}</span>
              </div>

              {voucher.message && (
                <div className="py-3 border-b border-slate-100">
                  <p className="text-muted-foreground mb-2">Message from Sender</p>
                  <p className="italic text-foreground">"{voucher.message}"</p>
                </div>
              )}

              <div className="flex items-center justify-between py-3">
                <span className="text-muted-foreground">Status</span>
                <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm font-medium">
                  Ready to Claim
                </span>
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-8">
              <p className="text-sm text-blue-900">
                <span className="font-semibold">💡 What's Next?</span> Sign in or create a ClanTip account to claim your gift and start sending love to others!
              </p>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3 mb-6">
              <Button
                onClick={handleClaimGift}
                className="w-full h-14 rounded-2xl bg-gradient-to-r from-primary to-primary/80 text-base font-semibold"
              >
                <span>Claim Your Gift</span>
                <ArrowRight size={20} className="ml-2" />
              </Button>

              <Button
                onClick={handleShareGift}
                variant="outline"
                className="w-full h-12 rounded-2xl"
              >
                <Share2 size={18} className="mr-2" />
                Share This Gift
              </Button>
            </div>

            {/* Divider */}
            <div className="py-4 flex items-center gap-3">
              <div className="flex-1 border-t border-slate-200"></div>
              <span className="text-xs text-muted-foreground">Or</span>
              <div className="flex-1 border-t border-slate-200"></div>
            </div>

            {/* Learn More */}
            <button
              onClick={() => router.push('/')}
              className="w-full py-3 text-center text-primary font-medium hover:bg-primary/5 rounded-xl transition"
            >
              Learn More About ClanTip
            </button>
          </div>

          {/* How It Works */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/50">
            <h3 className="font-semibold mb-4 text-lg">How ClanTip Works</h3>
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold">
                  1
                </div>
                <div>
                  <p className="font-medium">Sign Up</p>
                  <p className="text-sm text-muted-foreground">Create your ClanTip account in seconds</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold">
                  2
                </div>
                <div>
                  <p className="font-medium">Claim Gifts</p>
                  <p className="text-sm text-muted-foreground">Receive and redeem gifts from friends</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold">
                  3
                </div>
                <div>
                  <p className="font-medium">Send Love</p>
                  <p className="text-sm text-muted-foreground">Share the love and send gifts to others</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
