import { NextResponse } from 'next/server'
import { db } from '@/firebase/config'
import { collection, query, where, getDocs } from 'firebase/firestore'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const handleRaw = body?.handle || ''
    if (!handleRaw) return NextResponse.json({ success: false, error: 'Missing handle' }, { status: 400 })

    const handle = handleRaw.replace(/^@/, '').trim()
    if (!handle) return NextResponse.json({ success: false, error: 'Invalid handle' }, { status: 400 })

    const usersRef = collection(db, 'users')
    const q = query(usersRef, where('handle', '==', handle))
    const snap = await getDocs(q)
    if (snap.empty) return NextResponse.json({ success: false, error: 'Handle not found' }, { status: 404 })

    // Return the first matched user
    const userDoc = snap.docs[0]
    const data = userDoc.data()
    return NextResponse.json({ success: true, data: { phone: data.phone, id: data.id, handle: data.handle } })
  } catch (e: any) {
    console.error('Resolve handle error', e)
    return NextResponse.json({ success: false, error: e.message || 'Server error' }, { status: 500 })
  }
}
