# ClanTip Project Structure

```
clantip_app/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── layout.tsx               # Root layout
│   │   ├── page.tsx                 # Landing page
│   │   ├── providers.tsx            # React providers (Toast, etc)
│   │   ├── auth/
│   │   │   └── page.tsx             # Phone OTP authentication
│   │   ├── app/                     # Protected routes
│   │   │   ├── sender/
│   │   │   │   └── page.tsx         # Sender dashboard
│   │   │   └── recipient/
│   │   │       └── page.tsx         # Recipient dashboard
│   │   ├── admin/
│   │   │   └── page.tsx             # Admin dashboard
│   │   ├── help/
│   │   │   └── page.tsx             # Help & FAQ
│   │   ├── terms/
│   │   │   └── page.tsx             # Terms of Service
│   │   ├── privacy/
│   │   │   └── page.tsx             # Privacy Policy
│   │   └── api/                     # API Routes
│   │       ├── payments/
│   │       │   └── initialize/route.ts    # Initialize Paystack payment
│   │       ├── redemptions/
│   │       │   ├── request/route.ts       # Create redemption request
│   │       │   └── approve/route.ts       # Admin approve & transfer
│   │       └── webhooks/
│   │           └── paystack/route.ts      # Paystack webhook handler
│   │
│   ├── components/                  # Reusable React components
│   │   └── ui/                      # shadcn/ui components
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── input.tsx
│   │       ├── label.tsx
│   │       ├── badge.tsx
│   │       ├── dialog.tsx
│   │       └── table.tsx
│   │
│   ├── firebase/                    # Firebase configuration & utilities
│   │   ├── config.ts               # Firebase initialization
│   │   ├── auth.ts                 # Authentication functions
│   │   └── db.ts                   # Firestore operations
│   │
│   ├── lib/                         # Utility functions
│   │   ├── constants.ts            # App constants, currencies, banks
│   │   ├── paystack.ts             # Paystack API integration
│   │   └── utils.ts                # Helper functions
│   │
│   ├── hooks/                       # Custom React hooks
│   │   └── (future custom hooks)
│   │
│   ├── types/                       # TypeScript type definitions
│   │   ├── index.ts                # Main types
│   │   └── window.d.ts             # Window object types
│   │
│   └── styles/                      # Global CSS
│       └── globals.css             # Tailwind + custom styles
│
├── public/                          # Static assets
│   ├── clantip_logo.png           # App logo
│   └── favicon.png                # Tab favicon
│
├── Configuration Files
│   ├── package.json               # Dependencies & scripts
│   ├── tsconfig.json              # TypeScript config
│   ├── next.config.js             # Next.js config
│   ├── tailwind.config.ts          # Tailwind CSS config
│   ├── postcss.config.js          # PostCSS config
│   └── .eslintrc.json             # ESLint config
│
├── Firebase Configuration
│   ├── firebase.json              # Firebase project config
│   ├── firestore.rules            # Firestore security rules
│   └── firestore.indexes.json     # Firestore indexes
│
├── Environment & Git
│   ├── .env.local                 # Local environment variables
│   ├── .env.example               # Example environment variables
│   ├── .gitignore                 # Git ignore rules
│   └── .eslintignore              # ESLint ignore rules
│
├── Documentation
│   ├── README.md                  # Main project documentation
│   └── DEPLOYMENT.md              # Deployment guide

```

## Key Files Explained

### Core Application Files

**src/app/layout.tsx**
- Root layout for all pages
- Initializes providers (Toast notifications)
- Sets metadata (title, favicon)

**src/app/page.tsx**
- Landing page with marketing copy
- CTA buttons for signup/signin
- Feature highlights

**src/firebase/config.ts**
- Firebase app initialization
- Exports auth, db, storage instances

**src/firebase/auth.ts**
- Phone OTP setup
- User creation/update
- Authentication utilities

**src/firebase/db.ts**
- Firestore read/write operations
- Notifications, audit logs, wallet operations

**src/lib/paystack.ts**
- Paystack API wrapper functions
- Payment initialization
- Transfer creation & verification
- Webhook signature verification

**src/lib/constants.ts**
- South African bank codes
- Currency formatting
- Status displays
- Payout SLA messages

### API Routes

**src/app/api/payments/initialize/route.ts**
- POST endpoint to initialize Paystack payment
- Creates payment record in Firestore

