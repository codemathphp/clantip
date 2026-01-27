'use client'

import { Button } from '@/components/ui/button'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

export default function TermsPage() {
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
        <h1 className="text-4xl font-bold text-foreground mb-8">Terms of Service</h1>

        <div className="space-y-6 text-muted-foreground leading-relaxed">
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing and using ClanTip, you accept and agree to be bound by the terms and
              provision of this agreement. If you do not agree to abide by the above, please do
              not use this service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">2. Use License</h2>
            <p>
              Permission is granted to temporarily download one copy of the materials (information
              or software) on ClanTip for personal, non-commercial transitory viewing only. This is
              the grant of a license, not a transfer of title, and under this license you may not:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Modifying or copying the materials</li>
              <li>Using the materials for any commercial purpose or for any public display</li>
              <li>Attempting to reverse engineer any software contained on the platform</li>
              <li>Removing any copyright or other proprietary notations from the materials</li>
              <li>Transferring the materials to another person or &quot;mirroring&quot; on any other server</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">3. Disclaimer</h2>
            <p>
              The materials on ClanTip are provided on an &apos;as is&apos; basis. ClanTip makes no
              warranties, expressed or implied, and hereby disclaims and negates all other warranties
              including, without limitation, implied warranties or conditions of merchantability, fitness
              for a particular purpose, or non-infringement of intellectual property or other violation
              of rights.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">4. Limitations</h2>
            <p>
              In no event shall ClanTip or its suppliers be liable for any damages (including, without
              limitation, damages for loss of data or profit, or due to business interruption) arising out
              of the use or inability to use the materials on ClanTip.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">5. Accuracy of Materials</h2>
            <p>
              The materials appearing on ClanTip could include technical, typographical, or photographic
              errors. ClanTip does not warrant that any of the materials on our website are accurate,
              complete, or current. ClanTip may make changes to the materials contained on its website
              at any time without notice.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">6. Modifications</h2>
            <p>
              ClanTip may revise these terms of service for its website at any time without notice.
              By using this website, you are agreeing to be bound by the then current version of
              these terms of service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">7. Governing Law</h2>
            <p>
              These terms and conditions are governed by and construed in accordance with the laws
              of South Africa, and you irrevocably submit to the exclusive jurisdiction of the courts
              in that location.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">Contact Us</h2>
            <p>
              If you have any questions about these Terms of Service, please contact us at
              support@clantip.com
            </p>
          </section>
        </div>
      </main>
    </div>
  )
}
