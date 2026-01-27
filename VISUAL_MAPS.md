# ClanTip - Visual Project Maps

## User Journey Map

```
┌─────────────────────────────────────────────────────────────────┐
│                         LANDING PAGE                             │
│                    "Gift Credits the Smart Way"                  │
│                                                                   │
│              [Get Started]  [Sign In]  [Help]  [Terms]           │
└──────────────────┬──────────────────────────┬────────────────────┘
                   │                          │
        ┌──────────▼──────────┐   ┌──────────▼──────────┐
        │   NEW USER SIGNUP   │   │    EXISTING USER    │
        │  (Phone OTP Flow)   │   │      (Auto-Login)   │
        └──────────┬──────────┘   └──────────┬──────────┘
                   │                         │
                   ▼                         ▼
        ┌──────────────────────────────────────────┐
        │   ROLE SELECTION (Implicit or Explicit)  │
        │   └─ Sender                              │
        │   └─ Recipient                           │
        │   └─ Admin                               │
        └──────────────────────────────────────────┘
                   │
        ┌──────────┼──────────┐
        │          │          │
    ┌───▼──┐  ┌────▼──┐  ┌───▼──┐
    │Send  │  │Receive│  │Admin │
    │Gift  │  │Credit │  │Queue │
    └──────┘  └───────┘  └──────┘
```

## Sender User Flow

```
SENDER DASHBOARD
├─ [Gift Credits] Button
│  └─ Gift Modal Opens
│     ├─ Recipient Phone Input
│     ├─ Amount Input
│     ├─ Message (Optional)
│     └─ [Proceed to Payment] Button
│        └─ Paystack Checkout Modal
│           ├─ Card Details
│           ├─ Payment Processing
│           └─ Confirmation
│              └─ Webhook Processing
│                 └─ Voucher Created ✓
│
├─ View Gift History (Table)
│  ├─ Recipient Phone
│  ├─ Amount
│  ├─ Status Badge (Delivered, Paid, etc)
│  └─ Date
│
└─ Stats Cards
   ├─ Total Sent
   ├─ Pending (Not Redeemed)
   └─ Redeemed (Paid)
```

## Recipient User Flow

```
RECIPIENT DASHBOARD
├─ Wallet Cards
│  ├─ Available Credits (Teal highlight)
│  └─ Pending Credits
│
├─ [Redeem Credits] Button
│  └─ Redemption Form
│     ├─ Amount Input
│     ├─ Bank Selection Dropdown
│     ├─ Account Number
│     ├─ Account Name
│     └─ [Submit] Button
│        └─ Create Redemption Request
│           └─ Credits: available → pending
│
├─ Vouchers Received
│  ├─ Card List
│  ├─ Amount & Message
│  ├─ Status Badge
│  └─ Date
│
└─ Redemption History (Table)
   ├─ Amount
   ├─ Status (Req'd, Processing, Paid, Failed)
   ├─ Method
   └─ Date
```

## Admin User Flow

```
ADMIN DASHBOARD
├─ KPI Cards (Top)
│  ├─ Total Users
│  ├─ Total Payments
│  ├─ Total Vouchers
│  └─ Pending Redemptions (Red Alert)
│
├─ Payout Configuration
│  ├─ Current Mode: DEFERRED_PAYOUT
│  └─ SLA: "24-48 hours"
│
├─ Redemption Queue (Table)
│  ├─ User
│  ├─ Amount
│  ├─ Bank Details (Masked)
│  ├─ Status
│  ├─ Date
│  └─ Actions
│     ├─ [Approve] → Paystack Transfer
│     │  └─ Status: Processing
│     │     └─ Webhook: Transfer Success
│     │        └─ Status: Paid ✓
│     │
│     └─ [Reject] → Reversed
│        └─ Credits Returned to Available
│           └─ Notification Sent
│
└─ Audit Logs (Hidden/Export)
   ├─ Actor (Admin ID)
   ├─ Action (Approve/Reject)
   ├─ Target (Redemption ID)
   └─ Timestamp
```

## Payment Processing Sequence

```
Timeline: Payment Flow

T+0s   Sender clicks [Proceed to Payment]
       │
T+0s   → POST /api/payments/initialize
       │  (amount, recipient, senderId)
       │
T+0.5s → Paystack returns checkout URL
       │  Payment modal opens
       │
T+0.5s Sender enters card details
       │  Card validation
       │  Card charged
       │
T+2s   Payment successful
       │  Paystack triggers webhook
       │
T+2.5s → POST /api/webhooks/paystack
       │  Event: charge.success
       │  Verify signature: ✓
       │  Check idempotency: ✓
       │
T+3s   Atomic Firestore Transaction
       │  ├─ Create payment record
       │  ├─ Create voucher
       │  ├─ Update wallet (+credits)
       │  └─ Create notifications
       │
T+3s   Recipient receives:
       │  ├─ Notification
       │  └─ Voucher in wallet
       │
T+3s   Sender receives:
       │  └─ Success confirmation
       │
T+4s   [END] Payment flow complete
```

