# ClanTip Architecture & Technical Design

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   End Users (Web)                       │
│         Browsers → HTTPS → Vercel CDN                   │
└──────────────────────┬──────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
    ┌───▼──┐      ┌────▼──┐     ┌───▼──┐
    │Send  │      │Redeem │     │Admin │
    │Gift  │      │Credits│     │Queue │
    └───┬──┘      └────┬──┘     └───┬──┘
        │              │            │
        └──────────────┼────────────┘
                       │
        ┌──────────────▼──────────────┐
        │  Next.js 15 Frontend (SPA)  │
        │  - App Router               │
        │  - TypeScript               │
        │  - Tailwind CSS             │
        │  - shadcn/ui Components     │
        └──────────────┬──────────────┘
                       │
        ┌──────────────▼──────────────────────────────┐
        │        API Routes (/app/api)                │
        │  ┌─────────────────────────────────────┐   │
        │  │ /payments/initialize                │   │
        │  │ /redemptions/request                │   │
        │  │ /redemptions/approve                │   │
        │  │ /webhooks/paystack                  │   │
        │  └─────────────────────────────────────┘   │
        └──────────────┬──────────────────────────────┘
                       │
        ┌──────────────┼──────────────────────┐
        │              │                      │
    ┌───▼──────┐ ┌────▼─────┐        ┌───────▼──┐
    │ Firebase │ │ Paystack  │        │  Third   │
    │ Auth +   │ │  Payment  │        │  Party   │
    │ Firestore│ │  Gateway  │        │ Webhooks │
    └──────────┘ └───────────┘        └──────────┘
```

## Component Architecture

### Frontend Layer (Next.js)

#### Pages (Route Handlers)
- **/ (Landing)**: Marketing page, auth CTAs
- **/auth**: Phone OTP authentication flow
- **/app/sender**: Sender dashboard (gift credits, history)
- **/app/recipient**: Recipient dashboard (wallet, redemptions)
- **/admin**: Admin queue management, approvals
- **/help**: FAQs and troubleshooting
- **/terms, /privacy**: Legal pages

#### API Routes (Backend Logic)
- **POST /api/payments/initialize**: Create Paystack transaction
- **POST /api/redemptions/request**: Submit redemption request
- **POST /api/redemptions/approve**: Admin approval + transfer
- **POST /api/webhooks/paystack**: Webhook processing

#### Components (UI)
- Reusable shadcn/ui components (Button, Card, Input, etc)
- Layout components (Header, Sidebar, etc)
- Form components (Phone input, OTP input, Bank form)

### Backend Layer (Firebase)

#### Authentication (Firebase Auth)
- Phone OTP provider
- Custom claims for roles (sender, recipient, admin)
- Session management via ID tokens

#### Database (Firestore)
Collections:
- **users**: Account info, roles, status
- **wallets**: Credit balances (available, pending)
- **payments**: Transaction records, Paystack data
- **vouchers**: Sent gifts (sender → recipient)
- **redemptions**: Payout requests with status
- **notifications**: In-app messages
- **auditLogs**: Admin actions & compliance

#### Security Rules
Role-based access control:
- Users can only access their own data
- Admins can access all data
- Senders never see recipient bank details

### Integration Layer (Paystack)

#### Payment Processing
1. **Initialize**: `/charges/initialize` → checkout URL
2. **Verify**: `/transaction/verify/{reference}`
3. **Webhook**: Paystack → /api/webhooks/paystack

#### Transfer Processing
1. **Create Recipient**: `/transferrecipient` → recipient_code
2. **Initiate Transfer**: `/transfer` with recipient_code
3. **Verify**: `/transfer/{transfer_code}`

## Data Flow Diagrams

### Payment (Pay-In) Flow

```
┌─────────────┐
│Sender opens │
│Gift modal   │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────┐
│1. POST /api/payments/initialize     │
│   - amount, recipient, message      │
└──────┬──────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│2. Paystack checkout modal opens     │
│   - User enters card details        │
│   - Paystack validates              │
│   - Paystack charges card           │
└──────┬───────────────────────────────┘
       │
       ▼
