import { useNotifications } from '@/context/NotificationContext'
import { auth, db } from '@/firebase/config'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'

export function useNotificationService() {
  const { addNotification } = useNotifications()

  const sendNotification = async (
    userId: string,
    title: string,
    body: string,
    type?: 'payment' | 'voucher' | 'redemption' | 'admin',
    relatedId?: string
  ) => {
    try {
      // Add to Firestore for persistence and real-time sync
      const notificationsCollection = collection(db, 'notifications')
      await addDoc(notificationsCollection, {
        userId,
        title,
        body,
        type: type || 'admin',
        relatedId,
        read: false,
        createdAt: serverTimestamp(),
      })

      // Also add to local state immediately if current user
      if (userId === auth.currentUser?.uid) {
        addNotification({
          userId,
          title,
          body,
          type: type || 'admin',
          relatedId,
          read: false,
        })
      }
    } catch (error) {
      console.error('Error sending notification:', error)
    }
  }

  const sendPaymentNotification = (
    userId: string,
    amount: string,
    recipientName: string,
    status: 'success' | 'pending' | 'failed'
  ) => {
    const titles = {
      success: '💳 Payment Successful',
      pending: '⏳ Payment Processing',
      failed: '❌ Payment Failed',
    }
    const bodies = {
      success: `You sent ${amount} to ${recipientName}. They'll receive it shortly.`,
      pending: `Your payment of ${amount} to ${recipientName} is being processed.`,
      failed: `Payment of ${amount} to ${recipientName} failed. Please try again.`,
    }

    return sendNotification(userId, titles[status], bodies[status], 'payment')
  }

  const sendVoucherNotification = (
    userId: string,
    amount: string,
    senderName: string,
    message?: string
  ) => {
    const title = '🎁 New Gift Received!'
    const body = message
      ? `${senderName} sent you a support voucher worth ${amount} with message: "${message}"`
      : `${senderName} sent you a support voucher worth ${amount}!`

    return sendNotification(userId, title, body, 'voucher')
  }

  const sendRedemptionNotification = (
    userId: string,
    amount: string,
    status: 'requested' | 'processing' | 'approved' | 'paid' | 'failed'
  ) => {
    const titles = {
      requested: '📤 Withdrawal Requested',
      processing: '⏳ Withdrawal Processing',
      approved: '✅ Withdrawal Approved',
      paid: '✅ Withdrawal Completed',
      failed: '❌ Withdrawal Failed',
    }
    const bodies = {
      requested: `Your withdrawal of ${amount} has been received and is awaiting processing.`,
      processing: `Your withdrawal of ${amount} is being processed.`,
      approved: `Your withdrawal of ${amount} has been approved.`,
      paid: `Your withdrawal of ${amount} has been completed and sent to your account.`,
      failed: `Your withdrawal of ${amount} failed. Please contact support.`,
    }

    return sendNotification(userId, titles[status], bodies[status], 'redemption')
  }

  return {
    sendNotification,
    sendPaymentNotification,
    sendVoucherNotification,
    sendRedemptionNotification,
  }
}
