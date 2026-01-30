'use client'

import Link from 'next/link'
import { Heart, Shield, Globe, Zap } from 'lucide-react'

export default function AboutPage(){
  const values = [
    { icon: Heart, title: 'Community First', desc: 'We believe in strengthening connections between families across continents' },
    { icon: Shield, title: 'Security & Trust', desc: 'Your data is encrypted and protected with enterprise-grade security standards' },
    { icon: Globe, title: 'African Focus', desc: 'Built specifically for African communities to support each other across borders' },
    { icon: Zap, title: 'Fast & Reliable', desc: 'Quick transfers and real-time notifications keep everyone in the loop' }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">About ClanTip</h1>
          <p className="text-xl text-emerald-50">Empowering African families to support each other, no matter the distance</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        
        {/* Mission Section */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold mb-6 text-slate-900">Our Mission</h2>
          <p className="text-lg text-slate-600 leading-relaxed mb-4">
            ClanTip is a modern financial platform designed to bridge the gap between loved ones across Africa. We make it incredibly simple and secure to send financial support to family and friends, turning the concept of &quot;tipping&quot; into a meaningful way to show care and solidarity.
          </p>
          <p className="text-lg text-slate-600 leading-relaxed">
            Whether it&apos;s supporting a relative back home, helping a friend through a tough time, or celebrating a special occasion, ClanTip puts the power of instant financial support in your hands.
          </p>
        </section>

        {/* Values Section */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold mb-8 text-slate-900">Our Values</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {values.map((value, idx) => {
              const Icon = value.icon
              return (
                <div key={idx} className="flex gap-4 p-6 rounded-lg border border-slate-200 hover:border-emerald-300 hover:shadow-md transition-all">
                  <Icon className="w-8 h-8 text-emerald-600 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-semibold text-slate-900 mb-2">{value.title}</h3>
                    <p className="text-slate-600">{value.desc}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* Why ClanTip Section */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold mb-6 text-slate-900">Why ClanTip?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 bg-emerald-50 rounded-lg">
              <div className="text-2xl font-bold text-emerald-600 mb-2">50K+</div>
              <p className="text-slate-600">Users across Africa sending support daily</p>
            </div>
            <div className="p-6 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600 mb-2">$10M+</div>
              <p className="text-slate-600">Transferred to loved ones since launch</p>
            </div>
            <div className="p-6 bg-teal-50 rounded-lg">
              <div className="text-2xl font-bold text-teal-600 mb-2">25+</div>
              <p className="text-slate-600">African countries supported</p>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="bg-gradient-to-r from-emerald-50 to-blue-50 rounded-lg p-8 border border-emerald-200">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Ready to Support Your Loved Ones?</h2>
          <p className="text-slate-600 mb-6">Join thousands of Africans already using ClanTip to strengthen family bonds across borders.</p>
          <Link href="/" className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors">
            Get Started Now
          </Link>
        </section>
      </div>

      {/* Back to Home */}
      <div className="border-t border-slate-200 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <Link href="/" className="text-emerald-600 hover:text-emerald-700 font-semibold transition-colors">
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  )
}