## Redemption Processing Sequence

```
Timeline: Redemption Flow

T+0s   Recipient clicks [Redeem Credits]
       │
T+0s   Form validation
       │  └─ Available >= Amount ✓
       │
T+0.5s → POST /api/redemptions/request
       │  (amount, bankCode, account)
       │
T+1s   Atomic Transaction:
       │  ├─ Move available → pending
       │  ├─ Create redemption (Req'd)
       │  └─ Create notification
       │
T+2s   Recipient sees:
       │  ├─ Status: "Redemption Requested"
       │  └─ Wallet updated (pending ↑)
       │
─────────────────────────────────
Admin Actions (May occur hours/days later)
─────────────────────────────────
T+day Admin sees in queue
      │
T+day Admin clicks [Approve]
      │
T+day → POST /api/redemptions/approve
      │  │
T+day → Paystack API: Create Recipient
      │  └─ Gets: recipient_code
      │
T+day → Paystack API: Initiate Transfer
      │  └─ Gets: transfer_code
      │  └─ Updates redemption status
      │
T+day Recipient sees:
      │  └─ Status: "Processing"
      │
─────────────────────────────────
Paystack Processing (Backend)
─────────────────────────────────
T+day+X Paystack processes transfer
        │
T+day+X Transfer completes
        │
T+day+X → POST /api/webhooks/paystack
        │  Event: transfer.success
        │  Verify signature: ✓
        │
T+day+X Atomic Transaction:
        │  ├─ Update redemption (Paid)
        │  ├─ Reduce pending credits
        │  └─ Create notification
        │
T+day+X Recipient receives:
        │  ├─ Notification: "Payment Complete"
        │  ├─ Wallet updated
        │  └─ Bank transfer in progress
        │
T+day+X [END] Redemption complete
```

## Security Flow

```
┌─────────────────────────────────────────────────┐
│           INCOMING REQUEST                      │
└──────────────────┬──────────────────────────────┘
                   │
        ┌──────────▼──────────┐
        │ AUTHENTICATION      │
        │ Firebase ID Token   │
        │ Valid? → Continue   │
        │ Invalid? → 401      │
        └──────────┬──────────┘
                   │
        ┌──────────▼──────────┐
        │ AUTHORIZATION       │
        │ Check Firestore     │
        │ rules               │
        │ Allowed? → Continue │
        │ Denied? → 403       │
        └──────────┬──────────┘
                   │
        ┌──────────▼──────────┐
        │ WEBHOOK VERIFICATION│
        │ (if webhook)        │
        │ Verify HMAC SHA512  │
        │ Valid? → Continue   │
        │ Invalid? → 401      │
        └──────────┬──────────┘
                   │
        ┌──────────▼──────────┐
        │ IDEMPOTENCY CHECK   │
        │ Reference exists?   │
        │ Yes → Return cached │
        │ No → Process        │
        └──────────┬──────────┘
                   │
        ┌──────────▼──────────┐
        │ FIRESTORE RULES     │
        │ Collection allowed? │
        │ Field allowed?      │
        │ Yes → Write success │
        │ No → Permission err │
        └──────────┬──────────┘
                   │
        ┌──────────▼──────────┐
        │ AUDIT LOGGING       │
        │ Log action          │
        │ Actor, Action, When │
        └──────────┬──────────┘
                   │
        ┌──────────▼──────────┐
        │ RESPONSE            │
        │ 200 Success         │
        │ 4xx Client error    │
        │ 5xx Server error    │
        └─────────────────────┘
```

## Database Structure Map

```
Firestore Database
│
├─ users/
│  └─ {uid}
│     ├─ phone ──────────────┐
│     ├─ fullName            │
│     ├─ email               │
│     ├─ role (sender/recipient/admin)
│     └─ status
│
├─ wallets/
│  └─ {userId}
│     ├─ availableCredits ◄──┼─ Can be redeemed
│     ├─ pendingCredits ◄────┼─ In processing
│     └─ updatedAt
│
├─ payments/
│  └─ {reference}
│     ├─ payerId ────────────────────────────┐
│     ├─ amount                              │
│     ├─ status (successful/failed)          │
│     └─ paystackData (receipt)              │
│
├─ vouchers/
│  └─ {voucherId}
│     ├─ paymentRef ◄─────────────────┐
│     ├─ senderId ◄──────────────────┬┤
│     ├─ recipientId ◄─────────────┬─┤├─ Links
│     ├─ amount                    │ │
│     ├─ message                   │ │
│     └─ status (delivered/paid)   │ │
│                                  │ │
├─ redemptions/                    │ │
│  └─ {redemptionId}               │ │
│     ├─ userId ────────────────┼─┘ │
│     ├─ amount                 │   │
│     ├─ method (bank_account)  │   │
│     ├─ details (bank info)    │   │
│     ├─ status (paid/failed)   │   │
│     ├─ recipientCode (Paystack)  │
│     └─ transferCode (Paystack)   │
│                                  │
├─ notifications/                  │
│  └─ {notifId}                    │
│     ├─ userId                    │
│     ├─ title                     │
│     ├─ body                      │
│     ├─ read                      │
│     └─ relatedId ─────────────┬──┤
│                              (voucher/redemption)
│
└─ auditLogs/
   └─ {logId}
      ├─ actorId (admin)
      ├─ action (approve/reject)
      ├─ targetType (redemption)
      ├─ targetId ──────────────┘
      └─ timestamp

Legend: ► Link/Reference | ◄ Referenced by
```

