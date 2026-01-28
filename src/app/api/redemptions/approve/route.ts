import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/firebase/config'
import { doc, getDoc, updateDoc, writeBatch, collection, Timestamp } from 'firebase/firestore'
import { createTransferRecipient, initiateTransfer } from '@/lib/paystack'

// Helper to get exchange rates from settings
async function getExchangeRates() {
  const ratesDoc = await getDoc(doc(db, 'settings', 'exchangeRates'))
  return ratesDoc.exists() ? (ratesDoc.data().rates || {}) : {}
}

export async function POST(request: NextRequest) {
  try {
    const { redemptionId } = await request.json()

    if (!redemptionId) {
      return NextResponse.json(
        { success: false, error: 'Redemption ID required' },
        { status: 400 }
      )
    }

    // Get redemption details
    const redemptionRef = doc(db, 'redemptions', redemptionId)
    const redemptionSnap = await getDoc(redemptionRef)

    if (!redemptionSnap.exists()) {
      return NextResponse.json(
        { success: false, error: 'Redemption not found' },
        { status: 404 }
      )
    }

    const redemption = redemptionSnap.data()

    if (redemption.status !== 'approved') {
      return NextResponse.json(
        { success: false, error: 'Redemption must be approved before transfer' },
        { status: 400 }
      )
    }

    const batch = writeBatch(db)

    try {
      // Create transfer recipient if not exists
      let recipientCode = redemption.recipientCode

      if (!recipientCode) {
        // Determine target currency. Default to ZAR; if redemption details include currency use it.
        let targetCurrency = redemption.details?.currency || 'ZAR'

        // Fallback: if bankCode matches South African banks, assume ZAR
        const saBankCodes = ['030','031','032','033','034','035','036','037']
        if (!redemption.details?.currency && saBankCodes.includes(redemption.details?.bankCode)) {
          targetCurrency = 'ZAR'
        }

        const recipientRes = await createTransferRecipient(
          'nuban',
          redemption.details.accountName,
          redemption.details.accountNumber,
          redemption.details.bankCode,
          targetCurrency
        )

        if (!recipientRes.status) {
          throw new Error('Failed to create transfer recipient')
        }

        recipientCode = recipientRes.data.recipient_code
      }

      // Determine amount to send in recipient currency smallest unit
      // redemption.amount is stored in cents (ZAR cents) in our system
      let amountInTargetSmallestUnit: number
      const amountZar = (redemption.amount || 0) / 100

      // Determine target currency (from recipientCode creation above or redemption.details)
      const targetCurrency = redemption.details?.currency || 'ZAR'

      if (targetCurrency === 'ZAR') {
        // already in ZAR cents
        amountInTargetSmallestUnit = Math.round(amountZar * 100)
      } else {
        // Need to convert from ZAR to target currency using stored exchange rates
        const rates = await getExchangeRates()
        // Expect a rate key like ZAR_TO_NGN or USD_TO_ZAR etc. First try direct ZAR_TO_<CUR>
        const rateKey = `ZAR_TO_${targetCurrency}`
        let rate = rates[rateKey]

        if (!rate) {
          // Try to compute via USD if USD_TO_ZAR and USD_TO_<CUR> exist
          const usdToZar = rates['USD_TO_ZAR']
          const usdToTarget = rates[`USD_TO_${targetCurrency}`]
          if (usdToZar && usdToTarget) {
            // ZAR -> USD -> target: amountZar / usdToZar * usdToTarget
            rate = (1 / usdToZar) * usdToTarget
          }
        }

        if (!rate) {
          throw new Error(`Missing exchange rate for conversion to ${targetCurrency}`)
        }

        const amountInTarget = amountZar * rate
        // Convert to smallest unit (cents) assuming 100 subunits
        amountInTargetSmallestUnit = Math.round(amountInTarget * 100)
      }

      // Initiate transfer
      const transferRes = await initiateTransfer(
        recipientCode,
        amountInTargetSmallestUnit,
        'ClanTip Redemption',
        redemptionId,
        'balance'
      )

      if (!transferRes.status) {
        throw new Error('Failed to initiate transfer')
      }

      // Update redemption
      batch.update(redemptionRef, {
        status: 'processing',
        recipientCode,
        transferCode: transferRes.data.transfer_code,
        updatedAt: Timestamp.now(),
      })

      // Create notification
      const notificationRef = doc(collection(db, 'notifications'))
      batch.set(notificationRef, {
        userId: redemption.userId,
        title: 'Redemption Processing',
        body: `Your redemption is being processed. You'll be notified when it's completed.`,
        read: false,
        type: 'redemption',
        relatedId: redemptionId,
        createdAt: Timestamp.now(),
      })

      await batch.commit()

      return NextResponse.json({
        success: true,
        message: 'Transfer initiated successfully',
        transferCode: transferRes.data.transfer_code,
      })
    } catch (error: any) {
      return NextResponse.json(
        { success: false, error: error.message || 'Failed to process transfer' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('Transfer error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