┌────────────────────────────────────────┐
│3. Paystack sends charge.success webhook│
│   - Signature verified (HMAC SHA512)   │
│   - Check idempotency key (reference)  │
└──────┬─────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│4. Atomic Firestore Transaction:         │
│   - Create payment record (status: ok)  │
│   - Create voucher (status: delivered)  │
│   - Update recipient wallet (+credits) │
│   - Create notifications               │
│   - Commit all or rollback all         │
└──────┬───────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│5. Recipient sees:                   │
│   - New voucher in list              │
│   - Updated wallet balance           │
│   - Notification of gift             │
└──────────────────────────────────────┘
```

### Redemption (Pay-Out) Flow

```
┌──────────────────┐
│Recipient requests│
│redeem credits    │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│1. POST /api/redemptions/request          │
│   - amount, bankCode, accountNumber      │
│   - Atomic transaction:                  │
│     - Validate: available >= amount      │
│     - Move: available → pending          │
│     - Create redemption (requested)      │
│     - Send notification                  │
└────────┬─────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│2. Admin reviews in queue         │
│   - Sees status: Redemption Req. │
│   - Checks bank details          │
│   - Clicks Approve               │
└────────┬──────────────────────────┘
         │
         ▼
┌────────────────────────────────────────┐
│3. POST /api/redemptions/approve        │
│   - Call Paystack API                  │
│   - Create transfer recipient          │
│   - Initiate transfer (status: pending)│
│   - Save transfer_code                 │
└────────┬─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│4. Paystack processes transfer           │
│   - Validates bank details              │
│   - Deducts from Paystack balance       │
│   - Sends to recipient's bank           │
│   - Sends webhook (success/failed)      │
└────────┬──────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│5. Webhook: transfer.success              │
│   - Signature verified                   │
│   - Update redemption (status: paid)     │
│   - Reduce pendingCredits                │
│   - Send notification                    │
│   - Update voucher status                │
└──────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│6. Recipient sees:                   │
│   - Redemption: PAID                 │
│   - Bank transfer in progress        │
│   - Notification with details        │
└──────────────────────────────────────┘
```

### Failure Handling Flow

```
Transfer Fails
    ↓
┌──────────────────────────────────────┐
│Paystack webhook: transfer.failed     │
│- Signature verified                  │
│- Get failure reason                  │
└────────┬─────────────────────────────┘
         ↓
┌──────────────────────────────────────┐
│Firestore atomic transaction:         │
│- Update redemption:                  │
│  - status: failed                    │
│  - failureReason: from webhook       │
│- Update wallet:                      │
│  - pending → available (refund)      │
│- Create notification: "Failed"       │
└────────┬─────────────────────────────┘
         ↓
┌──────────────────────────────────────┐
│Recipient sees:                       │
│- Redemption status: FAILED           │
│- Failure reason                      │
│- Credits returned to available       │
│- Can retry                           │
└──────────────────────────────────────┘
```

## Database Schema & Indexes

### Users Collection

```typescript
{
  id: "firebase_uid",
  phone: "+27123456789",
  fullName: "John Doe",
  email: "john@example.com",
  role: "sender" | "recipient" | "admin",
  status: "active" | "suspended",
  createdAt: Timestamp,
  updatedAt: Timestamp,
  limits: {
    monthlyLimit: 50000, // ZAR cents
    dailyLimit: 10000
  }
}

Index: {phone} for recipient lookup
```

### Wallets Collection

```typescript
{
  // doc id = userId
  userId: "firebase_uid",
  availableCredits: 100000, // ZAR cents
  pendingCredits: 50000,
  updatedAt: Timestamp
}
```

### Payments Collection

```typescript
{
  // doc id = paystack reference
  reference: "pay_123456789",
  payerId: "firebase_uid",
  amount: 100000, // ZAR cents
  currency: "ZAR",
  status: "pending" | "successful" | "failed",
  paystackData: { ... }, // Full response
  createdAt: Timestamp
}

Index: {payerId, createdAt DESC}
```

### Vouchers Collection

```typescript
{
  id: "voucher_123",
  paymentRef: "pay_123456789",
  senderId: "firebase_uid",
  recipientId: "firebase_uid",
  amount: 100000, // ZAR cents
  message: "Happy birthday!",
  status: "delivered" | "redeemed" | "paid" | "failed" | "reversed",
  createdAt: Timestamp,
  updatedAt: Timestamp
}

