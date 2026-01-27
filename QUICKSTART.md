# ClanTip - Quick Start Guide

Get the ClanTip application up and running in 15 minutes!

## 🚀 Prerequisites

- Node.js 18+ installed
- Firebase project created (free tier okay)
- Paystack account (free test mode available)
- Git installed

## ⚡ Quick Setup (5 minutes)

### 1. Install Dependencies
```bash
cd clantip_app
npm install
```

### 2. Configure Firebase
1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Create a new project called "ClanTip"
3. Enable Firestore Database (start in test mode)
4. Enable Authentication → Phone
5. Go to Project Settings → General
6. Copy your config values

### 3. Set Environment Variables
Update `.env.local`:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_test_your_test_key
PAYSTACK_SECRET_KEY=sk_test_your_test_key

NEXT_PUBLIC_PAYOUT_MODE=DEFERRED_PAYOUT
```

### 4. Deploy Firestore Rules
```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules
```

### 5. Start Development Server
```bash
npm run dev
```

Visit `http://localhost:3000`

## 🧪 Test the Application

### Landing Page
- Visit http://localhost:3000
- Click "Get Started"

### Create Account
1. Enter phone: `+27 123 456 7890`
2. Enter OTP: `123456` (Firebase will send test code to console)
3. Enter name: `Test User`
4. Click "Get Started"

### Sender Dashboard
- You're now logged in as a sender
- Click "Create Gift Voucher"
- Fill in details and click "Proceed to Payment"
- Use Paystack test card:
  - Card Number: `4084084084084081`
  - Expiry: `12/25`
  - CVV: `123`

### Recipient Dashboard
- Sign out (top right)
- Create new account with different phone
- Choose recipient role
- View vouchers and redeem credits

### Admin Dashboard
- Create account with role `admin` (manually in Firestore)
- Visit `http://localhost:3000/admin`
- View redemption queue
- Approve/reject requests

## 📁 Project Structure Quick Tour

```
clantip_app/
├── src/app/              # Pages & routes
├── src/components/ui/    # UI components
├── src/firebase/         # Firebase config & utils
├── src/lib/             # Utilities & constants
└── public/              # Static assets
```

Key files to explore:
- `src/app/page.tsx` - Landing page
- `src/app/auth/page.tsx` - Phone OTP flow
- `src/app/app/sender/page.tsx` - Sender dashboard
- `src/lib/paystack.ts` - Payment integration
- `src/app/api/webhooks/paystack/route.ts` - Webhook handler

## 🔧 Common Tasks

### View Firestore Data
1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Select your project
3. Click "Firestore Database"
4. Collections are created automatically on first use

### Test Webhook in Production
- Paystack webhooks are sent to your Vercel deployment URL
- Webhook URL format: `https://your-vercel-domain.com/api/webhooks/paystack`
- Ensure webhook URL is configured in Paystack Dashboard → Settings → Webhooks

### Debug Firestore Rules
```bash
firebase emulator:firestore
```

### View Logs
```bash
# Vercel (after deployment)
vercel logs

# Local console
# Check browser console for frontend errors
```

## 🆘 Troubleshooting

### "Firebase app not initialized"
- Check `.env.local` has correct Firebase keys
- Verify keys don't have extra spaces

### "OTP not sending"
- Check Firebase Authentication → Settings → Phone
- Verify Recaptcha is enabled

### "Payment initialization fails"
- Check Paystack keys in `.env.local`
- Verify you're using TEST keys (pk_test_, sk_test_)

### "Firestore rules deployment fails"
- Ensure Firebase CLI is authenticated: `firebase login`
- Check `firestore.rules` syntax

### "Port 3000 already in use"
```bash
# Use different port
npm run dev -- -p 3001
```

## 📚 Documentation

- **README.md** - Full project documentation
- **DEPLOYMENT.md** - Production deployment guide
- **PROJECT_STRUCTURE.md** - Detailed project structure
- **Initial instruction.md** - Original requirements

## 🎯 Next Steps

1. **Customize Branding**
   - Replace `public/clantip_logo.png`
   - Update colors in `tailwind.config.ts`
   - Edit company name in components

2. **Add Your Content**
   - Update `/help`, `/terms`, `/privacy` pages
   - Add your contact info
   - Configure support email

3. **Production Deployment**
   - Follow DEPLOYMENT.md
   - Set up production Firebase project
   - Configure production Paystack keys

4. **Enhanced Features**
   - Add more payment methods
   - Implement referral system
   - Add user profiles
   - Create admin reports

## 💡 Pro Tips

- Use Firebase Emulator Suite for offline development
- Test phone auth with different countries
- Check Firebase quota limits
- Monitor Paystack transaction fees
- Set up error tracking early (Sentry, etc)

## 🆘 Need Help?

- Check README.md for detailed documentation
- Review firebase.ts files for API usage
- Check src/app/api routes for request/response formats
- Look at existing pages for implementation patterns

## 🚢 Ready to Deploy?

See **DEPLOYMENT.md** for:
- Vercel deployment
- Firebase production setup
- Paystack production keys
- Custom domain configuration

---

Happy coding! 🎉

Questions? Feedback? Check the documentation files or review the code comments.
