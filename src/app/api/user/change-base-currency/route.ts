import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/firebase/config'
import { doc, getDoc, runTransaction, Timestamp } from 'firebase/firestore'

type Rates = Record<string, number>

function formatCents(n: number) {
  return Math.round(n * 100) / 100
}

// Convert amount (units) from currentCurrency -> targetCurrency using exchangeRates
function convertAmountUnits(amountUnits: number, currentCurrency: string, targetCurrency: string, rates: Rates) {
  if (currentCurrency === targetCurrency) return amountUnits

  // Helper keys
  const zarToTarget = rates[`ZAR_TO_${targetCurrency}`]
  const zarToCurrent = rates[`ZAR_TO_${currentCurrency}`]
  const usdToCurrent = rates[`USD_TO_${currentCurrency}`]
  const usdToTarget = rates[`USD_TO_${targetCurrency}`]
  const usdToZar = rates['USD_TO_ZAR']

  // If current is ZAR
  if (currentCurrency === 'ZAR' && typeof zarToTarget === 'number') {
    return amountUnits * zarToTarget
  }

  // If target is ZAR
  if (targetCurrency === 'ZAR' && typeof zarToCurrent === 'number') {
    return amountUnits / zarToCurrent
  }

  // Use USD bridge if possible: current -> USD -> target
  if (typeof usdToCurrent === 'number' && typeof usdToTarget === 'number') {
    const amountInUSD = amountUnits / usdToCurrent
    return amountInUSD * usdToTarget
  }

  // Use ZAR bridge if possible
  if (typeof zarToCurrent === 'number' && typeof zarToTarget === 'number') {
    const amountInZar = amountUnits / zarToCurrent
    return amountInZar * zarToTarget
  }

  // As last resort, if we have USD<->ZAR pair and either side available
  if (currentCurrency === 'USD' && typeof usdToZar === 'number' && typeof zarToTarget === 'number') {
    const zar = amountUnits * usdToZar
    return zar * zarToTarget
  }

  // Cannot convert
  return null
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phone, newCurrency, newCountry } = body || {}

    if (!phone || !newCurrency) {
      return NextResponse.json({ success: false, error: 'Missing phone or newCurrency' }, { status: 400 })
    }

    const userRef = doc(db, 'users', phone)
    const walletRef = doc(db, 'wallets', phone)
    const ratesRef = doc(db, 'settings', 'exchangeRates')

    const result = await runTransaction(db, async (tx) => {
      const [userSnap, walletSnap, ratesSnap] = await Promise.all([
        tx.get(userRef),
        tx.get(walletRef),
        tx.get(ratesRef),
      ])

      if (!userSnap.exists()) throw new Error('User not found')
      if (!walletSnap.exists()) throw new Error('Wallet not found')
      if (!ratesSnap.exists()) throw new Error('Exchange rates not configured')

      const userData: any = userSnap.data()
      const walletData: any = walletSnap.data()
      const ratesData: any = ratesSnap.data()
      const rates: Rates = ratesData.rates || ratesData || {}

      const currentCurrency = userData.baseCurrency || 'ZAR'

      // availableCredits is stored in subunits (cents) of current currency
      const availableSubunits: number = walletData.availableCredits || 0
      const availableUnits = availableSubunits / 100

      const convertedUnits = convertAmountUnits(availableUnits, currentCurrency, newCurrency, rates)
      if (convertedUnits === null) throw new Error('Unable to convert between currencies with current rates')

      const feePercent = 0.02
      const feeUnits = convertedUnits * feePercent
      const finalUnits = convertedUnits - feeUnits

      const finalSubunits = Math.round(finalUnits * 100)

      // Update user and wallet
      tx.update(userRef, {
        baseCountry: newCountry || userData.baseCountry || null,
        baseCurrency: newCurrency,
        updatedAt: Timestamp.now(),
      })

      tx.update(walletRef, {
        availableCredits: finalSubunits,
        updatedAt: Timestamp.now(),
      })

      return {
        phone,
        old: { amountUnits: availableUnits, currency: currentCurrency },
        converted: { amountUnits: Number(formatCents(convertedUnits)), currency: newCurrency },
        fee: { amountUnits: Number(formatCents(feeUnits)), currency: newCurrency },
        final: { amountUnits: Number(formatCents(finalUnits)), currency: newCurrency },
      }
    })

    return NextResponse.json({ success: true, data: result })
  } catch (error: any) {
    console.error('Error changing base currency:', error)
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 })
  }
}