## Component Hierarchy

```
<App>
├─ <Header>
│  ├─ Logo
│  ├─ Navigation
│  └─ UserMenu [Sign Out]
│
├─ <Main>
│  ├─ [Landing] /
│  │  ├─ <Hero>
│  │  ├─ <Features>
│  │  └─ <CTA>
│  │
│  ├─ [Auth] /auth
│  │  ├─ <PhoneForm>
│  │  ├─ <OTPForm>
│  │  └─ <ProfileForm>
│  │
│  ├─ [Sender] /app/sender
│  │  ├─ <StatsCards>
│  │  ├─ <GiftModal>
│  │  │  └─ <GiftForm>
│  │  └─ <VoucherTable>
│  │
│  ├─ [Recipient] /app/recipient
│  │  ├─ <WalletCards>
│  │  ├─ <RedeemModal>
│  │  │  └─ <BankForm>
│  │  ├─ <VoucherList>
│  │  └─ <RedemptionTable>
│  │
│  ├─ [Admin] /admin
│  │  ├─ <KPICards>
│  │  └─ <RedemptionQueue>
│  │
│  └─ [Pages] /help, /terms, /privacy
│
├─ <Toast Notifications>
│  └─ (Powered by react-hot-toast)
│
└─ <Footer>
   ├─ Links
   └─ Copyright
```

## Technology Stack Diagram

```
┌─────────────────────────────────────────────────┐
│           USER BROWSERS                         │
│       (Chrome, Safari, Firefox)                 │
└──────────────────┬──────────────────────────────┘
                   │ HTTPS/TLS
                   │
┌──────────────────▼──────────────────────────────┐
│    VERCEL EDGE NETWORK (Global CDN)             │
│   - Next.js App Router                          │
│   - React 18 with TypeScript                    │
│   - Tailwind CSS + shadcn/ui                    │
│   - React Hot Toast                            │
└──────────────────┬──────────────────────────────┘
                   │ HTTPS/TLS
                   │
    ┌──────────────┼──────────────┐
    │              │              │
┌───▼──────┐  ┌────▼──────┐  ┌───▼──────┐
│ Firebase │  │  Paystack  │  │  Webhooks│
│ (BaaS)   │  │  API       │  │ (Incoming)
│          │  │            │  │          │
│ ├─ Auth  │  │ ├─ Charge  │  │ ├─ Events│
│ ├─ DB    │  │ │  Init    │  │ ├─ Sig.  │
│ └─ Rules │  │ │          │  │ │ Verify │
│          │  │ ├─ Transfer│  │ └─ Atomic│
│          │  │ │  Create  │  │          │
│          │  │ └─ Verify  │  │          │
└──────────┘  └────────────┘  └──────────┘

Firestore Collections:
├─ users (Auth)
├─ wallets
├─ payments
├─ vouchers
├─ redemptions
├─ notifications
└─ auditLogs
```

## Error Handling Flow

```
┌─────────────────────────────┐
│      ERROR OCCURS           │
├─────────────────────────────┤
│ Try/Catch Block             │
└──────────────┬──────────────┘
               │
       ┌───────▼────────┐
       │ Error Type?    │
       └┬──────────┬──┬──┬───┐
        │          │  │  │   │
    ┌───▼──┐  ┌───▼──┐ │  │  └─────────────────┐
    │Auth  │  │DB    │ │  │                    │
    │Error │  │Error │ │  └───────────┐        │
    └──┬───┘  └──┬───┘ │          ┌───▼──┐     │
       │         │     │      ┌───▼──┐  │     │
       │      ┌──▼──┐  │  ┌───▼──┐  │  │     │
   401 │  403 │500  │  │  │400   │  │  │  ┌──▼──┐
       │  │   │Error│  │  │Error │  │  │  │5xx  │
       │  │   └──┬──┘  │  └──┬───┘  │  │  │     │
       │  │      │     │     │      │  │  │     │
    ┌──▼──▼──┬───▼─────▼─────▼──┬───▼──▼──▼──┐ │
    │ Toast  │ Toast Message    │ Log to     │ │
    │ Error  │ (User Facing)    │ Firebase   │ │
    │ UI     │                  │ Analytics  │ │
    └──┬─────┴──────────────────┴────────┬───┘ │
       │                                 │    │
    ┌──▼─────────────────────────────────▼──┬─┘
    │ Audit Log Entry (if admin action)    │
    │ - Actor, Action, Error Details      │
    │ - Timestamp                         │
    └─────────────────────────────────────┘
```

---

These visual maps provide a quick reference for understanding the project's user flows, data structures, and technical architecture.
