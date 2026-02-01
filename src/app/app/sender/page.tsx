import { Suspense } from 'react'
import SenderDashboard from '../sender-content'

function SenderLoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950">
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent"></div>
        <p className="mt-4 text-muted-foreground dark:text-slate-300">Loading...</p>
      </div>
    </div>
  )
}

export default function SenderPage() {
  return (
    <Suspense fallback={<SenderLoadingFallback />}>
      <SenderDashboard />
    </Suspense>
  )
}
