import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/firebase/config'
import { doc, getDoc, updateDoc, writeBatch, Timestamp } from 'firebase/firestore'
import { auth } from '@/firebase/config'

export async function POST(request: NextRequest) {
  try {
    const { voucherId } = await request.json()

    if (!voucherId) {
      return NextResponse.json(
        { success: false, error: 'Voucher ID required' },
        { status: 400 }
      )
    }

    // Get current user from Firebase Auth header (Vercel will pass this)
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
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

    // Verify the current user is the recipient
    // The client will send the user's UID, we validate against voucher.recipientId (phone)
    // For security, the client should pass their phone/UID which we can verify
    // For now, we'll trust the client (next step: verify via Firebase admin SDK)
    
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

    await batch.commit()

    return NextResponse.json({
      success: true,
      message: `Voucher redeemed successfully. R${(voucher.amount / 100).toFixed(2)} added to your balance.`,
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
