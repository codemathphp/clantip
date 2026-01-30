import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/firebase/config'
import { doc, updateDoc, getDoc, collection, writeBatch, Timestamp, query, getDocs, where } from 'firebase/firestore'
import { verifyPaystackSignature, verifyTransaction } from '@/lib/paystack'
import crypto from 'crypto-js'

// Webhook handlers for Paystack events
export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get('x-paystack-signature')
    const body = await request.json()

    // Verify signature
    if (!signature || !verifyPaystackSignature(body, signature)) {
      return NextResponse.json(
        { success: false, error: 'Invalid signature' },
        { status: 401 }
      )
    }

    const event = body.event
    const data = body.data

    // Handle different event types
    switch (event) {
      case 'charge.success':
        return await handleChargeSuccess(data)

      case 'transfer.success':
        return await handleTransferSuccess(data)

      case 'transfer.failed':
        return await handleTransferFailed(data)

      case 'transfer.reversed':
        return await handleTransferReversed(data)

      default:
        return NextResponse.json({ success: true })
    }
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function handleChargeSuccess(data: any) {
  const { reference, customer, amount, metadata } = data

  try {
    // Check if payment already processed (idempotency)
    const paymentRef = doc(db, 'payments', reference)
    const paymentSnap = await getDoc(paymentRef)

    if (paymentSnap.exists() && paymentSnap.data().status === 'successful') {
      return NextResponse.json({ success: true, cached: true })
    }

    // Get original payment record to retrieve conversion info
    const originalPayment = paymentSnap.exists() ? paymentSnap.data() : null
    const convertedAmount = originalPayment?.convertedAmount || (amount / 100) // amount from Paystack is in kobo
    const originalAmount = originalPayment?.originalAmount || convertedAmount
    const originalCurrency = originalPayment?.originalCurrency || 'ZAR'

    const batch = writeBatch(db)

    // Update payment status
    batch.set(
      paymentRef,
      {
        reference,
        payerId: metadata?.senderId || 'unknown',
        amount, // Keep in kobo
        amountInZAR: convertedAmount,
        originalAmount,
        originalCurrency,
        currency: 'ZAR',
        status: 'successful',
        paystackData: data,
        createdAt: Timestamp.now(),
      },
      { merge: true }
    )

    // Create voucher with 6-digit code
    const voucherId = `${reference}-${Date.now()}`
    const voucherCode = Math.floor(100000 + Math.random() * 900000).toString()
    const voucherRef = doc(db, 'vouchers', voucherId)

    batch.set(voucherRef, {
      id: voucherId,
      code: voucherCode,
      paymentRef: reference,
      senderId: metadata?.senderId,
      recipientId: metadata?.recipientId,
      amount: convertedAmount, // Store in ZAR (as decimal, NOT kobo)
      recipientHandle: metadata?.recipientHandle || null,
      originalAmount,
      originalCurrency,
      message: metadata?.message || '',
      status: 'delivered',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })

    // Vouchers are NOT automatically credited to wallet
    // Recipients must explicitly redeem them via /api/vouchers/redeem

    // Resolve recipient UID: prefer lookup by phone (recipientId), fallback to handle if provided
    let recipientUID = metadata?.recipientId
    try {
      const recipientUserRef = doc(db, 'users', metadata?.recipientId)
      const recipientUserSnap = await getDoc(recipientUserRef)
      if (recipientUserSnap.exists()) {
        recipientUID = recipientUserSnap.data().id
      } else if (metadata?.recipientHandle) {
        // Try to resolve by handle
        const usersColl = collection(db, 'users')
        const q = query(usersColl, where('handle', '==', metadata.recipientHandle))
        const qSnap = await getDocs(q)
        if (!qSnap.empty) {
          const u = qSnap.docs[0].data()
          recipientUID = u.id || u.phone || metadata.recipientId
        }
      }
    } catch (e) {
      console.warn('Recipient resolution warning', e)
      recipientUID = metadata?.recipientId
    }

    // Create notifications
    const notificationRef1 = doc(collection(db, 'notifications'))
    batch.set(notificationRef1, {
      userId: metadata?.senderId,
      title: 'Gift Sent Successfully',
      body: `Your support voucher worth R${convertedAmount.toFixed(2)} was delivered`,
      read: false,
      type: 'voucher',
      relatedId: voucherId,
      createdAt: Timestamp.now(),
    })

    const notificationRef2 = doc(collection(db, 'notifications'))
    batch.set(notificationRef2, {
      userId: recipientUID,
      title: 'You Received a Gift!',
      body: `You received a support voucher worth R${convertedAmount.toFixed(2)}`,
      read: false,
      type: 'voucher',
      relatedId: voucherId,
      createdAt: Timestamp.now(),
    })

    await batch.commit()
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error handling charge success:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to process payment' },
      { status: 500 }
    )
  }
}

