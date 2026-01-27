'use client'

import { Button } from '@/components/ui/button'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

export default function PrivacyPage() {
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
        <h1 className="text-4xl font-bold text-foreground mb-8">Privacy Policy</h1>

        <div className="space-y-6 text-muted-foreground leading-relaxed">
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">Introduction</h2>
            <p>
              ClanTip (&quot;we&quot; or &quot;us&quot; or &quot;our&quot;) operates the website.
              This page informs you of our policies regarding the collection, use, and disclosure
              of personal data when you use our service and the choices you have associated with that data.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">Information Collection and Use</h2>
            <p>We collect several different types of information for various purposes to provide and improve our service to you:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Phone number (for authentication)</li>
              <li>Full name</li>
              <li>Email address (optional)</li>
              <li>Bank account details (for redemption only)</li>
              <li>Transaction information</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">Security of Data</h2>
            <p>
              The security of your data is important to us, but remember that no method of transmission
              over the Internet or method of electronic storage is 100% secure. While we strive to use
              commercially acceptable means to protect your personal data, we cannot guarantee its absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">Privacy of Bank Details</h2>
            <p>
              Your bank account details are confidential and are only used for processing redemptions.
              Senders never have access to recipient bank details. All information is encrypted
              and stored securely in compliance with data protection regulations.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">Changes to This Privacy Policy</h2>
            <p>
              We may update our Privacy Policy from time to time. We will notify you of any changes
              by posting the new Privacy Policy on this page and updating the &quot;effective date&quot; at the
              top of this Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy, please contact us at
              privacy@clantip.com
            </p>
          </section>
        </div>
      </main>
    </div>
  )
}
