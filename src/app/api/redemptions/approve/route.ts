import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/firebase/config'
import { doc, getDoc, updateDoc, writeBatch, collection, Timestamp } from 'firebase/firestore'
import { createTransferRecipient, initiateTransfer } from '@/lib/paystack'

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
        const recipientRes = await createTransferRecipient(
          'nuban',
          redemption.details.accountName,
          redemption.details.accountNumber,
          redemption.details.bankCode,
          'ZAR'
        )

        if (!recipientRes.status) {
          throw new Error('Failed to create transfer recipient')
        }

        recipientCode = recipientRes.data.recipient_code
      }

      // Initiate transfer
      const transferRes = await initiateTransfer(
        recipientCode,
        redemption.amount, // in kobo
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
