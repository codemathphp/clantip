# ClanTip Payment System - Deployment Guide

## Pre-Deployment Checklist

### Environment Setup
- [ ] Production Paystack keys obtained from Paystack dashboard
- [ ] Production domain configured
- [ ] Firebase project verified
- [ ] Environment variables ready

### Configuration Updates

#### 1. Production Environment Variables
Update `.env.local` (or create `.env.production`) with:

```env
# Paystack Production Keys
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
PAYSTACK_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
PAYSTACK_CALLBACK_URL=https://yourdomain.com/payment/callback

# Application URLs
NEXT_PUBLIC_APP_URL=https://yourdomain.com
NODE_ENV=production

# Firebase (Keep same as staging)
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyApHnh79jLcmZl5zvZ7P0r1pLQCK8_aaW4
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=moneyrand-dbc5d.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=moneyrand-dbc5d
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=moneyrand-dbc5d.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1056606433603
NEXT_PUBLIC_FIREBASE_APP_ID=1:1056606433603:web:13b9b079b0f8dce66ebff6
```

#### 2. Paystack Webhook Configuration
In Paystack Dashboard:
1. Go to Settings → API Keys & Webhooks
2. Set webhook URL to: `https://yourdomain.com/api/webhooks/paystack`
3. Verify webhook signature validation
4. Test webhook delivery

#### 3. Next.js Configuration
Update `next.config.ts` if needed:

```typescript
/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    // Environment variables
  },
  // Add CORS headers if needed
  headers: async () => {
    return [
      {
        source: '/api/webhooks/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: 'https://api.paystack.co',
          },
        ],
      },
    ]
  },
}

export default nextConfig
```

### Deployment Steps

#### 1. Build Verification
```bash
npm run build
```

Ensure no errors or warnings related to payment system.

#### 2. Test Build Locally
```bash
npm run build
npm start
```

Test payment flow with production keys in staging environment.

#### 3. Deploy to Production
Using Vercel (Recommended):

```bash
vercel --prod
```

Or your preferred hosting provider:
- Netlify
- AWS Amplify
- Railway
- Render
- Heroku (with build pack)

#### 4. Post-Deployment Tests

**Immediate Tests:**
1. [ ] Website loads without errors
2. [ ] Authentication works
3. [ ] Payment page accessible
4. [ ] Paystack script loads
5. [ ] Console has no errors

**Payment Flow Test:**
1. [ ] Complete test payment (use Paystack test mode if available)
2. [ ] Verify payment recorded in Firestore
3. [ ] Verify callback received and processed
4. [ ] Verify voucher created
5. [ ] Check webhook events received

### Monitoring & Logging

#### 1. Set Up Logging
Configure Sentry or similar for error tracking:

```bash
npm install @sentry/nextjs
```

Update `_app.tsx` or root layout:

```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
});
```

#### 2. Monitor Payment Metrics
- Payment success rate
- Average processing time
- Failed payment count
- Webhook delivery status
- Error frequency

#### 3. Set Up Alerts
- Failed payment alerts
- Webhook failures
- API errors
- Firestore quota warnings

### Troubleshooting Guide

#### Payment Initialization Returns 400
**Possible Causes:**
1. Invalid API keys
2. Missing required fields
3. Paystack API down
4. Network issues

**Solution:**
1. Verify production keys in Paystack dashboard
2. Check API request payload in logs
3. Test Paystack API directly with curl
4. Check network connectivity

#### Webhook Not Received
**Possible Causes:**
1. Webhook URL incorrect in Paystack settings
2. Signature verification failing
3. Firewall blocking Paystack IP
4. Server error processing webhook

**Solution:**
1. Verify webhook URL in Paystack dashboard
2. Test webhook delivery in Paystack test environment
3. Check server logs for errors
4. Verify HMAC signature calculation

#### Payment Reference Not Found
**Possible Causes:**
1. Reference stored incorrectly
2. Firestore write failed
3. Race condition in verification

**Solution:**
1. Check Firestore `payments` collection
2. Verify transaction isolation level
3. Add retry logic for verification

### Performance Optimization

#### 1. Paystack Script Loading
Already optimized with dynamic loading. Ensure Next.js caching:

```typescript
<script 
  src="https://js.paystack.co/v1/inline.js"
  async
  defer
/>
```

#### 2. Database Queries
- Index Firestore collections for faster queries
- Set up Firestore analytics
- Monitor database throughput

#### 3. API Response Times
- Monitor `/api/payments/initialize` response time
- Monitor `/api/payments/verify` response time
- Set up alerts for slow responses

### Security Checklist

- [x] Environment variables not hardcoded
- [x] Webhook signature verification enabled
- [x] HTTPS only (enforced by hosting provider)
- [x] CORS properly configured
- [x] Sensitive data not logged
- [x] Input validation on all endpoints
- [x] Rate limiting (if needed)
- [ ] WAF (Web Application Firewall) configured
- [ ] DDoS protection enabled
- [ ] Regular security audits scheduled

### Backup & Recovery

#### 1. Firestore Backups
Enable automated Firestore backups:
1. Go to Firestore → Backups
2. Set up daily automatic backups
3. Test restore procedure

#### 2. Environment Variables Backup
Store production env variables in:
- Secure vault (1Password, LastPass)
- Encrypted file
- CI/CD secrets manager

#### 3. Payment Recovery Procedure
If payment processing fails:
1. Check Firestore for payment record
2. Verify Paystack transaction status
3. Manual voucher creation if needed
4. Refund if necessary

### Rollback Plan

If issues occur after deployment:

```bash
# Revert to previous version
vercel rollback

# Or manual rollback
git revert HEAD
npm run build
vercel --prod
```

### Post-Launch Monitoring (First 30 Days)

- [ ] Daily payment success rate checks
- [ ] Daily webhook delivery verification
- [ ] Weekly error log review
- [ ] Weekly performance metrics review
- [ ] Customer feedback monitoring
- [ ] Error alert response procedure

### Maintenance Schedule

**Weekly:**
- Review payment logs
- Check failed transactions
- Monitor API response times

**Monthly:**
- Database cleanup (archived payments)
- Security audit
- Performance optimization review

**Quarterly:**
- Full system audit
- Load testing
- Disaster recovery drill

### Escalation Contacts

- Paystack Support: support@paystack.com
- Firebase Support: Available through Google Cloud Console
- Hosting Provider Support: [Your Provider]

### Success Metrics

Track these metrics after launch:
- Payment success rate (Target: > 95%)
- Average payment time (Target: < 10 seconds)
- Webhook delivery rate (Target: > 99%)
- Customer complaints (Target: < 1%)
- System uptime (Target: > 99.9%)

---

## Quick Reference - Production Deployment

```bash
# 1. Verify environment
env | grep PAYSTACK
env | grep FIREBASE

# 2. Build and test
npm run build
npm start

# 3. Deploy
vercel --prod

# 4. Verify deployment
curl https://yourdomain.com/api/payments/initialize

# 5. Test payment flow
# Follow manual test steps in PAYMENT_STATUS.md
```

---

**Last Updated**: [Date]
**Version**: 1.0 - Production Ready
