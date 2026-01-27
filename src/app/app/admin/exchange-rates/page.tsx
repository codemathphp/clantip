'use client'

import { useEffect, useState } from 'react'
import { auth } from '@/firebase/config'
import { onAuthStateChanged } from 'firebase/auth'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/button'

interface ExchangeRates {
  USD_TO_ZAR: number
  GBP_TO_ZAR: number
  EUR_TO_ZAR: number
  [key: string]: number
}

export default function ExchangeRatesPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [rates, setRates] = useState<ExchangeRates>({
    USD_TO_ZAR: 18.50,
    GBP_TO_ZAR: 23.50,
    EUR_TO_ZAR: 20.00,
  })
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user: any) => {
      if (!user) {
        toast.error('Not authenticated')
        return
      }

      // TODO: Add proper admin role check
      // For now, assume authenticated user is admin
      setIsAdmin(true)

      try {
        const response = await fetch('/api/admin/exchange-rates')
        const result = await response.json()

        if (result.success && result.data.rates) {
          setRates(result.data.rates)
        }
      } catch (error) {
        console.error('Error fetching exchange rates:', error)
      } finally {
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [])

  const handleRateChange = (currency: string, value: string) => {
    const numValue = parseFloat(value)
    if (!isNaN(numValue) && numValue > 0) {
      setRates((prev) => ({
        ...prev,
        [currency]: numValue,
      }))
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/admin/exchange-rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rates }),
      })

      const result = await response.json()

      if (result.success) {
        toast.success('Exchange rates updated successfully')
      } else {
        toast.error(result.error || 'Failed to update rates')
      }
    } catch (error) {
      console.error('Error saving rates:', error)
      toast.error('Failed to save exchange rates')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent"></div>
          <p className="mt-4 text-muted-foreground">Loading exchange rates...</p>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Access denied. Admin only.</p>
          <Button onClick={() => window.location.href = '/app/sender'}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-accent/5 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold mb-2">Exchange Rates Management</h1>
          <p className="text-muted-foreground mb-6">Set currency conversion rates for payments</p>

          <div className="space-y-6">
            {Object.entries(rates).map(([currency, rate]) => (
              <div key={currency} className="border-b pb-4 last:border-b-0">
                <label className="block text-sm font-medium mb-2">
                  {currency.replace('_', ' → ')}
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">1</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={rate}
                    onChange={(e) => handleRateChange(currency, e.target.value)}
                    className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <span className="text-sm text-muted-foreground">ZAR</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-2">ℹ️ Exchange Rate Examples</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• If USD_TO_ZAR = 18.50, then $1 USD = R18.50 ZAR</li>
              <li>• When user sends $152 USD, it will convert to R2,812 ZAR</li>
              <li>• These rates are applied at payment initialization</li>
            </ul>
          </div>

          <div className="mt-6 flex gap-4">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="flex-1"
            >
              {saving ? 'Saving...' : 'Save Exchange Rates'}
            </Button>
            <Button
              variant="outline"
              onClick={() => window.location.href = '/app/sender'}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
