# ClanTip - Digital Value Gifting Platform

A production-ready MVP for sending and redeeming digital value through Support Vouchers.

## Overview

ClanTip is a secure digital value gifting platform built with:

- **Frontend**: Next.js 15 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Firebase (Auth, Firestore, Cloud Functions)
- **Payments**: Paystack (Pay-ins & Transfers)
- **Hosting**: Vercel (Frontend), Firebase (Backend)

## Core Features

### For Senders
- Purchase Credits via Paystack
- Create Support Vouchers for recipients (by phone)
- Personal messages included
- Real-time status tracking
- Transaction history

### For Recipients
- Instant credit delivery
- Credit wallet management
- Redeem Credits to bank account (South Africa)
- Multiple redemption status tracking
- Transaction history

### For Admins
- Redemption queue management
- Approval/rejection actions
- KPI dashboard
- Audit logging
- Payout mode configuration

## Architecture

### User Flows

**Pay-In (Sender)**
1. Sender purchases Credits via Paystack checkout
2. Paystack webhook confirms payment
3. Support Voucher created, recipient notified
4. Recipient wallet updated instantly

**Redemption (Recipient)**
1. Recipient requests to redeem available credits
2. Credits move from available → pending
3. Admin approves redemption
4. Paystack transfer initiated
5. Recipient receives payment notification

### Firestore Collections

```
users/
  ├── id: uid
  ├── phone: string
  ├── fullName: string
  ├── email: string (optional)
  ├── role: 'sender' | 'recipient' | 'admin'
  ├── status: 'active' | 'suspended' | 'deleted'
  └── createdAt, updatedAt: Date

wallets/
  ├── userId: string (doc id)
  ├── availableCredits: number (ZAR cents)
  ├── pendingCredits: number (ZAR cents)
  └── updatedAt: Date

payments/
  ├── reference: string (Paystack ref, doc id)
  ├── payerId: string
  ├── amount: number (ZAR cents)
  ├── currency: 'ZAR'
  ├── status: 'pending' | 'successful' | 'failed'
  ├── paystackData: object
  └── createdAt, updatedAt: Date

vouchers/
  ├── id: string (doc id)
  ├── paymentRef: string
  ├── senderId: string
  ├── recipientId: string
  ├── amount: number (ZAR cents)
  ├── message: string (optional)
  ├── status: 'delivered' | 'redeemed' | 'paid' | 'failed' | 'reversed'
  └── createdAt, updatedAt: Date

redemptions/
  ├── id: string (doc id)
  ├── userId: string
  ├── amount: number (ZAR cents)
  ├── method: 'bank_account' | 'mobile_wallet'
  ├── details: { bankCode, accountNumber, accountName }
  ├── status: 'redemption_requested' | 'processing' | 'approved' | 'paid' | 'failed' | 'reversed'
  ├── recipientCode: string (Paystack transfer recipient code)
  ├── transferCode: string (Paystack transfer code)
  ├── failureReason: string (optional)
  └── createdAt, updatedAt: Date

notifications/
  ├── id: string (doc id)
  ├── userId: string
  ├── title: string
  ├── body: string
  ├── read: boolean
  ├── type: 'payment' | 'voucher' | 'redemption' | 'admin'
  ├── relatedId: string (optional)
  └── createdAt: Date

auditLogs/
  ├── id: string (doc id)
  ├── actorId: string
  ├── action: 'create' | 'update' | 'delete' | 'approve' | 'reject' | 'process'
  ├── targetType: 'user' | 'payment' | 'voucher' | 'redemption' | 'wallet'
  ├── targetId: string
  ├── payload: object (optional)
  └── createdAt: Date
```

## Setup Instructions

### 1. Prerequisites

- Node.js 18+
- Firebase project
- Paystack account
- Vercel account (for deployment)

### 2. Clone & Install

```bash
git clone <repository>
cd clantip_app
npm install
```

### 3. Environment Variables

Create `.env.local`:

