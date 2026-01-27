/**
 * NOTIFICATION INTEGRATION EXAMPLES
 * 
 * This file shows how to integrate the notification system
 * into your existing payment and redemption flows.
 */

// ============================================
// EXAMPLE 1: Send notification on successful payment
// ============================================
// In: src/app/api/payments/verify/route.ts

/*
import { useNotificationService } from '@/hooks/useNotificationService'
import { db } from '@/firebase/config'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'

export async function POST(req: Request) {
  try {
    const { reference } = await req.json()
    
    // Verify with Paystack
    const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
      }
    })
    
    const data = await response.json()
    
    if (data.status && data.data.status === 'success') {
      const { amount, metadata } = data.data
      const { recipientId, recipientName, senderName } = metadata
      
      // Send notification to RECIPIENT that they received a gift
      await addDoc(collection(db, 'notifications'), {
        userId: recipientId,
        title: '🎁 New Gift Received!',
        body: `${senderName} sent you ${formatCurrency(amount)}`,
        type: 'voucher',
        read: false,
        createdAt: serverTimestamp(),
      })
      
      return Response.json({ success: true })
    }
  } catch (error) {
    console.error('Error:', error)
    return Response.json({ error: 'Verification failed' }, { status: 400 })
  }
}
*/

// ============================================
// EXAMPLE 2: Send notification from React Component
// ============================================
// In: src/app/app/sender/page.tsx or any dashboard

/*
import { useNotificationService } from '@/hooks/useNotificationService'

export function SendGiftComponent() {
  const { sendVoucherNotification } = useNotificationService()
  
  const handleSendGift = async () => {
    const recipientId = 'firebase-uid-of-recipient'
    const amount = 'R 500.00'
    const senderName = 'John Doe'
    const message = 'Happy Birthday!'
    
    // Send notification
    await sendVoucherNotification(recipientId, amount, senderName, message)
  }
  
  return <button onClick={handleSendGift}>Send Gift</button>
}
*/

// ============================================
// EXAMPLE 3: Send redemption status notifications
// ============================================
// In: Firebase Cloud Function or API route

/*
import { db } from '@/firebase/config'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'

export async function notifyRedemptionStatus(
  userId: string,
  amount: string,
  status: 'requested' | 'processing' | 'approved' | 'paid' | 'failed'
) {
  const titles = {
    requested: '📤 Withdrawal Requested',
    processing: '⏳ Withdrawal Processing',
    approved: '✅ Withdrawal Approved',
    paid: '✅ Withdrawal Completed',
    failed: '❌ Withdrawal Failed',
  }
  
  const bodies = {
    requested: `Your withdrawal of ${amount} has been received.`,
    processing: `Your withdrawal of ${amount} is being processed.`,
    approved: `Your withdrawal of ${amount} has been approved.`,
    paid: `Your withdrawal of ${amount} has been completed!`,
    failed: `Your withdrawal of ${amount} failed. Please contact support.`,
  }
  
  await addDoc(collection(db, 'notifications'), {
    userId,
    title: titles[status],
    body: bodies[status],
    type: 'redemption',
    read: false,
    createdAt: serverTimestamp(),
  })
}
*/

// ============================================
// EXAMPLE 4: Listen to notifications in component
// ============================================
// In: Any dashboard component

/*
import { useNotifications } from '@/context/NotificationContext'

export function NotificationDisplay() {
  const { notifications, unreadCount } = useNotifications()
  
  return (
    <div>
      <h2>You have {unreadCount} unread notifications</h2>
      {notifications.map(notif => (
        <div key={notif.id}>
          <h3>{notif.title}</h3>
          <p>{notif.body}</p>
        </div>
      ))}
    </div>
  )
}
*/

// ============================================
// EXAMPLE 5: Admin notifications
// ============================================
// For admin alerts, payment issues, etc.

/*
import { db } from '@/firebase/config'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'

export async function sendAdminNotification(
  adminUserId: string,
  title: string,
  body: string
) {
  await addDoc(collection(db, 'notifications'), {
    userId: adminUserId,
    title,
    body,
    type: 'admin',
    read: false,
    createdAt: serverTimestamp(),
  })
}

// Example usage:
// sendAdminNotification(
//   adminId,
//   '⚠️ Payment Failed',
//   'Payment from user failed: Insufficient funds'
// )
*/

export {}
