'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

export default function HelpPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center cursor-pointer" onClick={() => router.push('/')}>
            <div className="relative w-36 h-36">
              <Image
                src="/clantip_logo.png"
                alt="ClanTip Logo"
                fill
                className="object-contain"
              />
            </div>
          </div>
          <Button variant="outline" onClick={() => router.push('/')}>
            Back
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-4">Help & FAQ</h1>
          <p className="text-lg text-muted-foreground">
            Find answers to common questions about ClanTip
          </p>
        </div>

        {/* FAQ Sections */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>What is ClanTip?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-muted-foreground">
              <p>
                ClanTip is a digital value gifting platform that allows you to send Support Vouchers
                to people you care about. Recipients see the credits immediately and can redeem them
                to their bank account whenever they need it.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>How does gifting work?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-muted-foreground">
              <ol className="list-decimal list-inside space-y-2">
                <li>Purchase Credits using Paystack (secure payment)</li>
                <li>Create a Support Voucher for a recipient by entering their phone number</li>
                <li>Recipient receives instant notification</li>
                <li>They see the credits in their wallet immediately</li>
                <li>They can Redeem Credits to their bank account</li>
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>How long does redemption take?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-muted-foreground">
              <p>
                Most redemptions are processed within 24–48 hours. The exact timeline depends on
                your bank and our processing mode. You can track your redemption status in real-time.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Is my financial information safe?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-muted-foreground">
              <p>
                Yes. Senders never see recipient bank details. All payments are processed securely
                through Paystack, a trusted payment gateway. Your information is encrypted and
                protected.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>What if my redemption fails?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-muted-foreground">
              <p>
                If a redemption fails due to a bank issue or other problem, your credits will be
                automatically returned to your wallet. You&apos;ll receive a notification explaining
                the reason and can try again.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Can I change my bank account for redemption?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-muted-foreground">
              <p>
                Yes. You can update your bank account information when you request a redemption.
                Simply enter your current details when processing a new redemption request.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>What fees apply?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-muted-foreground">
              <p>
                Pricing information is displayed before any transaction. We&apos;re transparent about
                all fees upfront. Contact our support team for detailed pricing.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>How do I contact support?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-muted-foreground">
              <p>
                For support, please email us at support@clantip.com or use the help section in
                your account dashboard.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
