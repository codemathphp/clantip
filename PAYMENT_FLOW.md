# ClanTip Payment Flow - Complete Implementation

## Overview
The payment flow is now fully implemented with proper integration between Next.js frontend, Firebase backend, and Paystack payment gateway.

## Architecture

### 1. **Payment Initiation** (`/src/app/app/sender/page.tsx`)
- User fills out custom gift form with:
  - Recipient phone number
  - Gift message
  - Gift amount
- Form calculates fees:
  - Platform Fee: 5%
  - Processing Fee: 10%
  - Fixed Fee: $0.20
- On submit, stores checkout data in `sessionStorage`:
  ```javascript
  {
    baseAmount: 430.30,
    platformFee: 21.52,
    processingFee: 43.03,
    fixedFee: 0.20,
    total: 495.05,
    recipientPhone: "+27837500230",
    message: "Here is a little love"
  }
  ```
- Redirects to `/payment` route

### 2. **Payment Page** (`/src/app/payment/page.tsx`)
- Fetches user authentication state
- Loads checkout data from `sessionStorage`
- Validates recipient phone (prevents self-sends)
- **Fetches user email from Firestore** (`users/{phone}` collection)
- Loads Paystack script dynamically
- On script load, calls `initiatePayment()`
  - Uses stored email from user profile
  - Falls back to generated email if none stored
  - Logs: "✓ User email fetched from Firestore: {email}"
  - Calls `/api/payments/initialize` endpoint
  - Receives `authorization_url` from Paystack
  - **Redirects user to Paystack checkout**: `window.location.href = authorizationUrl`

### 3. **Payment Initialization API** (`/src/app/api/payments/initialize/route.ts`)
- Validates required fields: `email`, `amount`, `senderId`, `recipientId`
- Generates unique reference: `{timestamp}-{randomId}`
- Calls Paystack API via `initializePayment()` function
- Stores payment record in Firestore:
  ```
  payments/{reference}
  {
    reference: "1769397158018-fu2fbt5an",
    payerId: "user-id",
    amount: 43030,  // in kobo (cents)
    currency: "ZAR",
    status: "pending",
    paystackData: {...},
    createdAt: Timestamp
  }
  ```
- Returns response with:
  ```json
  {
    "success": true,
    "data": {
      "authorization_url": "https://checkout.paystack.com/4ul5zzl7zyqsg0w",
      "access_code": "4ul5zzl7zyqsg0w",
      "reference": "1769397158018-fu2fbt5an"
    }
  }
  ```

### 4. **Paystack Checkout**
- User redirected to: `https://checkout.paystack.com/{access_code}`
- User enters payment details or uses pre-authorized card
- Paystack processes payment
- On success/failure, user redirected to callback URL configured:
  - `http://localhost:3000/payment/callback?reference={reference}` (development)
  - `https://yourdomain.com/payment/callback?reference={reference}` (production)

### 5. **Payment Callback** (`/src/app/payment/callback/page.tsx`)
- Receives redirect with `?reference=` query parameter
- Authenticates user via Firebase
- Calls `/api/payments/verify` endpoint with reference
- Verification endpoint:
  - Calls Paystack API to verify payment status
  - Returns payment status (success/failed)
- **If successful**:
  - Creates voucher record in Firestore:
    ```
    vouchers/{voucherId}
    {
      id: "timestamp-random",
      senderId: "user-id",
      senderPhone: "+123...",
      recipientPhone: "+27837500230",
      amount: 43030,  // stored amount
      status: "delivered",
      message: "Here is a little love",
      createdAt: Timestamp,
      reference: "paystack-reference"
    }
    ```
  - Clears `sessionStorage`
  - Shows success message
  - Redirects to sender dashboard
- **If failed**:
  - Shows error message
  - Redirects to sender dashboard

### 6. **Webhook Handling** (`/src/app/api/webhooks/paystack/route.ts`)
- Receives Paystack events (charge.success, charge.failed, etc.)
- Verifies webhook signature with HMAC-SHA512
- **On charge.success**:
  - Updates payment status to "completed"
  - Creates voucher for recipient (if not created via callback)
  - Updates recipient wallet with available credits
  - Creates notifications for sender and recipient
- **On charge.failed**:
  - Updates payment status to "failed"
  - Records failure reason

## Key Files

### Frontend Files
- `src/app/payment/page.tsx` - Main payment processing page
- `src/app/payment/callback/page.tsx` - Callback handler after Paystack redirect
- `src/app/app/sender/page.tsx` - Gift form and sender dashboard

### API Endpoints
- `src/app/api/payments/initialize/route.ts` - Paystack initialization
- `src/app/api/payments/verify/route.ts` - Payment verification
- `src/app/api/webhooks/paystack/route.ts` - Webhook receiver

### Libraries & Utilities
- `src/lib/paystack.ts` - Paystack API wrapper functions
- Firebase Firestore for data storage
- react-hot-toast for notifications

## Configuration

### Environment Variables
```env
# Paystack Configuration
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_test_...
PAYSTACK_SECRET_KEY=sk_test_...
PAYSTACK_CALLBACK_URL=http://localhost:3000/payment/callback

# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
```

### Firestore Collections
- `users/{phone}` - User profiles with email
- `payments/{reference}` - Payment records
- `vouchers/{voucherId}` - Gift vouchers
- `wallets/{phone}` - User wallets

## Data Flow Summary

```
User fills gift form
  ↓
Stores in sessionStorage
  ↓
Navigate to /payment
  ↓
Fetch user email from Firestore
  ↓
Call /api/payments/initialize
  ↓
Paystack returns authorization_url
  ↓
Redirect to Paystack checkout
  ↓
User completes payment on Paystack
  ↓
Paystack redirects to /payment/callback?reference=...
  ↓
Verify payment via /api/payments/verify
  ↓
Create voucher in Firestore
  ↓
Show success message
  ↓
Webhook updates payment status (async)
```

## Testing

### Manual Test Steps
1. Navigate to http://localhost:3000
2. Login with phone OTP
3. Go to Gift tab
4. Fill form:
   - Recipient: Different phone number
   - Amount: Any amount
   - Message: Custom message
5. Click "Proceed to Payment"
6. Should be redirected to Paystack checkout
7. Use test card: `4111 1111 1111 1111`
8. Complete payment
9. Redirected back to callback page
10. Verify success message
11. Check Firestore for voucher creation

### Test Card Details
- Number: 4111 1111 1111 1111
- Expiry: Any future date (e.g., 12/25)
- CVV: Any 3 digits
- OTP: 123456 (or any code shown in test environment)

## Success Indicators

✅ Payment initialization returns 200 with authorization_url
✅ User redirects to Paystack checkout page
✅ Email fetched from Firestore user profile
✅ Payment record created in Firestore
✅ Voucher created after payment verification
✅ Callback page shows success/failure message
✅ Webhook processes payment events

## Error Handling

The system handles errors at multiple levels:
1. **Frontend**: Toast notifications for user feedback
2. **API**: Proper HTTP status codes and error messages
3. **Firestore**: Transaction-based operations for consistency
4. **Paystack**: Signature verification for webhook security

## Future Enhancements

- Email notifications to sender and recipient
- Payment receipt generation
- Batch payment retry logic
- Advanced analytics and reporting
- Multi-currency support
- Recurring payment options
