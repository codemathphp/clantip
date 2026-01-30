import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/firebase/config'
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore'

// Handle format validation: alphanumeric + underscore, 3-20 chars
function validateHandle(handle: string): { valid: boolean; error?: string } {
  const cleaned = handle.trim().replace(/^@/, '')
  if (!cleaned) return { valid: false, error: 'Handle cannot be empty' }
  if (cleaned.length < 3) return { valid: false, error: 'Handle must be at least 3 characters' }
  if (cleaned.length > 20) return { valid: false, error: 'Handle must be at most 20 characters' }
  if (!/^[a-zA-Z0-9_]+$/.test(cleaned)) {
    return { valid: false, error: 'Handle can only contain letters, numbers, and underscores' }
  }
  return { valid: true }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phone, handle } = body

    if (!phone) return NextResponse.json({ success: false, error: 'Missing phone' }, { status: 400 })
    if (!handle) return NextResponse.json({ success: false, error: 'Missing handle' }, { status: 400 })

    const validation = validateHandle(handle)
    if (!validation.valid) {
      return NextResponse.json({ success: false, error: validation.error }, { status: 400 })
    }

    const cleanedHandle = handle.trim().replace(/^@/, '')

    // Check uniqueness: is the new handle already taken (and not by the current user)?
    const usersRef = collection(db, 'users')
    const q = query(usersRef, where('handle', '==', cleanedHandle))
    const existingSnap = await getDocs(q)

    if (!existingSnap.empty) {
      const existingUser = existingSnap.docs[0].data()
      // Allow if it's the same user updating their own handle
      if (existingUser.phone !== phone) {
        return NextResponse.json({ success: false, error: 'Handle is already taken' }, { status: 409 })
      }
    }

    // Update user document
    const userRef = doc(db, 'users', phone)
    await updateDoc(userRef, { handle: cleanedHandle })

    return NextResponse.json({ success: true, data: { handle: cleanedHandle } })
  } catch (e: any) {
    console.error('Update handle error', e)
    return NextResponse.json({ success: false, error: e.message || 'Server error' }, { status: 500 })
  }
}
