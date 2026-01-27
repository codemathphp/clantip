'use client'

import Link from 'next/link'
import { ArrowRight, Shield, Bell, DollarSign, CheckCircle } from 'lucide-react'

export default function HowItWorksPage(){
  const steps = [
    {
      number: '1',
      icon: DollarSign,
      title: 'Fund Your Account',
      description: 'Add funds to your ClanTip wallet using your preferred payment method. It\'s quick, secure, and takes just a few minutes.'
    },
    {
      number: '2',
      icon: Bell,
      title: 'Create a Support Voucher',
      description: 'Choose a recipient, set an amount, and add a personal message. Let them know you\'re thinking of them.'
    },
    {
      number: '3',
      icon: Shield,
      title: 'Recipient Receives Notification',
      description: 'Your recipient gets notified instantly via SMS and push notification. They can see the voucher details and amount.'
    },
    {
      number: '4',
      icon: CheckCircle,
      title: 'Funds Transfer to Bank',
      description: 'Recipient redeems the voucher and funds are transferred directly to their bank account. Money in hand within 24 hours.'
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">How It Works</h1>
          <p className="text-xl text-blue-50">Send support to your loved ones in just 4 simple steps</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        
        {/* Steps */}
        <div className="space-y-8 mb-16">
          {steps.map((step, idx) => {
            const Icon = step.icon
            return (
              <div key={idx} className="flex gap-6 md:gap-8">
                {/* Step Number */}
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white font-bold text-xl shadow-lg">
                    {step.number}
                  </div>
                </div>
                
                {/* Step Content */}
                <div className="flex-1 pt-2">
                  <div className="flex items-start gap-3 mb-2">
                    <Icon className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
                    <h3 className="text-2xl font-bold text-slate-900">{step.title}</h3>
                  </div>
                  <p className="text-lg text-slate-600 leading-relaxed ml-9">{step.description}</p>
                </div>

                {/* Arrow */}
                {idx < steps.length - 1 && (
                  <div className="hidden md:flex items-center -mr-6">
                    <ArrowRight className="w-6 h-6 text-blue-300 rotate-90" />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Features Section */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold mb-8 text-slate-900">Why This Works So Well</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-lg border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all">
              <h3 className="font-semibold text-slate-900 mb-3 text-lg">⚡ Lightning Fast</h3>
              <p className="text-slate-600">Notifications sent instantly. Funds transferred within 24 hours. No waiting around.</p>
            </div>
            <div className="p-6 rounded-lg border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all">
              <h3 className="font-semibold text-slate-900 mb-3 text-lg">🔒 Bank-Level Security</h3>
              <p className="text-slate-600">Your data is encrypted. All transactions are monitored for fraud. Your money is safe.</p>
            </div>
            <div className="p-6 rounded-lg border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all">
              <h3 className="font-semibold text-slate-900 mb-3 text-lg">🌍 Pan-African Coverage</h3>
              <p className="text-slate-600">Works across 25+ African countries. Send support to anyone, anywhere on the continent.</p>
            </div>
            <div className="p-6 rounded-lg border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all">
              <h3 className="font-semibold text-slate-900 mb-3 text-lg">💰 Transparent Pricing</h3>
              <p className="text-slate-600">No hidden fees. You see exactly what you're paying upfront. What you send is what they get.</p>
            </div>
          </div>
        </section>

        {/* FAQ-ish Section */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold mb-8 text-slate-900">Common Questions</h2>
          <div className="space-y-4">
            <details className="group border border-slate-200 rounded-lg p-6 hover:border-blue-300 cursor-pointer">
              <summary className="flex justify-between items-center font-semibold text-slate-900">
                What happens after I send the voucher?
                <span className="group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <p className="mt-4 text-slate-600">Your recipient receives an SMS and push notification with the voucher details. They can then redeem it directly to their bank account whenever they&apos;re ready.</p>
            </details>
            
            <details className="group border border-slate-200 rounded-lg p-6 hover:border-blue-300 cursor-pointer">
              <summary className="flex justify-between items-center font-semibold text-slate-900">
                How long does it take for funds to reach the recipient&apos;s bank?
                <span className="group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <p className="mt-4 text-slate-600">Most transfers complete within 24 hours. In some cases, it may take up to 48 hours depending on the recipient&apos;s bank and country.</p>
            </details>

            <details className="group border border-slate-200 rounded-lg p-6 hover:border-blue-300 cursor-pointer">
              <summary className="flex justify-between items-center font-semibold text-slate-900">
                Can I cancel a voucher after sending it?
                <span className="group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <p className="mt-4 text-slate-600">Yes! If the recipient hasn&apos;t redeemed it yet, you can cancel within 30 days and the funds will be returned to your account.</p>
            </details>

            <details className="group border border-slate-200 rounded-lg p-6 hover:border-blue-300 cursor-pointer">
              <summary className="flex justify-between items-center font-semibold text-slate-900">
                Which countries are supported?
                <span className="group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <p className="mt-4 text-slate-600">We support over 25 African countries including Nigeria, Kenya, Ghana, South Africa, Uganda, Tanzania, Ethiopia, Senegal, and many more. Check our website for the complete list.</p>
            </details>
          </div>
        </section>

        {/* CTA Section */}
        <section className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-8 border border-blue-200">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Ready to Get Started?</h2>
          <p className="text-slate-600 mb-6">It\'s that simple. In just a few minutes, you can send support to anyone in your family, anywhere across Africa.</p>
          <Link href="/" className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors">
            Send Support Now
          </Link>
        </section>
      </div>

      {/* Back to Home */}
      <div className="border-t border-slate-200 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <Link href="/" className="text-blue-600 hover:text-blue-700 font-semibold transition-colors">
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  )
}
