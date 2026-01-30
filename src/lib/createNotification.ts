import { db } from '@/firebase/config'
import { collection, doc, setDoc } from 'firebase/firestore'

/**
 * Helper function to create a notification in Firestore.
 * Call this when a meaningful event happens (gift received, funds added, etc).
 */
export async function createNotification(
  userId: string,
  title: string,
  body: string,
  type?: 'payment' | 'voucher' | 'redemption' | 'admin',
  relatedId?: string
) {
  try {
    const notificationRef = doc(collection(db, 'notifications'))
    await setDoc(notificationRef, {
      userId,
      title,
      body,
      read: false,
      type: type || 'admin',
      relatedId: relatedId || null,
      createdAt: new Date(),
    })
    console.log(`✅ Notification created for user ${userId}: ${title}`)
    return notificationRef.id
  } catch (error) {
    console.error('Failed to create notification:', error)
    throw error
  }
}
