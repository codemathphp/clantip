# Firebase Setup for South Africa Phone Authentication

## Issue: OTP Not Working with South African Numbers

If you're experiencing issues with Firebase phone authentication on South African numbers, follow these steps:

### 1. Enable Phone Authentication in Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Navigate to **Authentication** → **Sign-in method**
4. Click on **Phone** and enable it
5. Under **Phone numbers for testing (optional)**, add test South African numbers:
   - Format: `+27` followed by 9 digits (e.g., `+27123456789`)
   - Test code: `123456` (or any 6-digit code)

### 2. Verify South Africa is in Allowed Countries

1. In the Phone sign-in method settings
2. Under **reCAPTCHA Config**, ensure **reCAPTCHA Enterprise** or **reCAPTCHA v3** is selected
3. South Africa should be automatically allowed (no country restrictions needed for Firebase phone auth)

### 3. Common Phone Number Formats for South Africa

| Format | Example | Valid |
|--------|---------|-------|
| Local with leading 0 | `0123456789` | ✅ (converted to +27123456789) |
| Country code + number | `+27123456789` | ✅ (E.164 format) |
| With country code no +| `27123456789` | ⚠️ (may need conversion) |

### 4. App Configuration for Production Deployment

The app is now configured for Vercel deployment:

1. **Firebase Authorization**:
   - Ensure your Vercel domain is in Firebase Authentication allowed domains
   - Firebase Console → Authentication → Settings
   - Under **Authorized domains**, Vercel domain should be automatically recognized

2. **Recaptcha Configuration**:
   - Firebase uses reCAPTCHA v3 internally for phone auth
   - Vercel deployments automatically support this

3. **CORS & Headers** (configured in next.config.js):
   - Cross-Origin-Opener-Policy and Cross-Origin-Embedder-Policy headers set
   - Service-Worker-Allowed header configured for PWA

### 5. Debug Phone Authentication Issues

#### In Browser Console, look for:

**Success indicators:**
- `✓ Recaptcha initialized successfully`
- `📞 Sending OTP to: +27XXXXXXXXX`
- `✓ OTP verified, User UID: ...`

**Error indicators:**
- `❌ Recaptcha setup error` - Check reCAPTCHA configuration
- `Invalid phone number` - Check phone format (should be E.164: +27XXXXXXXXX)
- `auth/operation-not-supported-in-this-environment` - Phone auth not enabled

#### Common Error Codes:

| Error | Cause | Solution |
|-------|-------|----------|
| `auth/invalid-phone-number` | Wrong format or too short | Use E.164: +27XXXXXXXXX |
| `auth/missing-phone-number` | Empty phone field | Ensure phone is not empty |
| `auth/too-many-requests` | Rate limited | Wait 15 minutes before retry |
| `auth/operation-not-supported-in-this-environment` | Phone auth disabled | Enable in Firebase console |
| `auth/invalid-verification-code` | Wrong OTP code | Check test code or wait for new SMS |

### 6. Test with Local Firebase Emulator

For development/testing without SMS:

```bash
# Start Firebase emulator
firebase emulators:start --only auth

# In your app, connect to emulator:
# auth.useEmulator('http://localhost:9099')

# Use test phone: +27123456789
# Use test code: 123456
```

### 7. Test Phone Number Format Examples

The app now supports all these formats and converts to E.164:

```
Input → Converted to E.164
0123456789 → +27123456789 ✅
123456789 → +27123456789 ✅
+27123456789 → +27123456789 ✅
27123456789 → +27123456789 ✅
```

### 8. Verify Environment Variables

Check `.env.local` has correct Firebase credentials:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=<your_key>
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=<your_domain>
NEXT_PUBLIC_FIREBASE_PROJECT_ID=<your_project>
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=<your_bucket>
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<your_sender_id>
NEXT_PUBLIC_FIREBASE_APP_ID=<your_app_id>
```

### 9. Network Requirements

- Firebase phone auth requires internet connection
- Ensure:
  - Vercel deployment is accessible from your location
  - No VPN/proxy blocking Firebase domains
  - Device has stable internet connection

### 10. Still Having Issues?

#### Step-by-step debugging:

1. **Open Browser DevTools** (F12)
2. **Go to Console tab**
3. **Try to send OTP**
4. **Look for error messages and error codes**
5. **Share the exact error message** in project issues

#### Key debug info to collect:

```
- Phone number used (format)
- Error message from browser console
- Error code (e.g., auth/invalid-phone-number)
- Firebase project details (is phone auth enabled?)
- Network (localhost vs ngrok)
```

### Phone Number Format Function

The app now includes `formatPhoneForFirebase()` which handles:
- Local format: `0123456789` → `+27123456789`
- Country code format: `27123456789` → `+27123456789`
- Already formatted: `+27123456789` → stays same
- Already with +27: `+27123456789` → stays same

Location: `src/lib/constants.ts`

---

## Testing Checklist ✅

- [ ] Firebase phone auth is enabled in console
- [ ] Test phone numbers are added to Firebase
- [ ] Vercel domain is in Firebase authorized domains
- [ ] reCAPTCHA is configured
- [ ] Phone number is formatted correctly (try: 0123456789 or +27123456789)
- [ ] Browser console shows no errors
- [ ] Recaptcha initializes successfully
- [ ] OTP is sent and received
- [ ] OTP code is verified successfully