Index: {senderId, createdAt DESC}
Index: {recipientId, createdAt DESC}
```

### Redemptions Collection

```typescript
{
  id: "redemption_123",
  userId: "firebase_uid",
  amount: 100000, // ZAR cents
  method: "bank_account",
  details: {
    bankCode: "030",
    accountNumber: "1234567890",
    accountName: "John Doe",
    bankName: "FNB"
  },
  status: "redemption_requested" | "processing" | "approved" | "paid" | "failed" | "reversed",
  recipientCode: "RCP_123456789", // Paystack
  transferCode: "TRF_123456789",   // Paystack
  failureReason: "Invalid account",
  createdAt: Timestamp,
  updatedAt: Timestamp
}

Index: {userId, createdAt DESC}
```

### Notifications Collection

```typescript
{
  id: "notif_123",
  userId: "firebase_uid",
  title: "Payment Successful",
  body: "Your gift of R100 was delivered",
  read: false,
  type: "payment" | "voucher" | "redemption" | "admin",
  relatedId: "voucher_123",
  createdAt: Timestamp
}

Index: {userId, createdAt DESC}
```

### Audit Logs Collection

```typescript
{
  id: "audit_123",
  actorId: "firebase_uid",
  action: "approve" | "reject" | "process",
  targetType: "redemption" | "user" | "voucher",
  targetId: "redemption_123",
  payload: {
    reason: "Manual reversal",
    amount: 100000
  },
  createdAt: Timestamp
}
```

## Security Architecture

### Authentication
- **Phone OTP**: Firebase Phone Auth
- **Recaptcha**: Prevents bot abuse
- **ID Tokens**: Stateless session

### Authorization
- **Custom Claims**: Firebase `role` claim
- **Firestore Rules**: Enforce collection-level access
- **API Route Guards**: Verify auth token

### Cryptography
- **TLS 1.3**: In-transit encryption
- **HMAC SHA512**: Webhook signature verification
- **Paystack Keys**: Environment variables, never logged

### Data Protection
- **PII Encryption**: Bank details not visible to senders
- **Field Masking**: Account numbers masked in logs
- **Audit Trail**: All sensitive actions logged

## Deployment & Scalability

### Hosting
- **Frontend**: Vercel (globally distributed CDN)
- **Backend**: Firebase (auto-scaling)
- **Database**: Firestore (auto-scaling)

### Monitoring
- **Performance**: Vercel Analytics, Firebase Performance
- **Errors**: Firebase Crashlytics, Sentry
- **Transactions**: Paystack Dashboard

### Scaling Strategy
1. Firestore: Auto-scaling enabled by default
2. Cloud Functions: Auto-scales with demand
3. CDN: Vercel handles global distribution
4. Database: Composite indexes for complex queries

## Idempotency & Reliability

### Payment Idempotency
- Reference = unique identifier
- Check if payment exists before creating
- Skip duplicate webhook processing

### Redemption Idempotency
- Redemption ID = unique identifier
- Status transitions are one-way
- Cannot re-process paid/failed redemptions

### Webhook Resilience
- Signature verification (prevent injection)
- Transaction-based updates (all or nothing)
- Audit logging for failure investigation

## Cost Optimization

### Firebase
- Firestore: Read/write/delete pricing
- Auth: Free (phone OTP included)
- Storage: Optional (minimal usage)

### Paystack
- Per-transaction fee: 1.5% + fixed fee
- Transfer fee: Flat rate
- Balance transfers: No fee

### Vercel
- Deployment: Free
- Hosting: $20+/month (pro features)

## Compliance & Regulations

### South Africa
- POPIA: Personal information protection
- FAIS: Financial services standards
- FICA: Customer verification

### Payment Processing
- PCI DSS: Paystack handles (we never touch cards)
- KYC: Paystack verifies recipients

## Future Architecture Enhancements

1. **Caching Layer**: Redis for frequently accessed data
2. **Message Queue**: Cloud Pub/Sub for async processing
3. **Machine Learning**: Fraud detection models
4. **GraphQL**: Alternative to REST API
5. **Microservices**: Separate payment & notification services

---

For implementation details, see the code and inline comments.