async function handleTransferSuccess(data: any) {
  const { reference, transfer_code } = data

  try {
    // Update redemption status
    const redemptionRef = doc(db, 'redemptions', reference)
    await updateDoc(redemptionRef, {
      status: 'paid',
      transferCode: transfer_code,
      updatedAt: Timestamp.now(),
    })

    // Get redemption details for notification
    const redemptionSnap = await getDoc(redemptionRef)
    if (redemptionSnap.exists()) {
      const redemption = redemptionSnap.data()

      // Prefer transfer amount/currency from webhook data when available
      const paidAmount = data?.amount ? (data.amount / 100) : (redemption.amount / 100)
      const paidCurrency = data?.currency || 'ZAR'

      // Create notification
      const notificationRef = doc(collection(db, 'notifications'))
      await setDoc(notificationRef, {
        userId: redemption.userId,
        title: 'Redemption Completed',
        body: `Your redemption of ${paidCurrency} ${paidAmount.toFixed(2)} has been successfully paid`,
        read: false,
        type: 'redemption',
        relatedId: reference,
        createdAt: Timestamp.now(),
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error handling transfer success:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update redemption' },
      { status: 500 }
    )
  }
}

async function handleTransferFailed(data: any) {
  const { reference, reason } = data

  try {
    // Update redemption status
    const redemptionRef = doc(db, 'redemptions', reference)
    const redemptionSnap = await getDoc(redemptionRef)

    if (redemptionSnap.exists()) {
      const redemption = redemptionSnap.data()
      const batch = writeBatch(db)

      // Update redemption
      batch.update(redemptionRef, {
        status: 'failed',
        failureReason: reason || 'Transfer failed',
        updatedAt: Timestamp.now(),
      })

      // Return credits to available
      const walletRef = doc(db, 'wallets', redemption.userId)
      const walletSnap = await getDoc(walletRef)
      if (walletSnap.exists()) {
        batch.update(walletRef, {
          availableCredits:
            (walletSnap.data().availableCredits || 0) + redemption.amount,
          pendingCredits:
            Math.max(0, (walletSnap.data().pendingCredits || 0) - redemption.amount),
          updatedAt: Timestamp.now(),
        })
      }

      // Create notification
      const notificationRef = doc(collection(db, 'notifications'))
      batch.set(notificationRef, {
        userId: redemption.userId,
        title: 'Redemption Failed',
        body: `Your redemption request could not be processed. Credits have been returned.`,
        read: false,
        type: 'redemption',
        relatedId: reference,
        createdAt: Timestamp.now(),
      })

      await batch.commit()
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error handling transfer failed:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to handle transfer failure' },
      { status: 500 }
    )
  }
}

async function handleTransferReversed(data: any) {
  const { reference } = data

  try {
    // Update redemption status
    const redemptionRef = doc(db, 'redemptions', reference)
    const redemptionSnap = await getDoc(redemptionRef)

    if (redemptionSnap.exists()) {
      const redemption = redemptionSnap.data()
      const batch = writeBatch(db)

      // Update redemption
      batch.update(redemptionRef, {
        status: 'reversed',
        failureReason: 'Transfer reversed',
        updatedAt: Timestamp.now(),
      })

      // Return credits to available
      const walletRef = doc(db, 'wallets', redemption.userId)
      const walletSnap = await getDoc(walletRef)
      if (walletSnap.exists()) {
        batch.update(walletRef, {
          availableCredits:
            (walletSnap.data().availableCredits || 0) + redemption.amount,
          pendingCredits:
            Math.max(0, (walletSnap.data().pendingCredits || 0) - redemption.amount),
          updatedAt: Timestamp.now(),
        })
      }

      // Create notification
      const notificationRef = doc(collection(db, 'notifications'))
      batch.set(notificationRef, {
        userId: redemption.userId,
        title: 'Redemption Reversed',
        body: `Your redemption has been reversed. Credits have been returned.`,
        read: false,
        type: 'redemption',
        relatedId: reference,
        createdAt: Timestamp.now(),
      })

      await batch.commit()
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error handling transfer reversed:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to handle transfer reversal' },
      { status: 500 }
    )
  }
}

// Add missing import
import { setDoc } from 'firebase/firestore'
