import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/firebase/config'
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore'

// Get current exchange rates
export async function GET() {
  try {
    const ratesDoc = await getDoc(doc(db, 'settings', 'exchangeRates'))
    
    if (!ratesDoc.exists()) {
      // Return default rates if not set
      return NextResponse.json({
        success: true,
        data: {
          rates: {
            USD_TO_ZAR: 18.50,
            GBP_TO_ZAR: 23.50,
            EUR_TO_ZAR: 20.00,
          },
          updatedAt: new Date().toISOString(),
        },
      })
    }

    return NextResponse.json({
      success: true,
      data: ratesDoc.data(),
    })
  } catch (error) {
    console.error('Error fetching exchange rates:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch exchange rates' },
      { status: 500 }
    )
  }
}

// Update exchange rates
export async function POST(request: NextRequest) {
  try {
    const { rates } = await request.json()

    if (!rates || typeof rates !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Invalid rates format' },
        { status: 400 }
      )
    }

    // Validate all rates are positive numbers
    for (const [key, value] of Object.entries(rates)) {
      if (typeof value !== 'number' || value <= 0) {
        return NextResponse.json(
          { success: false, error: `Invalid rate for ${key}: must be positive number` },
          { status: 400 }
        )
      }
    }

    await setDoc(
      doc(db, 'settings', 'exchangeRates'),
      {
        rates,
        updatedAt: Timestamp.now(),
      },
      { merge: true }
    )

    console.log('✓ Exchange rates updated:', rates)

    return NextResponse.json({
      success: true,
      message: 'Exchange rates updated successfully',
      data: { rates, updatedAt: new Date().toISOString() },
    })
  } catch (error) {
    console.error('Error updating exchange rates:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update exchange rates' },
      { status: 500 }
    )
  }
}
