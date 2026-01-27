'use client'

import Link from 'next/link'

export default function HowItWorksPage(){
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">How It Works</h1>
        <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
          <li>Buy credits using Paystack</li>
          <li>Create a Support Voucher for a recipient</li>
          <li>Recipient gets notified and can redeem credits to their bank</li>
        </ol>
        <div className="mt-6">
          <Link href="/" className="text-primary underline">Back to Home</Link>
        </div>
      </div>
    </div>
  )
}