**src/app/api/redemptions/request/route.ts**
- POST endpoint to create redemption request
- Moves credits to pending state

**src/app/api/redemptions/approve/route.ts**
- POST endpoint to approve & initiate Paystack transfer
- Updates redemption status
- Sends notifications

**src/app/api/webhooks/paystack/route.ts**
- POST endpoint for Paystack webhooks
- Handles: charge.success, transfer.success/failed/reversed
- Implements idempotency via event deduplication
- Updates Firestore atomically

### UI Components

All components in **src/components/ui/** follow shadcn/ui patterns:
- Composable & accessible
- Built with Radix UI primitives
- Tailwind CSS styled
- TypeScript typed

### Configuration Files

**tsconfig.json**
- Strict type checking enabled
- Path aliases for easier imports (@/*)

**tailwind.config.ts**
- Custom color palette (Teal & Orange)
- Brand colors configured
- shadcn/ui customizations

**firebase.json**
- Maps Firestore rules & indexes
- Configures deployable resources

## Dependencies

### Key Libraries
- **Next.js 15**: React framework with App Router
- **Firebase**: Authentication, Firestore, Hosting
- **Paystack**: Payment processing
- **Tailwind CSS**: Utility-first CSS
- **shadcn/ui**: High-quality React components
- **React Hot Toast**: Notifications
- **Zustand**: (optional) State management
- **crypto-js**: HMAC signature verification

### Development Tools
- **TypeScript**: Type safety
- **ESLint**: Code linting
- **Prettier**: Code formatting

## Data Flow

### Payment Flow
```
User Input (Sender)
    ↓
POST /api/payments/initialize
    ↓
Paystack checkout modal
    ↓
User completes payment
    ↓
Paystack webhook → /api/webhooks/paystack
    ↓
Firestore transaction (Payment + Voucher + Wallet)
    ↓
Notifications sent
```

### Redemption Flow
```
User Request (Recipient)
    ↓
POST /api/redemptions/request
    ↓
Credits: available → pending
    ↓
Admin approval (Admin Dashboard)
    ↓
POST /api/redemptions/approve
    ↓
Create Paystack transfer recipient
    ↓
Initiate transfer
    ↓
Paystack webhook → /api/webhooks/paystack
    ↓
Update redemption status → Paid
    ↓
Notification sent
```

## Environment Variables

All environment variables are documented in `.env.example` and `.env.local`.

### Public (NEXT_PUBLIC_)
- Firebase config (API key, project ID, etc)
- Paystack public key
- Payout mode
- App URL

### Secret
- Paystack secret key
- Firebase service account (for backend)

## Database Schema

See README.md for comprehensive Firestore collection structure and field documentation.

## Security Model

- **Authentication**: Firebase Phone OTP
- **Authorization**: Firestore rules + role-based checks
- **Encryption**: TLS in transit, Firestore encryption at rest
- **Secrets**: Environment variables, never hardcoded
- **Signatures**: HMAC SHA512 for webhook verification
- **Idempotency**: Transaction locks + event deduplication

## Performance Optimizations

- Code splitting via Next.js dynamic imports
- Image optimization via Next.js Image component
- Lazy loading of UI components
- Firestore indexing for common queries
- CDN delivery via Vercel

## Accessibility

- Semantic HTML
- ARIA labels on interactive elements
- Keyboard navigation support
- Color contrast meets WCAG standards

## Next Steps for Development

1. **Add Paystack Checkout UI**: Create payment modal component
2. **Implement Real-time Updates**: Firestore listeners for live notifications
3. **Add Analytics**: Track user events & conversions
4. **Payment History**: Enhanced filtering & exports
5. **Mobile App**: React Native version
6. **Admin Reports**: CSV exports, charts
7. **Internationalization**: Multi-language support
8. **Rate Limiting**: Prevent abuse on API routes
9. **A/B Testing**: Test UI variations
10. **Customer Support**: Help ticket system

## Production Checklist

- [ ] Firebase Security Rules deployed
- [ ] Firestore indexes created
- [ ] Paystack production keys configured
- [ ] Webhook URL registered
- [ ] SSL certificate valid
- [ ] Custom domain configured
- [ ] Error monitoring enabled (Sentry/Firebase)
- [ ] Performance monitoring enabled
- [ ] Database backups scheduled
- [ ] GDPR compliance reviewed
