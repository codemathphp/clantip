'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { RecaptchaVerifier } from 'firebase/auth'
import { auth, db } from '@/firebase/config'
import { doc, getDoc } from 'firebase/firestore'
import { sendPhoneOTP, verifyOTP, createOrUpdateUser } from '@/firebase/auth'
import { formatPhone, formatPhoneForFirebase } from '@/lib/constants'
import toast from 'react-hot-toast'
import Image from 'next/image'

type Step = 'phone' | 'otp' | 'profile'

export default function AuthPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmationRes, setConfirmationRes] = useState<any>(null)
  const recaptchaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Setup recaptcha for phone auth
    let cleanup: (() => void) | undefined
    
    if (typeof window !== 'undefined' && !(window as any).recaptchaVerifier) {
      const timer = setTimeout(() => {
        try {
          const container = document.getElementById('recaptcha-container')
          if (container) {
            (window as any).recaptchaVerifier = new RecaptchaVerifier(
              auth,
              'recaptcha-container',
              {
                size: 'invisible',
                callback: () => console.log('✓ Recaptcha verified'),
                'error-callback': () => {
                  console.log('⚠ Recaptcha error')
                  ;(window as any).recaptchaVerifier = undefined
                },
              }
            )
            console.log('✓ Recaptcha initialized successfully')
          } else {
            console.error('❌ Recaptcha container not found in DOM')
          }
        } catch (error) {
          console.error('❌ Recaptcha setup error:', error)
        }
      }, 100) // Small delay to ensure DOM is ready
      
      cleanup = () => clearTimeout(timer)
    }
    
    return cleanup
  }, [])

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!phone || phone.length < 10) {
      toast.error('Please enter a valid phone number')
      return
    }

    setLoading(true)
    try {
      // Format phone for Firebase (E.164 format: +27XXXXXXXXX)
      const formattedPhone = formatPhoneForFirebase(phone)
      console.log('📞 Sending OTP to:', formattedPhone)
      
      // Add timeout to prevent hanging
      const otpPromise = sendPhoneOTP(
        formattedPhone,
        (window as any).recaptchaVerifier
      )
      
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('OTP request timed out. Check your internet connection.')), 15000)
      )
      
      const confirmation = await Promise.race([otpPromise, timeoutPromise])
      setConfirmationRes(confirmation)
      setPhone(formattedPhone) // Store formatted phone for later
      setStep('otp')
      toast.success('OTP sent to your phone')
    } catch (error: any) {
      console.error('❌ Error sending OTP:', error)
      console.error('Error code:', error.code)
      console.error('Error message:', error.message)
      
      // Provide specific error messages
      if (error.code === 'auth/invalid-phone-number') {
        toast.error('Invalid phone number. Use format: 0123456789 or +27123456789')
      } else if (error.code === 'auth/too-many-requests') {
        toast.error('Too many requests. Please try again later.')
      } else if (error.code === 'auth/invalid-app-credential') {
        // This usually means recaptcha token expired - try again
        toast.error('Recaptcha expired. Please try again.')
        console.log('🔄 Clearing recaptcha and reloading page...')
        ;(window as any).recaptchaVerifier = undefined
      } else if (error.message?.includes('auth/operation-not-supported-in-this-environment')) {
        toast.error('Phone auth not available. Check Firebase configuration.')
      } else if (error.message?.includes('timed out')) {
        toast.error('Request timed out. Check your internet and try again.')
      } else {
        toast.error(error.message || 'Failed to send OTP')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!otp || otp.length < 6) {
      toast.error('Please enter a valid OTP')
      return
    }

    setLoading(true)
    try {
      const user = await verifyOTP(confirmationRes, otp)
      const formattedPhone = formatPhone(phone)
      
      console.log('✓ OTP verified, User UID:', user.uid)
      console.log('✓ Formatted phone:', formattedPhone)
      
      // Check if user already exists in Firestore using phone as doc ID
      const userRef = doc(db, 'users', formattedPhone)
      console.log('✓ Checking Firestore at path: users/', formattedPhone)
      
      const userSnap = await getDoc(userRef)
      
      console.log('✓ Firestore query complete')
      console.log('✓ User exists in Firestore?', userSnap.exists())
      if (userSnap.exists()) {
        console.log('✓ User data:', userSnap.data())
      }
      
      if (userSnap.exists()) {
        // User exists, log them in directly
        console.log('✓ Existing user detected, redirecting to sender dashboard')
        router.push('/app/sender')
        toast.success('Welcome back!')
      } else {
        // New user, show profile step
        console.log('⚠ No user found in Firestore, showing profile form')
        setStep('profile')
        toast.success('Phone verified!')
      }
    } catch (error: any) {
      console.error('Error verifying OTP:', error)
      toast.error(error.message || 'Failed to verify OTP')
    } finally {
      setLoading(false)
    }
  }

  const handleCompleteProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName) {
      toast.error('Please enter your full name')
      return
    }

    setLoading(true)
    try {
      const user = auth.currentUser
      if (user) {
        await createOrUpdateUser(
          user.uid,
          formatPhone(phone),
          fullName,
          email || undefined
        )
        router.push('/app/sender')
        toast.success('Welcome to ClanTip!')
      }
    } catch (error: any) {
      console.error('Error completing profile:', error)
      toast.error(error.message || 'Failed to complete profile')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-accent/5 flex flex-col items-center justify-center p-4">
      {/* Recaptcha container - hidden but accessible */}
      <div 
        id="recaptcha-container" 
        ref={recaptchaRef} 
        style={{ position: 'absolute', visibility: 'hidden', width: '0', height: '0' }}
      ></div>

      {/* Header */}
      <div className="mb-8 text-center">
        <div className="flex items-center justify-center -mb-4">
          <div className="relative w-48 h-48">
            <Image
              src="/clantip_logo.png"
              alt="ClanTip Logo"
              fill
              className="object-contain"
            />
          </div>
     
        </div>
          <h1 className="text-3xl font-bold text-foreground">Welcome to ClanTip</h1>
          <p className="text-muted-foreground mt-1">Gift Credits the Smart Way</p>
        
        </div>

      {/* Auth Card */}
      <Card className="w-full max-w-md rounded-2xl border border-slate-200/50">
        {step === 'phone' && (
          <>
            <CardHeader>
              <CardTitle>Enter Your Phone Number</CardTitle>
              <CardDescription>
                We'll send you a one-time code to verify your number
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSendOTP} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+27 123 456 7890"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={loading}
                    className="rounded-2xl border-slate-200/50"
                  />
                  <p className="text-xs text-muted-foreground">
                    Include your country code (e.g., +27 for South Africa)
                  </p>
                </div>
                <Button
                  type="submit"
                  className="w-full rounded-2xl h-11"
                  disabled={loading}
                >
                  {loading ? 'Sending...' : 'Send Code'}
                </Button>
              </form>
            </CardContent>
          </>
        )}

        {step === 'otp' && (
          <>
            <CardHeader>
              <CardTitle>Verify Your Number</CardTitle>
              <CardDescription>
                Enter the 6-digit code we sent to {formatPhone(phone)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleVerifyOTP} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="otp">Verification Code</Label>
                  <Input
                    id="otp"
                    type="text"
                    placeholder="000000"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.slice(0, 6))}
                    maxLength={6}
                    disabled={loading}
                    className="text-center text-2xl tracking-widest rounded-2xl border-slate-200/50"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full rounded-2xl h-11"
                  disabled={loading}
                >
                  {loading ? 'Verifying...' : 'Verify Code'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full rounded-2xl h-11"
                  onClick={() => {
                    setStep('phone')
                    setOtp('')
                  }}
                  disabled={loading}
                >
                  Change Number
                </Button>
              </form>
            </CardContent>
          </>
        )}

        {step === 'profile' && (
          <>
            <CardHeader>
              <CardTitle>Complete Your Profile</CardTitle>
              <CardDescription>
                Help us know a bit about you
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCompleteProfile} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={loading}
                    className="rounded-2xl border-slate-200/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email (Optional)</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="john@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    className="rounded-2xl border-slate-200/50"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full rounded-2xl h-11"
                  disabled={loading}
                >
                  {loading ? 'Creating Account...' : 'Get Started'}
                </Button>
              </form>
            </CardContent>
          </>
        )}
      </Card>

      {/* Footer */}
      <p className="text-xs text-muted-foreground text-center mt-8 max-w-md">
        By signing up, you agree to our{' '}
        <a href="/terms" className="text-primary hover:underline">
          Terms of Service
        </a>{' '}
        and{' '}
        <a href="/privacy" className="text-primary hover:underline">
          Privacy Policy
        </a>
      </p>
    </div>
  )
}
