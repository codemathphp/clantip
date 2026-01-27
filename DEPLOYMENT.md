# ClanTip Deployment Guide

## Pre-Deployment Checklist

- [ ] Firebase project created with Firestore enabled
- [ ] Paystack account with API keys obtained
- [ ] Vercel account created
- [ ] Custom domain ready (optional)
- [ ] All environment variables configured
- [ ] Firestore security rules deployed
- [ ] Webhook URL registered with Paystack

## Step-by-Step Deployment

### 1. Deploy to Vercel (Frontend)

#### Option A: Using CLI

```bash
npm install -g vercel
vercel login
vercel
```

#### Option B: GitHub Integration
1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Click "New Project"
4. Import your GitHub repository
5. Configure environment variables
6. Click "Deploy"

#### Environment Variables on Vercel
1. In Vercel dashboard, go to Project Settings → Environment Variables
2. Add all variables from `.env.local`:
   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=...
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
   NEXT_PUBLIC_FIREBASE_APP_ID=...
   NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=...
   PAYSTACK_SECRET_KEY=...
   NEXT_PUBLIC_PAYOUT_MODE=DEFERRED_PAYOUT
   PAYOUT_MIN_THRESHOLD=10000
   NEXT_PUBLIC_APP_URL=https://yourdomain.com
   ```

### 2. Deploy Firestore Configuration

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase in project (if not already done)
firebase init

# Deploy Firestore rules
firebase deploy --only firestore:rules

# Deploy Firestore indexes
firebase deploy --only firestore:indexes
```

### 3. Configure Paystack Webhook

1. Go to Paystack Dashboard
2. Navigate to Settings → API Keys & Webhooks
3. Add webhook endpoint:
   ```
   https://yourdomain.com/api/webhooks/paystack
   ```
4. Select webhook events:
   - `charge.success`
   - `transfer.success`
   - `transfer.failed`
   - `transfer.reversed`
5. Copy the signing secret and add to environment variables

### 4. Production Security Checklist

- [ ] Disable Recaptcha testing mode
  - Go to Firebase Console → Authentication → Sign-in methods
  - reCAPTCHA Enterprise or Google Cloud

- [ ] Enable Firestore backups
  - Set backup retention policy
  - Test restore procedure

- [ ] Configure Firebase Security Rules
  - Deploy production rules (see README.md)
  - Test rules thoroughly

- [ ] Set up monitoring
  - Firebase Console → Monitoring
  - Enable performance monitoring
  - Set up error reporting

- [ ] Enable audit logging
  - Cloud Audit Logs in GCP
  - Review access regularly

### 5. Domain Configuration

#### Custom Domain on Vercel
1. In Vercel dashboard, go to Project Settings → Domains
2. Add your custom domain
3. Follow DNS configuration instructions
4. Wait for DNS propagation (up to 24 hours)

#### Update Firebase Auth Domain
1. Go to Firebase Console
2. Select your project
3. Go to Authentication → Settings
4. Add your custom domain to authorized domains

#### Update Paystack Webhook
1. If domain changed, update webhook URL in Paystack dashboard

### 6. Testing Production Setup

```bash
# Test webhook signature verification
curl -X POST https://yourdomain.com/api/webhooks/paystack \
  -H "x-paystack-signature: test_signature" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "charge.success",
    "data": {
      "reference": "test-reference",
      "amount": 10000,
      "customer": {"email": "test@example.com"},
      "metadata": {"senderId": "test"}
    }
  }'

# Verify Paystack connectivity
# Use Paystack's test card: 4084084084084081
# Expiry: 12/25, CVV: 123
```

### 7. Post-Deployment

#### Monitor Logs
```bash
# View Vercel logs
vercel logs

# View Firebase logs
firebase functions:log
```

#### Setup Alerts
- Vercel: Configure deployment notifications
- Firebase: Set up error alerts
- Paystack: Enable transaction alerts

#### First Transactions
- Test payment flow with test credentials
- Verify webhook processing
- Test redemption flow
- Check audit logs

## Rollback Procedure

### Revert Vercel Deployment
```bash
# List deployments
vercel list

# Revert to previous version
vercel rollback
```

### Revert Firestore Changes
```bash
# Restore from backup in Firebase Console
# Navigate to Backups section
# Click restore on the backup you want
```

## Monitoring & Maintenance

### Daily Checks
- Vercel deployment status
- Firestore database size
- Failed transaction rate
- Error logs

### Weekly Tasks
- Review audit logs
- Check Paystack balance
- Verify webhook processing
- Monitor performance metrics

### Monthly Tasks
- Security audit
- Cost review
- Backup verification
- User feedback review

## Scaling Considerations

### When to Scale
- Database reads exceed 10k/day
- API response time > 1 second
- Storage exceeds 10GB

### Scaling Steps
1. Enable Firestore auto-scaling
2. Increase Cloud Function memory
3. Consider Cloud CDN for static assets
4. Implement caching strategy

## Troubleshooting

### Deployment Fails
```bash
# Clear build cache
vercel remove

# Redeploy
vercel --prod
```

### Firestore Rules Deployment Fails
```bash
# Validate rules syntax
firebase firestore:publish firestore.rules --dry-run

# Fix issues and retry
firebase deploy --only firestore:rules
```

### Webhook Not Triggering
1. Check Paystack webhook URL is correct
2. Verify HMAC signature verification in code
3. Check Vercel logs for errors
4. Test webhook manually from Paystack dashboard

### High Database Costs
1. Review firestore.indexes.json for unused indexes
2. Implement document pagination
3. Enable offline persistence on client
4. Consider Firestore pricing mode (Blaze recommended for prod)

## Emergency Contacts

- Paystack Support: support@paystack.com
- Firebase Support: firebase-support@google.com
- Vercel Support: support@vercel.com

## Useful Links

- [Vercel Documentation](https://vercel.com/docs)
- [Firebase Documentation](https://firebase.google.com/docs)
- [Paystack Documentation](https://paystack.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
