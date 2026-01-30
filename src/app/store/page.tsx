'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Image from 'next/image'
import toast from 'react-hot-toast'

const VOUCHER_PACKAGES = [
  { id: 1, amount: 10, label: '$10', popular: false },
  { id: 2, amount: 25, label: '$25', popular: false },
  { id: 3, amount: 50, label: '$50', popular: true },
  { id: 4, amount: 100, label: '$100', popular: false },
  { id: 5, amount: 250, label: '$250', popular: false },
  { id: 6, amount: 500, label: '$500', popular: false },
]

export default function StorePage() {
  const router = useRouter()
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null)
  const [recipientPhone, setRecipientPhone] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  // Fee calculation: 5% platform fee + 10% processing fee + $0.20 fixed fee
  const calculateTotal = (amount: number) => {
    const platformFee = amount * 0.05
    const processingFee = amount * 0.10
    const fixedFee = 0.20
    return {
      baseAmount: amount,
      platformFee: parseFloat(platformFee.toFixed(2)),
      processingFee: parseFloat(processingFee.toFixed(2)),
      fixedFee: fixedFee,
      total: parseFloat((amount + platformFee + processingFee + fixedFee).toFixed(2)),
    }
  }

  const feeBreakdown = selectedAmount ? calculateTotal(selectedAmount) : null

  const handleCheckout = async () => {
    if (!selectedAmount) {
      toast.error('Please select a voucher amount')
      return
    }

    if (!recipientPhone || recipientPhone.length < 10) {
      toast.error('Please enter a valid phone number')
      return
    }

    // Note: Self-send validation will occur during payment processing
    // after user authentication when their phone number is available

    setLoading(true)
    try {
      // Store the checkout data in sessionStorage for the payment flow
      sessionStorage.setItem(
        'pendingCheckout',
        JSON.stringify({
          baseAmount: selectedAmount,
          ...feeBreakdown,
          recipientPhone,
          message,
          timestamp: Date.now(),
        })
      )

      // Redirect to auth if not logged in, or to payment if logged in
      router.push('/auth?redirect=payment')
      toast.success('Redirecting to checkout...')
    } catch (error) {
      console.error('Checkout error:', error)
      toast.error('Checkout failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div 
            className="flex items-center cursor-pointer" 
            onClick={() => router.push('/')}
          >
            <div className="relative w-10 h-10">
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
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold text-foreground mb-4">ClanTip Store</h1>
          <p className="text-xl text-muted-foreground">
            Choose a preset amount and send instantly to anyone
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-12">
          {/* Voucher Selection */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Select Voucher Amount</CardTitle>
                <CardDescription>Choose a preset amount to send</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  {VOUCHER_PACKAGES.map((pkg) => (
                    <div key={pkg.id} className="relative">
                      <Button
                        onClick={() => setSelectedAmount(pkg.amount)}
                        variant={selectedAmount === pkg.amount ? 'default' : 'outline'}
                        className="w-full h-24 text-lg font-semibold flex flex-col items-center justify-center gap-2"
                      >
                        {pkg.popular && (
                          <Badge className="absolute top-2 right-2 bg-accent text-black">
                            Popular
                          </Badge>
                        )}
                        <span>{pkg.label}</span>
                      </Button>
                    </div>
                  ))}
                </div>

                {selectedAmount && feeBreakdown && (
                  <div className="p-4 bg-primary/10 rounded-lg space-y-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Voucher Amount</p>
                      <p className="text-2xl font-bold text-primary">${feeBreakdown.baseAmount.toFixed(2)}</p>
                    </div>
                    <div className="border-t border-primary/20 pt-3 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Platform Fee (5%)</span>
                        <span className="font-medium">${feeBreakdown.platformFee.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Processing Fee (10%)</span>
                        <span className="font-medium">${feeBreakdown.processingFee.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Fixed Fee</span>
                        <span className="font-medium">${feeBreakdown.fixedFee.toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="border-t border-primary/20 pt-3 flex justify-between">
                      <span className="font-semibold">Total You Pay</span>
                      <span className="text-2xl font-bold text-accent">${feeBreakdown.total.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Recipient Details */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Send To</CardTitle>
                <CardDescription>Enter recipient details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="phone">Recipient Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+27 123 456 7890"
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    disabled={loading}
                  />
                  <p className="text-xs text-muted-foreground">
                    Include country code (e.g., +27 for South Africa)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Message (Optional)</Label>
                  <textarea
                    id="message"
                    placeholder="Add a personal message..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    disabled={loading}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                    rows={4}
                  />
                </div>

                <div className="space-y-4 p-4 bg-accent/10 rounded-lg">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Voucher Amount</span>
                    <span className="font-semibold">${selectedAmount || '0.00'}</span>
                  </div>
                  {feeBreakdown && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Fees</span>
                        <span className="font-medium">${(feeBreakdown.platformFee + feeBreakdown.processingFee + feeBreakdown.fixedFee).toFixed(2)}</span>
                      </div>
                      <div className="border-t border-accent/30 pt-3 flex justify-between font-bold">
                        <span>Total to Charge</span>
                        <span className="text-lg text-accent">${feeBreakdown.total.toFixed(2)}</span>
                      </div>
                    </>
                  )}
                  <Button
                    onClick={handleCheckout}
                    size="lg"
                    className="w-full text-base"
                    disabled={!selectedAmount || !recipientPhone || loading}
                  >
                    {loading ? 'Processing...' : 'Proceed to Checkout'}
                  </Button>
                </div>

                <div className="text-xs text-muted-foreground text-center space-y-1">
                  <p>🔒 Secure payment via Card Payment</p>
                  <p>⚡ Recipient gets instant notification</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Features Section */}
        <div className="mt-16 grid md:grid-cols-3 gap-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span>💳</span> Easy Payment
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Secure checkout with Card Payment. No hidden fees.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span>⚡</span> Instant Delivery
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Recipient gets notification immediately. No waiting.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span>🔐</span> Secure
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Your information is encrypted and never shared.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
