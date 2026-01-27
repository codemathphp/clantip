# Notification System Implementation Guide

## Overview
A complete in-app notification system with a dedicated notifications page and foundation for PWA/push notifications.

## Components Created

### 1. **NotificationContext** (`src/context/NotificationContext.tsx`)
- Manages notifications globally across the app
- Syncs with Firestore in real-time
- Provides hooks for marking as read, deleting, etc.

### 2. **NotificationCenter Component** (`src/components/NotificationCenter.tsx`)
- Bell icon with unread count badge
- Clicking navigates to dedicated notifications page
- Always visible in dashboard headers

### 3. **Notifications Page** (`src/app/app/notifications/page.tsx`)
- Dedicated full-page view for all notifications
- Type-based color coding (payment, voucher, redemption, admin)
- Individual notification actions (mark as read, delete)
- Bulk actions: mark all read, clear all
- Beautiful card-based layout with emojis
- Responsive design matching dashboard theme

### 4. **useNotificationService Hook** (`src/hooks/useNotificationService.ts`)
- Easy-to-use methods for sending notifications:
  - `sendNotification()` - Generic notification
  - `sendPaymentNotification()` - Payment-specific
  - `sendVoucherNotification()` - Voucher-specific
  - `sendRedemptionNotification()` - Redemption-specific

## Usage

### In React Components
```tsx
import { useNotificationService } from '@/hooks/useNotificationService'

export function MyComponent() {
  const { sendPaymentNotification } = useNotificationService()

  const handlePayment = async () => {
    // ... payment logic ...
    await sendPaymentNotification(
      userId,
      'R 500.00',
      'John Doe',
      'success'
    )
  }
}
```

### In API Routes (Server-side)
```tsx
// src/app/api/payments/verify/route.ts
import { db } from '@/firebase/config'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'

export async function POST(req: Request) {
  // ... payment verification ...

  // Send notification
  await addDoc(collection(db, 'notifications'), {
    userId: recipientId,
    title: '🎁 New Gift Received!',
    body: `${senderName} sent you R 500.00`,
    type: 'voucher',
    read: false,
    createdAt: serverTimestamp(),
  })
}
```

## Integration Points

### Current Integration
- ✅ Sender Dashboard Header - NotificationCenter bell icon
- ✅ Recipient Dashboard Header - NotificationCenter bell icon
- ✅ Global Provider - NotificationProvider in root layout
- ✅ Dedicated page at `/app/notifications`

### Recommended Next Steps

1. **Add to Payment Initialization**
   - When user sends a gift, trigger notification to recipient

2. **Add to Payment Callback**
   - When payment is verified, send payment status notifications

3. **Add to Redemption Flow**
   - When redemption is requested/processed, send notifications

4. **Add to Webhooks**
   - When Paystack webhooks confirm status changes, send notifications

## Firestore Schema

Notifications are stored in `notifications` collection:
```json
{
  "userId": "auth-uid",
  "title": "Payment Successful",
  "body": "You sent R 500 to John Doe",
  "type": "payment",
  "relatedId": "payment-id",
  "read": false,
  "createdAt": "timestamp"
}
```

## Notification Types & Icons

| Type | Icon | Color | Use Case |
|------|------|-------|----------|
| `payment` | 💳 | Blue | Payment confirmations |
| `voucher` | 🎁 | Green | Gift received |
| `redemption` | 📤 | Purple | Withdrawal updates |
| `admin` | ⚠️ | Red | System alerts |

## Features

- 🔔 Real-time notifications with Firestore sync
- 📱 Dedicated notifications page with full details
- 🎨 Type-based color coding and emoji icons
- ✅ Mark individual notifications as read
- 🗑️ Delete individual notifications or clear all
- ⏱️ Smart time display (just now, 2h ago, etc.)
- 📊 Unread count badge in header
- 🎯 Direct navigation from header to full page

## Future: PWA & Push Notifications

To extend this to native push notifications:

1. **Request Permission**
   - Use Notification API: `Notification.requestPermission()`

2. **Service Worker**
   - Register service worker to handle push events

3. **Web Push**
   - Send push via Firebase Cloud Messaging (FCM)

4. **Integration**
   - Keep `NotificationContext` as the in-app layer
   - Extend to also send web push via FCM

The current architecture makes this transition seamless - notifications already sync with Firestore, so adding FCM push is just adding a notification service that sends via FCM.

## Testing

1. Open app and navigate to dashboards
2. Click the bell icon to view notifications page
3. See notifications synced in real-time via Firestore
4. Test individual actions (mark as read, delete)
5. Test bulk actions (mark all read, clear all)
6. Unread count updates in header badge
