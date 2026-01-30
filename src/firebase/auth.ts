import { auth, db } from './config'
import {
  signInWithPhoneNumber,
  RecaptchaVerifier,
  PhoneAuthProvider,
  signInWithCredential,
} from 'firebase/auth'
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  Timestamp,
} from 'firebase/firestore'
import { User, UserRole } from '@/types'

export const setupRecaptcha = (elementId: string) => {
  if (!window.recaptchaVerifier) {
    window.recaptchaVerifier = new RecaptchaVerifier(
      auth,
      elementId,
      {
        size: 'invisible',
        callback: () => {},
      }
    )
  }
  return window.recaptchaVerifier
}

export const sendPhoneOTP = async (phoneNumber: string, recaptchaVerifier: any) => {
  try {
    console.log('🔄 Starting OTP send process...')
    console.log('📱 Phone:', phoneNumber)
    console.log('🛡️ Recaptcha verifier:', recaptchaVerifier ? 'Ready' : 'Missing')
    
    if (!recaptchaVerifier) {
      throw new Error('Recaptcha verifier not initialized')
    }
    
    const appVerifier = recaptchaVerifier
    console.log('📡 Calling Firebase signInWithPhoneNumber...')
    
    const confirmationResultResult = await signInWithPhoneNumber(
      auth,
      phoneNumber,
      appVerifier
    )
    
    console.log('✅ OTP sent successfully!')
    console.log('📧 Confirmation result:', confirmationResultResult ? 'Received' : 'Empty')
    
    // IMPORTANT: Clear recaptcha verifier after use so fresh token is generated next time
    ;(window as any).recaptchaVerifier = undefined
    
    return confirmationResultResult
  } catch (error: any) {
    console.error('❌ Error sending OTP:', error)
    console.error('Error code:', error.code)
    console.error('Error message:', error.message)
    console.error('Full error:', error)
    
    // Reset recaptcha on error too
    ;(window as any).recaptchaVerifier = undefined
    
    throw error
  }
}

export const verifyOTP = async (
  confirmationResult: any,
  otp: string
) => {
  try {
    const result = await confirmationResult.confirm(otp)
    return result.user
  } catch (error) {
    console.error('Error verifying OTP:', error)
    throw error
  }
}

export const createOrUpdateUser = async (
  uid: string,
  phone: string,
  fullName: string,
  email?: string,
  role: UserRole = 'sender'
) => {
  try {
    // Write canonical user document keyed by UID. This ensures email-only sign-ins
    // don't try to write an empty doc ID and that `phone` is always present.
    const userRef = doc(db, 'users', uid)
    const userSnap = await getDoc(userRef)

    const normalizedPhone = phone || ''

    if (!userSnap.exists()) {
      console.log('Creating new canonical user (users/{uid}) with phone:', normalizedPhone)
      const newUser: User = {
        id: uid,
        phone: normalizedPhone,
        fullName,
        email,
        role,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      await setDoc(userRef, newUser)

      // Backfill legacy users/{phone} doc for backward compatibility when phone provided
      if (normalizedPhone) {
        try {
          const legacyRef = doc(db, 'users', normalizedPhone)
          await setDoc(legacyRef, { ...newUser, phoneE164: normalizedPhone })
        } catch (e) {
          console.warn('Failed to write legacy users/{phone} doc', e)
        }

        // Create wallet keyed by phone
        if (role !== 'admin') {
          const walletRef = doc(db, 'wallets', normalizedPhone)
          await setDoc(walletRef, {
            userId: uid,
            phone: normalizedPhone,
            availableCredits: 0,
            pendingCredits: 0,
            updatedAt: Timestamp.now(),
          })
        }

        // Create index docs
        try {
          const uidIndexRef = doc(db, 'uid_index', uid)
          await setDoc(uidIndexRef, { phoneE164: normalizedPhone })
          const phoneIndexRef = doc(db, 'phone_index', normalizedPhone)
          await setDoc(phoneIndexRef, { uid })
        } catch (e) {
          console.warn('Failed to write index docs', e)
        }
      }

      return newUser
    } else {
      // Update existing canonical user
      console.log('Updating existing canonical user users/{uid}:', uid)
      const userDoc = userSnap.data() as User
      await updateDoc(userRef, {
        id: uid,
        fullName,
        email,
        phone: normalizedPhone,
        updatedAt: new Date(),
      })

      // If phone provided, ensure legacy and index docs exist
      if (normalizedPhone) {
        try {
          const legacyRef = doc(db, 'users', normalizedPhone)
          await setDoc(legacyRef, { ...(userDoc as any), phoneE164: normalizedPhone })
          const uidIndexRef = doc(db, 'uid_index', uid)
          await setDoc(uidIndexRef, { phoneE164: normalizedPhone })
          const phoneIndexRef = doc(db, 'phone_index', normalizedPhone)
          await setDoc(phoneIndexRef, { uid })
        } catch (e) {
          console.warn('Failed to ensure legacy/index docs on update', e)
        }
      }

      return {
        ...userDoc,
        id: uid,
        fullName,
        email,
        phone: normalizedPhone,
        updatedAt: new Date(),
      }
    }
  } catch (error) {
    console.error('Error creating/updating user:', error)
    throw error
  }
}

export const getUserData = async (uid: string): Promise<User | null> => {
  try {
    const userRef = doc(db, 'users', uid)
    const userSnap = await getDoc(userRef)
    return userSnap.exists() ? (userSnap.data() as User) : null
  } catch (error) {
    console.error('Error fetching user:', error)
    return null
  }
}
