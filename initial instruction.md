You are my senior engineer and product builder. Build a production-ready MVP called “ClanTip” using:

STACK
- Next.js (App Router) + TypeScript
- Tailwind CSS + shadcn/ui for a premium responsive UI (mobile + desktop)
- Firebase: Auth (Phone OTP), Firestore, Cloud Functions
- Paystack: Pay-ins (credits purchase) + Transfers (payouts)
- Hosting: Vercel for Next.js frontend; Firebase Functions for webhooks & payout APIs

CORE PRODUCT CONCEPT (MANDATORY)
ClanTip is a digital value gifting platform. Users purchase “Credits” to create a “Support Voucher” for a recipient. The recipient sees the credits immediately and can “Redeem Credits” later. Redemption is processed (not instant by default). Use safe, calm wording.

LANGUAGE RULES (VERY IMPORTANT)
- Use ONLY the following terms in UI and code:
  - “Credits”
  - “Support Voucher”
  - “Gift Credits”
  - “Redeem Credits”
  - “Redemption Request”
  - “Processing”
  - “Approved”
  - “Paid”
  - “Failed”
  - “Reversed”
- DO NOT use:
  - “cashout”, “instant money”, “send money”, “remittance”, “withdrawal”, “transfer money”

ROLES
- Sender: buys credits, gifts a Support Voucher to a recipient (by phone)
- Recipient: receives vouchers, holds credits, requests redemption
- Admin: oversees, approves payouts (at launch), manages risk controls, audit logs

UX REQUIREMENTS
- Premium look on mobile + desktop:
  - Mobile: bottom navigation, clean card UI, simple flows
  - Desktop: sidebar + topbar, tables for admin with filters
  - Status chips: Delivered, Redemption Requested, Processing, Approved, Paid, Failed, Reversed
- In-app notifications (Firestore notifications collection)
- Minimal friction onboarding: phone OTP + full name; email optional
- Sender must see status updates, but must NEVER see recipient bank/wallet details

OPERATING MODES (CONFIG-BASED, NO HARDCODING)
Implement payout modes via environment variables or admin settings:
- PAYOUT_MODE = DEFERRED_PAYOUT | SAME_DAY_PAYOUT | FAST_PAYOUT
Default at launch: DEFERRED_PAYOUT

PAYOUT SLA (COPY MUST MATCH MODE)
- Default launch promise: “Most redemptions are processed within 24–48 hours.”
- SAME_DAY_PAYOUT copy: “Processed same business day.”
- FAST_PAYOUT copy: “Usually processed within 1 hour (eligible requests).”
Never promise instant payouts.

PAYSTACK BALANCE AWARENESS (NON-NEGOTIABLE)
- Collections from voucher purchases are NOT automatically available for Transfers.
- Transfers require a funded Paystack Balance.
- Before initiating any Paystack Transfer, the system must confirm payouts are enabled and balance/availability is sufficient (use internal ‘payout_available’ flag + threshold).
- If payout is not available, keep redemption in Processing until admin funds Paystack balance and approves.

FIREBASE (AUTH + DB)
Auth: Firebase Phone OTP.
Firestore collections:
- users: {id, phone, fullName, email?, role, createdAt, status, limits}
- wallets: {userId, availableCredits, pendingCredits, updatedAt}
- payments: {reference, payerId, amount, currency, status, paystackData, createdAt}
- vouchers: {id, paymentRef, senderId, recipientId, amount, message?, status, createdAt, updatedAt}
- redemptions: {id, userId, amount, method, details, status, recipientCode?, transferCode?, createdAt, updatedAt, failureReason?}
- notifications: {id, userId, title, body, read, createdAt}
- auditLogs: {id, actorId, action, targetType, targetId, payload, createdAt}

SECURITY (MUST BE CORRECT)
- Firestore rules:
  - Users can read/write their own user doc; read their wallet; read vouchers where senderId==uid or recipientId==uid; read their own redemptions; read their notifications
  - Only admin can read all users/payments/vouchers/redemptions/auditLogs
- Use admin role via custom claims OR user.role field + strict rules.
- Never trust frontend for payment success or payout success.

