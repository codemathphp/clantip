# Exchange Rates Management Guide

## Overview
The exchange rates feature allows you to manage currency conversion rates for multi-country transfers across South Africa, Nigeria, Ghana, and Kenya.

## Accessing Exchange Rates

1. Navigate to **Admin Dashboard** → **Settings** tab
2. Scroll down to the **Exchange Rates** card
3. Update any of the 8 currency pairs as needed
4. Click **💱 Save Exchange Rates**

## Supported Currency Pairs

### Direct Rates (Preferred)
These are direct conversion rates from ZAR to target currencies. Use these when possible:

- **ZAR → NGN**: South Africa to Nigeria (Nigerian Naira)
- **ZAR → GHS**: South Africa to Ghana (Ghanaian Cedi)
- **ZAR → KES**: South Africa to Kenya (Kenyan Shilling)

### Bridge Rates (Fallback)
These USD rates are used as a fallback when direct rates aren't available. The system will convert: `(1 / USD_TO_ZAR) * USD_TO_TARGET`:

- **USD → ZAR**: US Dollar to South African Rand
- **USD → NGN**: US Dollar to Nigerian Naira
- **USD → GHS**: US Dollar to Ghanaian Cedi
- **USD → KES**: US Dollar to Kenyan Shilling

## How It Works

When processing a redemption request:

1. Admin approves the redemption in the **Redemptions** tab
2. System determines the target currency (from redemption details or bank code)
3. System fetches the appropriate exchange rate from Firestore
4. Amount is converted: ZAR cents → ZAR (÷100) → multiply by rate → target currency cents (×100)
5. Paystack API is called with the converted amount in target currency

### Example Conversion

- User sent R100 (10,000 ZAR cents)
- Redemption requested to Nigeria (NGN)
- Exchange rate: ZAR_TO_NGN = 46.5
- Conversion: 100 × 46.5 = 4,650 NGN
- Paystack receives: 465,000 (kobo/smallest unit)

## Initial Setup

The system comes with default exchange rates. Update them based on current market rates:

```json
{
  "ZAR_TO_NGN": 46.5,
  "ZAR_TO_GHS": 0.48,
  "ZAR_TO_KES": 8.1,
  "USD_TO_ZAR": 18.5,
  "USD_TO_NGN": 850,
  "USD_TO_GHS": 11.5,
  "USD_TO_KES": 154
}
```

## Best Practices

1. **Update Regularly**: Exchange rates fluctuate. Update rates at least weekly or when there are significant market changes
2. **Test Before Going Live**: Test with small amounts first to verify conversions are correct
3. **Monitor Paystack**: Check Paystack dashboard to verify amounts received in each country match expectations
4. **Keep Records**: The system automatically tracks last update time - use this to ensure rates are current

## Troubleshooting

### Exchange Rate Not Applied
- Check that rates were saved successfully (you should see a "saved" toast notification)
- Verify the rate key matches exactly (e.g., `ZAR_TO_NGN` not `ZAR_NGN`)
- Check Firestore `settings/exchangeRates` document exists and has data

### Wrong Amount Transferred
1. Verify the exchange rate is current
2. Check the source amount was in ZAR cents (should be × 100)
3. Confirm target currency matches the rate key used
4. Check Paystack API response for actual transferred amount

## Testing Checklist

When implementing or updating exchange rates:

- [ ] Create a test redemption request with a known amount
- [ ] Approve the redemption in admin
- [ ] Check Paystack dashboard for the actual transfer amount
- [ ] Verify: `Original Amount (ZAR) × Exchange Rate = Received Amount (Target Currency)`
- [ ] Confirm notification shows correct currency and amount
- [ ] Check Firestore redemption document has `recipientCode` and `transferCode`

## API Reference

### GET /api/admin/exchange-rates
Fetch current exchange rates

**Response:**
```json
{
  "success": true,
  "data": {
    "rates": {
      "ZAR_TO_NGN": 46.5,
      ...
    },
    "updatedAt": "2024-01-15T10:30:45.000Z"
  }
}
```

### POST /api/admin/exchange-rates
Update exchange rates

**Request:**
```json
{
  "rates": {
    "ZAR_TO_NGN": 46.5,
    "ZAR_TO_GHS": 0.48,
    ...
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Exchange rates updated successfully",
  "data": {
    "rates": {...},
    "updatedAt": "2024-01-15T10:30:45.000Z"
  }
}
```
