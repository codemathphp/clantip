'use client'

import React from 'react'
import { Toaster } from 'react-hot-toast'
import { NotificationProvider } from '@/context/NotificationContext'
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration'
import { PWAInstallPrompt } from '@/components/PWAInstallPrompt'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NotificationProvider>
      <ServiceWorkerRegistration />
      <PWAInstallPrompt />
      {children}
      <Toaster position="bottom-center" />
    </NotificationProvider>
  )
}
