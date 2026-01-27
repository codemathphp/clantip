'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { auth, db } from '@/firebase/config'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, getDocs } from 'firebase/firestore'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Image from 'next/image'

export default function Home() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user: any) => {
      if (user) {
        // Get user role and redirect
        router.push('/app/sender')
      } else {
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [router])

  const [heroBg, setHeroBg] = useState<string>('')

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const snap = await getDocs(collection(db, 'settings'))
        if (!snap.empty) {
          const s = snap.docs[0].data() as any
          if (s.heroBackgroundUrl) setHeroBg(s.heroBackgroundUrl)
        }
      } catch (err) {
        console.error('Failed loading settings:', err)
      }
    }
    loadSettings()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-accent/5 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      {/* Header */}
      <header className="border-b border-slate-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-between">
          <div className="flex items-center">
            <div className="relative w-24 h-24">
              <Image
                src="/clantip_logo.png"
                alt="ClanTip Logo"
                fill
                className="object-contain"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button onClick={() => router.push('/store')} variant="outline">
              Shop
            </Button>
            <Button onClick={() => router.push('/about')} variant="ghost">
              About
            </Button>
            <Button onClick={() => router.push('/how-it-works')} variant="ghost">
              How it works
            </Button>
            <Button onClick={() => router.push('/auth')} variant="default">
              Sign In
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 relative"
        style={
          heroBg
            ? {
                backgroundImage: `url(${heroBg})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : undefined
        }
      >
        {heroBg && <div className="absolute inset-0 bg-black/30 pointer-events-none rounded-2xl" />}
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <div>
              <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-4">
                Gift Love Across Borders
              </h1>
              <p className="text-xl text-muted-foreground">
                Send Support Vouchers to loved ones in <span className="font-semibold text-foreground">Nigeria, Ghana, Kenya & South Africa</span>. They see the credits immediately and can redeem whenever they need it.
              </p>
            </div>

            <div className="space-y-4 pt-4">
              <div className="flex gap-3">
                <div className="flex-shrink-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10">
                    <span className="text-lg">💳</span>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Easy Payments</h3>
                  <p className="text-sm text-muted-foreground">Multiple secure payment options available</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10">
                    <span className="text-lg">⚡</span>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Instant Delivery</h3>
                  <p className="text-sm text-muted-foreground">Recipients see credits immediately</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10">
                    <span className="text-lg">🔐</span>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Safe & Secure</h3>
                  <p className="text-sm text-muted-foreground">Your financial details stay private</p>
                </div>
              </div>
            </div>

            <Button
              onClick={() => router.push('/auth')}
              size="lg"
              className="w-full sm:w-auto text-base rounded-2xl"
            >
              Get Started
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-6">
            <Card className="border-slate-200/50 rounded-2xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span>💳</span> Send Credits
                </CardTitle>
                <CardDescription>
                  For Senders
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>• Purchase credits in a few taps</p>
                <p>• Create a Support Voucher with a personal message</p>
                <p>• Recipient gets instant notification</p>
                <p>• Track status in real-time</p>
              </CardContent>
            </Card>

            <Card className="border-slate-200/50 rounded-2xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span>💰</span> Redeem Credits
                </CardTitle>
                <CardDescription>
                  For Recipients
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>• Receive vouchers instantly</p>
                <p>• See your credit balance anytime</p>
                <p>• Redeem to your bank account</p>
                <p>• Fast, secure processing</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Supported Countries Section */}
      <section className="bg-white/50 border-y border-slate-200/50 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
          <div>
            <h2 className="text-3xl font-bold text-foreground mb-2">
              Sending Love Across Africa
            </h2>
            <p className="text-lg text-muted-foreground">
              Support loved ones in these countries with just a few taps
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="p-6 bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl border border-slate-200/50">
              <div className="text-4xl mb-2">🇿🇦</div>
              <h3 className="font-semibold">South Africa</h3>
              <p className="text-xs text-muted-foreground">ZAR</p>
            </div>
            <div className="p-6 bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl border border-slate-200/50">
              <div className="text-4xl mb-2">🇳🇬</div>
              <h3 className="font-semibold">Nigeria</h3>
              <p className="text-xs text-muted-foreground">NGN</p>
            </div>
            <div className="p-6 bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl border border-slate-200/50">
              <div className="text-4xl mb-2">🇰🇪</div>
              <h3 className="font-semibold">Kenya</h3>
              <p className="text-xs text-muted-foreground">KES</p>
            </div>
            <div className="p-6 bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl border border-slate-200/50">
              <div className="text-4xl mb-2">🇬🇭</div>
              <h3 className="font-semibold">Ghana</h3>
              <p className="text-xs text-muted-foreground">GHS</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t border-slate-200/50 bg-primary/5 py-16 mt-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <h2 className="text-3xl font-bold text-foreground">
            Ready to start gifting?
          </h2>
          <p className="text-lg text-muted-foreground">
            Join thousands of users who trust ClanTip for secure, instant value gifting.
          </p>
          <Button
            onClick={() => router.push('/auth')}
            size="lg"
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-2xl"
          >
            Create Account
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200/50 py-8 bg-background/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-muted-foreground">
          <p>© 2026 ClanTip. All rights reserved. | <a href="/terms" className="text-primary hover:underline">Terms</a> | <a href="/privacy" className="text-primary hover:underline">Privacy</a></p>
        </div>
      </footer>
    </div>
  )
}
