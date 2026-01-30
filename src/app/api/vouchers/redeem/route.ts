import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/firebase/config'
import { doc, getDoc, updateDoc, writeBatch, Timestamp, collection } from 'firebase/firestore'

export async function POST(request: NextRequest) {
  try {
    const { voucherId } = await request.json()

    if (!voucherId) {
      return NextResponse.json(
        { success: false, error: 'Voucher ID required' },
        { status: 400 }
      )
    }

    // Get voucher details
    const voucherRef = doc(db, 'vouchers', voucherId)
    const voucherSnap = await getDoc(voucherRef)

    if (!voucherSnap.exists()) {
      return NextResponse.json(
        { success: false, error: 'Voucher not found' },
        { status: 404 }
      )
    }

    const voucher = voucherSnap.data()
    
    if (voucher.status !== 'delivered') {
      return NextResponse.json(
        { success: false, error: 'Voucher has already been redeemed or is invalid' },
        { status: 400 }
      )
    }

    const batch = writeBatch(db)

    // Update voucher status to redeemed
    batch.update(voucherRef, {
      status: 'redeemed',
      redeemedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })

    // Add amount to recipient's available credits
    // amount is stored in ZAR as whole number (not kobo)
    const walletRef = doc(db, 'wallets', voucher.recipientId)
    const walletSnap = await getDoc(walletRef)

    if (walletSnap.exists()) {
      const currentCredits = walletSnap.data().availableCredits || 0
      batch.update(walletRef, {
        availableCredits: currentCredits + voucher.amount,
        updatedAt: Timestamp.now(),
      })
    } else {
      // Create wallet if doesn't exist
      batch.set(walletRef, {
        userId: voucher.recipientId,
        phone: voucher.recipientId,
        availableCredits: voucher.amount,
        pendingCredits: 0,
        updatedAt: Timestamp.now(),
      })
    }

    // Create notification for the sender so they know the voucher was redeemed
    try {
      const senderId = voucher.senderId
      if (senderId) {
        const notificationRef = doc(collection(db, 'notifications'))
        batch.set(notificationRef, {
          userId: senderId,
          title: 'Gift Redeemed',
          body: `Your gift to ${voucher.recipientHandle || voucher.recipientId} worth R${(voucher.amount || 0).toFixed(2)} was redeemed`,
          read: false,
          type: 'voucher',
          relatedId: voucherId,
          createdAt: Timestamp.now(),
        })
      }
    } catch (e) {
      console.warn('Failed to enqueue sender notification on redeem', e)
    }

    await batch.commit()

    return NextResponse.json({
      success: true,
      message: `Voucher redeemed successfully. R${voucher.amount.toFixed(2)} added to your balance.`,
      amount: voucher.amount,
    })
  } catch (error) {
    console.error('Voucher redeem error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to redeem voucher' },
      { status: 500 }
    )
  }
}
