import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY || 'sk_test_1e4db2e9a9c5c3ea8884d964439c60ba1659cfef'

export async function GET(request: NextRequest) {
  try {
    const reference = request.nextUrl.searchParams.get('reference')

    if (!reference) {
      return NextResponse.json(
        { success: false, message: 'Reference is required' },
        { status: 400 }
      )
    }

    console.log('🔍 Verifying payment reference:', reference)

    // Verify payment with Paystack
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET}`,
          'Content-Type': 'application/json',
        },
      }
    )

    console.log('✓ Paystack verification response:', response.data)
    console.log('📊 Payment status:', response.data.data?.status)

    if (response.data.status && response.data.data) {
      const paymentStatus = response.data.data.status
      console.log('✅ Verification successful, status:', paymentStatus)
      
      return NextResponse.json(
        {
          success: true,
          data: {
            status: paymentStatus,
            reference: response.data.data.reference,
            amount: response.data.data.amount,
            customer: response.data.data.customer,
          },
        },
        { status: 200 }
      )
    } else {
      console.error('❌ Invalid response structure:', response.data)
      return NextResponse.json(
        { success: false, message: 'Payment verification failed', data: response.data },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('❌ Payment verification error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { success: false, message: 'Payment verification failed', error: errorMessage },
      { status: 500 }
    )
  }
}
