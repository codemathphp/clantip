import { db } from './config'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  Timestamp,
} from 'firebase/firestore'
import { Wallet, Payment, Voucher, Redemption, Notification, AuditLog } from '@/types'

// Wallet operations
export const getWallet = async (userId: string): Promise<Wallet | null> => {
  try {
    const walletRef = doc(db, 'wallets', userId)
    const walletSnap = await getDoc(walletRef)
    return walletSnap.exists() ? (walletSnap.data() as Wallet) : null
  } catch (error) {
    console.error('Error fetching wallet:', error)
    return null
  }
}

// Notification operations
export const createNotification = async (
  userId: string,
  title: string,
  body: string,
  type?: string,
  relatedId?: string
) => {
  try {
    const notifRef = doc(collection(db, 'notifications'))
    const notification: Notification = {
      id: notifRef.id,
      userId,
      title,
      body,
      read: false,
      type: type as any,
      relatedId,
      createdAt: new Date(),
    }
    await setDoc(notifRef, notification)
    return notification
  } catch (error) {
    console.error('Error creating notification:', error)
    return null
  }
}

export const getNotifications = async (userId: string) => {
  try {
    const q = query(collection(db, 'notifications'), where('userId', '==', userId))
    const querySnapshot = await getDocs(q)
    return querySnapshot.docs.map(doc => doc.data() as Notification)
  } catch (error) {
    console.error('Error fetching notifications:', error)
    return []
  }
}

// Audit log operations
export const createAuditLog = async (
  actorId: string,
  action: string,
  targetType: string,
  targetId: string,
  payload?: Record<string, any>
) => {
  try {
    const logRef = doc(collection(db, 'auditLogs'))
    const auditLog: AuditLog = {
      id: logRef.id,
      actorId,
      action: action as any,
      targetType: targetType as any,
      targetId,
      payload,
      createdAt: new Date(),
    }
    await setDoc(logRef, auditLog)
    return auditLog
  } catch (error) {
    console.error('Error creating audit log:', error)
    return null
  }
}

// Voucher operations
export const getVouchers = async (userId: string, role: 'sender' | 'recipient') => {
  try {
    let q
    if (role === 'sender') {
      q = query(collection(db, 'vouchers'), where('senderId', '==', userId))
    } else {
      q = query(collection(db, 'vouchers'), where('recipientId', '==', userId))
    }
    const querySnapshot = await getDocs(q)
    return querySnapshot.docs.map(doc => doc.data() as Voucher)
  } catch (error) {
    console.error('Error fetching vouchers:', error)
    return []
  }
}

// Redemption operations
export const getRedemptions = async (userId: string) => {
  try {
    const q = query(collection(db, 'redemptions'), where('userId', '==', userId))
    const querySnapshot = await getDocs(q)
    return querySnapshot.docs.map(doc => doc.data() as Redemption)
  } catch (error) {
    console.error('Error fetching redemptions:', error)
    return []
  }
}

export const getAllRedemptions = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, 'redemptions'))
    return querySnapshot.docs.map(doc => doc.data() as Redemption)
  } catch (error) {
    console.error('Error fetching all redemptions:', error)
    return []
  }
}
