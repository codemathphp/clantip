import { db } from '@/firebase/config'
import { doc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { NextRequest, NextResponse } from 'next/server'

/**
 * PUT /api/admin/users/[uid] - Update user information
 * 
 * Body:
 * {
 *   fullName?: string,
 *   email?: string,
 *   phoneE164?: string,
 *   handle?: string,
 *   role?: 'sender' | 'recipient' | 'admin',
 *   status?: 'active' | 'suspended' | 'deleted'
 * }
 */
export async function PUT(request: NextRequest, { params }: { params: { uid: string } }) {
  try {
    const { uid } = await Promise.resolve(params)
    
    // Verify admin access (in production, validate against auth token)
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { fullName, email, phoneE164, handle, role, status } = body

    // Validate uid
    if (!uid || typeof uid !== 'string') {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
    }

    // Check if user exists
    const userRef = doc(db, 'users', uid)
    const userSnap = await getDoc(userRef)
    if (!userSnap.exists()) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Build update object - only include provided fields
    const updateData: Record<string, any> = {}
    if (fullName !== undefined) updateData.fullName = fullName
    if (email !== undefined) updateData.email = email
    if (phoneE164 !== undefined) updateData.phoneE164 = phoneE164
    if (handle !== undefined) updateData.handle = handle
    if (role !== undefined) updateData.role = role
    if (status !== undefined) updateData.status = status

    // Only set updatedAt if there's something to update
    if (Object.keys(updateData).length > 0) {
      updateData.updatedAt = serverTimestamp()
      await updateDoc(userRef, updateData)
    }

    const updatedSnap = await getDoc(userRef)
    return NextResponse.json({ success: true, user: updatedSnap.data() }, { status: 200 })
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update user' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/admin/users/[uid] - Fetch user information
 */
export async function GET(request: NextRequest, { params }: { params: { uid: string } }) {
  try {
    const { uid } = await Promise.resolve(params)

    if (!uid || typeof uid !== 'string') {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
    }

    const userRef = doc(db, 'users', uid)
    const userSnap = await getDoc(userRef)
    
    if (!userSnap.exists()) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ user: userSnap.data() }, { status: 200 })
  } catch (error) {
    console.error('Error fetching user:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch user' },
      { status: 500 }
    )
  }
}