```env
# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Paystack
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=your_paystack_public_key
PAYSTACK_SECRET_KEY=your_paystack_secret_key

# Payout Configuration
NEXT_PUBLIC_PAYOUT_MODE=DEFERRED_PAYOUT  # or SAME_DAY_PAYOUT, FAST_PAYOUT
PAYOUT_MIN_THRESHOLD=10000  # in ZAR cents

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

### 4. Firebase Setup

#### Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create new project: "ClanTip"
3. Enable Firestore Database
4. Enable Authentication (Phone)
5. Create service account for Cloud Functions

#### Firestore Security Rules

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Default deny all
    match /{document=**} {
      allow read, write: if false;
    }

    // Users collection
    match /users/{uid} {
      allow read, write: if request.auth.uid == uid;
      allow read: if request.auth.uid != null && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    // Wallets collection
    match /wallets/{uid} {
      allow read: if request.auth.uid == uid;
      allow read: if request.auth.uid != null && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    // Payments collection
    match /payments/{document=**} {
      allow read: if request.auth.uid != null && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
      allow write: if request.auth != null;
    }

    // Vouchers collection
    match /vouchers/{document=**} {
      allow read: if request.auth.uid != null && (
        resource.data.senderId == request.auth.uid ||
        resource.data.recipientId == request.auth.uid ||
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin'
      );
    }

    // Redemptions collection
    match /redemptions/{document=**} {
      allow read, write: if request.auth.uid != null && (
        resource.data.userId == request.auth.uid ||
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin'
      );
      allow create: if request.auth.uid != null;
    }

    // Notifications collection
    match /notifications/{document=**} {
      allow read, write: if request.auth.uid == resource.data.userId;
    }

    // Audit logs (admin only)
    match /auditLogs/{document=**} {
      allow read: if request.auth.uid != null && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
      allow write: if false;
    }
  }
}
```

#### Firebase Deploy
```bash
npm install -g firebase-tools
firebase login
firebase init
firebase deploy
```

### 5. Paystack Configuration

#### Setup Webhook
1. Go to Paystack Dashboard → Settings → API Keys & Webhooks
2. Add webhook endpoint: `https://yourdomain.com/api/webhooks/paystack`
3. Select events:
   - `charge.success`
   - `transfer.success`
   - `transfer.failed`
   - `transfer.reversed`
4. Copy your webhook signing secret (use for verification)

#### Enable Transfers
1. Complete business verification in Paystack
2. Enable Transfers in settings
3. Ensure sufficient balance for payouts

### 6. Development

```bash
npm run dev
```

Visit `http://localhost:3000`

### 7. Deployment

#### Vercel (Frontend)
```bash
vercel
# or connect GitHub for auto-deploy
```

#### Firebase (Backend/Functions)
```bash
firebase deploy
```

## API Routes

### Webhooks

**POST** `/api/webhooks/paystack`
- Receives Paystack events
- Verifies HMAC SHA512 signature
- Handles: charge.success, transfer.success, transfer.failed, transfer.reversed
- Implements idempotency via event deduplication

## Payout Modes

Configure via `NEXT_PUBLIC_PAYOUT_MODE` environment variable:

| Mode | SLA | Description |
|------|-----|-------------|
| `DEFERRED_PAYOUT` | 24-48 hours | Default. Manual batch processing |
| `SAME_DAY_PAYOUT` | Same business day | Requires admin trigger |
| `FAST_PAYOUT` | ~1 hour | Premium tier, requires verification |

## Security

### Key Protections

1. **Phone OTP Authentication**: Firebase Phone Auth with Recaptcha
2. **Firestore Rules**: Role-based access control, user isolation
3. **Payment Verification**: All payments verified via Paystack webhook (never frontend)
4. **Webhook Signature Verification**: HMAC SHA512
5. **Idempotency**: Transaction-level locks prevent double-pay
6. **Audit Logging**: All admin actions logged
7. **PII Protection**: Bank details never visible to senders

### Sensitive Data Handling

- Bank account numbers: Hashed/masked in logs
- Phone numbers: Firestore-indexed for recipient lookup
- Payment references: Used as idempotency keys
- Email: Optional, never displayed publicly

## Monitoring & Logging

### Audit Logs
- All admin actions recorded
- Includes: actor, action, target, timestamp, payload
- Filterable by user, action type, date range

### Error Handling
- Failed webhooks stored in `auditLogs` collection
- Retry mechanism for transient failures
- Manual retry available in admin UI

## Common Issues & Troubleshooting

### "Failed to send OTP"
- Verify Recaptcha setup in Firebase
- Check phone number format (should include country code)

### "Payment successful but voucher not created"
- Check webhook endpoint configuration in Paystack
- Verify Paystack secret key in `.env.local`
- Check Firestore rules allow webhook writes

### "Redemption stuck in Processing"
- Admin may not have approved
- Paystack balance may be insufficient
- Check audit logs for transfer failures

### "Bank transfer failed"
- Verify bank details accuracy
- Check Paystack transfer recipient creation
- Ensure Paystack account is KYC-verified

## Support

For issues or questions:
- Email: support@clantip.com
- Help page: `/help`

## License

Proprietary - ClanTip 2026

## Terminology

### Approved Terms
- Credits
- Support Voucher
- Gift Credits
- Redeem Credits
- Redemption Request
- Processing
- Approved
- Paid
- Failed
- Reversed

### Forbidden Terms
- ~~Cashout~~, ~~Instant money~~, ~~Send money~~, ~~Remittance~~, ~~Withdrawal~~, ~~Transfer money~~
