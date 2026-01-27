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
    // Use phone as document ID for easier lookup
    const userRef = doc(db, 'users', phone)
    const userSnap = await getDoc(userRef)

    if (!userSnap.exists()) {
      console.log('Creating new user with phone:', phone)
      const newUser: User = {
        id: uid,
        phone,
        fullName,
        email,
        role,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      await setDoc(userRef, newUser)

      // Create wallet for sender/recipient
      if (role !== 'admin') {
        const walletRef = doc(db, 'wallets', phone)
        await setDoc(walletRef, {
          userId: uid,
          phone,
          availableCredits: 0,
          pendingCredits: 0,
          updatedAt: Timestamp.now(),
        })
      }
      return newUser
    } else {
      // Update existing user
      console.log('Updating existing user with phone:', phone)
      const userDoc = userSnap.data() as User
      await updateDoc(userRef, {
        id: uid,
        fullName,
        email,
        updatedAt: new Date(),
      })

      return {
        ...userDoc,
        id: uid,
        fullName,
        email,
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
