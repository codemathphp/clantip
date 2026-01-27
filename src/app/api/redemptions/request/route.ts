import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/firebase/config'
import { doc, updateDoc, getDoc, writeBatch, collection, Timestamp } from 'firebase/firestore'
import { verifyTransaction, createTransferRecipient, initiateTransfer } from '@/lib/paystack'

export async function POST(request: NextRequest) {
  try {
    const { redemptionId, userId, amount, bankCode, accountNumber, accountName } = await request.json()

    if (!redemptionId || !userId || !amount || !bankCode || !accountNumber || !accountName) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const batch = writeBatch(db)

    // Get user wallet
    const walletRef = doc(db, 'wallets', userId)
    const walletSnap = await getDoc(walletRef)

    if (!walletSnap.exists() || walletSnap.data().availableCredits < amount) {
      return NextResponse.json(
        { success: false, error: 'Insufficient credits' },
        { status: 400 }
      )
    }

    // Move credits to pending
    const currentWallet = walletSnap.data()
    batch.update(walletRef, {
      availableCredits: currentWallet.availableCredits - amount,
      pendingCredits: (currentWallet.pendingCredits || 0) + amount,
      updatedAt: Timestamp.now(),
    })

    // Create redemption request
    const redemptionRef = doc(db, 'redemptions', redemptionId)
    batch.set(redemptionRef, {
      id: redemptionId,
      userId,
      amount,
      method: 'bank_account',
      details: {
        bankCode,
        accountNumber,
        accountName,
        bankName: 'SA Bank', // Should be looked up
      },
      status: 'redemption_requested',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })

    // Create notification
    const notificationRef = doc(collection(db, 'notifications'))
    batch.set(notificationRef, {
      userId,
      title: 'Redemption Request Submitted',
      body: `Your redemption request of R${(amount / 100).toFixed(2)} has been submitted for processing.`,
      read: false,
      type: 'redemption',
      relatedId: redemptionId,
      createdAt: Timestamp.now(),
    })

    await batch.commit()

    return NextResponse.json({
      success: true,
      message: 'Redemption request submitted successfully',
    })
  } catch (error) {
    console.error('Redemption request error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