IDEMPOTENCY & DOUBLE-PAY PREVENTION (CRITICAL)
- Webhooks must be idempotent:
  - Deduplicate by paystack event id + transaction reference
  - Ignore duplicates safely
- Redemptions must never pay twice:
  - Use Firestore transaction “lock” pattern (status transitions only allowed in correct order)
  - A redemption in Paid/Failed/Reversed cannot be re-initiated.

PAY-IN FLOW (SENDER)
1) Sender initiates Gift Credits:
   - recipient phone (required)
   - amount (ZAR credits for MVP)
   - optional message
2) Use Paystack checkout/inline to collect payment and create a reference.
3) Paystack webhook “charge.success” is the only source of truth:
   - Verify x-paystack-signature (HMAC SHA512).
   - Mark payment Successful.
   - Create voucher status Delivered.
   - Increase recipient wallet.availableCredits (atomic).
   - Notify sender + recipient.

REDEMPTION FLOW (RECIPIENT)
1) Recipient requests Redeem Credits:
   - choose method (start with SA bank payout; keep “mobile wallet” in schema for future)
   - enter details (bank name/bank_code, account_number, account_name)
   - amount <= availableCredits
2) On submit (atomic transaction):
   - move amount from availableCredits -> pendingCredits
   - create redemption status “Redemption Requested”
   - notify recipient and sender (status update only)

ADMIN PAYOUT QUEUE (LAUNCH MODE)
- Redemption lifecycle: Redemption Requested -> Processing -> Approved -> Paid OR Failed OR Reversed
- Admin sees queue, can:
  - Move to Processing (optional step) to indicate it is being worked
  - Approve (initiate Paystack payout if payout_available)
  - Reject (Reversed): return pendingCredits to availableCredits with reason
- Always log admin actions to auditLogs.

PAYOUT (PAYSTACK TRANSFERS) – IMPLEMENT FROM DAY 1
On Approve:
1) Create transfer recipient (if not existing for that user + account):
   POST /transferrecipient
   - type: bank_account
   - name: account_name
   - account_number
   - bank_code
   - currency: ZAR
   Save recipient_code on redemption (and optionally in user payout profiles)
2) Initiate transfer:
   POST /transfer
   - recipient: recipient_code
   - amount: integer in kobo/cents equivalent for ZAR (Paystack expects subunits)
   - reason: “ClanTip Redemption”
   - reference: redemption.id
   - source: balance
   Save transfer_code and set redemption status to “Approved” then “Processing” (or directly “Processing” after initiation).
3) Handle transfer webhooks:
   - On success: mark redemption Paid; keep pendingCredits reduced permanently; update voucher status Paid; notify sender+recipient
   - On failure: mark redemption Failed with reason; move pendingCredits back to availableCredits; notify
4) Retries:
   - 2 retries max for transient failures, then Failed
   - Never re-initiate if transfer_code exists unless marked Failed and explicitly retried in admin UI (with audit log)

FAILSAFE BEHAVIOR
- If payout_available is false or balance threshold not met:
  - Approve button is disabled or triggers “Queued” state; redemption stays Processing.
- If any webhook fails to process:
  - Store raw payload in auditLogs or a webhookEvents collection and retry processing safely.

PAGES (NEXT.JS)
- / (landing with CTA)
- /auth (phone OTP)
- /app/sender (dashboard + Gift Credits + history)
- /app/recipient (wallet + vouchers + Redeem Credits + history)
- /app/notifications
- /admin (protected: KPIs + queue + actions)
- /help (FAQs and safe wording)
- /terms and /privacy (placeholders with basic wording)

DESIGN SYSTEM
- shadcn/ui components: Card, Badge, Table, Dialog, Tabs, Button, Input, Toast
- consistent spacing, rounded corners, subtle shadows, skeleton loaders, empty states

DELIVERABLES
- Working app connected to Firebase Auth + Firestore
- Paystack pay-ins via checkout
- Webhooks for charge.success + transfer events with signature verification
- Admin payout queue + approval actions
- README:
  - environment variables
  - Firebase deploy commands
  - Paystack dashboard setup (webhook URL)
  - operational modes and limits configuration


Project Brand Notes :
Colors : Teel and Orange
Logo - clantip_logo.png in assets
favicon - favicon.png in assets