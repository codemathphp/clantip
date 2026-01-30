import { NextRequest, NextResponse } from 'next/server'
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  Timestamp,
  setDoc,
} from 'firebase/firestore'
import { db } from '@/firebase/config'

/**
 * POST /api/microgifts/send
 * Send a micro gift (emoji/lottie) using preloaded balance only
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { senderId, iconId, iconName, amount, recipientHandle, message } = body

    // Validation
    if (!senderId || !iconId || !iconName || !amount || !recipientHandle) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Step 1: Resolve recipient handle to phone
    let recipientPhone: string | null = null
    try {
      const usersQuery = query(
        collection(db, 'users'),
        where('handle', '==', recipientHandle.replace(/^@/, ''))
      )
      const usersSnap = await getDocs(usersQuery)
      if (!usersSnap.empty) {
        recipientPhone = usersSnap.docs[0].data().phone
      }
    } catch (e) {
      console.warn('Handle resolution failed:', e)
    }

    if (!recipientPhone) {
      return NextResponse.json(
        { error: 'Recipient not found' },
        { status: 404 }
      )
    }

    // Prevent self-send
    const senderRef = doc(db, 'users', senderId)
    const senderSnap = await getDoc(senderRef)
    if (!senderSnap.exists()) {
      return NextResponse.json(
        { error: 'Sender not found' },
        { status: 404 }
      )
    }

    const senderPhone = senderSnap.data()?.phone
    if (senderPhone === recipientPhone) {
      return NextResponse.json(
        { error: 'You cannot send a gift to yourself' },
        { status: 400 }
      )
    }

    // Step 2: Check sender balance
    const senderBalanceUsd = (senderSnap.data()?.senderBalance || 0) / 100
    const amountUsd = parseFloat(amount as string)

    if (senderBalanceUsd < amountUsd) {
      return NextResponse.json(
        { error: `Insufficient balance. You have $${senderBalanceUsd.toFixed(2)}` },
        { status: 402 }
      )
    }

    // Step 3: Deduct from sender balance & create microgift record
    const batch = writeBatch(db)
    const newBalance = Math.round((senderBalanceUsd - amountUsd) * 100)
    batch.update(senderRef, { senderBalance: newBalance })

    // Create microgift record
    const microgiftRef = doc(collection(db, 'microgifts'))
    batch.set(microgiftRef, {
      id: microgiftRef.id,
      senderId,
      senderPhone,
      recipientPhone,
      iconId,
      iconName,
      amount: Math.round(amountUsd * 100), // Store in cents
      currency: 'USD',
      message: message || '',
      status: 'sent',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })

    // Step 4: Create notification for recipient
    const notificationRef = doc(collection(db, 'notifications'))
    batch.set(notificationRef, {
      id: notificationRef.id,
      userId: recipientPhone,
      type: 'microgift',
      title: `Received ${iconName} 💝`,
      body: `${senderSnap.data()?.fullName || 'Someone'} sent you love!`,
      amount: Math.round(amountUsd * 100),
      senderId,
      senderName: senderSnap.data()?.fullName || 'Someone',
      senderHandle: senderSnap.data()?.handle || '',
      iconName,
      message: message || '',
      read: false,
      createdAt: Timestamp.now(),
    })

    // Commit all writes
    await batch.commit()

    return NextResponse.json(
      {
        success: true,
        microgiftId: microgiftRef.id,
        newBalance: newBalance / 100,
        message: `🎁 Love sent! You have $${(newBalance / 100).toFixed(2)} remaining`,
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Error sending microgift:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to send microgift' },
      { status: 500 }
    )
  }
}
