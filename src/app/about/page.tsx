'use client'

import Link from 'next/link'

export default function AboutPage(){
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">About ClanTip</h1>
        <p className="text-lg text-muted-foreground mb-4">ClanTip is a simple, secure platform for sending support vouchers to loved ones across Africa.</p>
        <p className="text-sm text-muted-foreground">Learn more about our mission and how we protect your data.</p>
        <div className="mt-6">
          <Link href="/" className="text-primary underline">Back to Home</Link>
        </div>
      </div>
    </div>
  )
}
