import { NextRequest, NextResponse } from 'next/server'
import { doc, getDoc, updateDoc, collection, setDoc, Timestamp } from 'firebase/firestore'
import { db } from '@/firebase/config'
import axios from 'axios'

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY || 'sk_test_1e4db2e9a9c5c3ea8884d964439c60ba1659cfef'

/**
 * POST /api/microgifts/top-up
 * Complete a top-up payment and credit sender balance
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { reference, uid, amountCents } = body

    if (!reference || !uid || !amountCents) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Verify payment with Paystack (server-side, secure)
    const verifyRes = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!verifyRes.data.status || verifyRes.data.data?.status !== 'success') {
      return NextResponse.json(
        { error: 'Payment verification failed' },
        { status: 400 }
      )
    }

    // Get user and update balance
    const userRef = doc(db, 'users', uid)
    const userSnap = await getDoc(userRef)

    if (!userSnap.exists()) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const userData = userSnap.data()
    const currentBalance = (userData?.senderBalance || 0) as number
    const newBalance = currentBalance + amountCents

    // Update user balance
    await updateDoc(userRef, {
      senderBalance: newBalance,
      updatedAt: Timestamp.now(),
    })

    // Create notification
    try {
      const notificationRef = doc(collection(db, 'notifications'))
      await setDoc(notificationRef, {
        userId: uid,
        type: 'topup',
        title: '💰 Wallet Topped Up',
        body: `You added $${(amountCents / 100).toFixed(2)} to your wallet. Ready to send some Love!`,
        read: false,
        createdAt: Timestamp.now(),
      })
    } catch (e) {
      console.warn('Failed to create notification:', e)
    }

    return NextResponse.json(
      {
        success: true,
        newBalance: newBalance / 100,
        message: `✅ Wallet topped up! You now have $${(newBalance / 100).toFixed(2)}`,
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Top-up error:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to process top-up' },
      { status: 500 }
    )
  }
}
