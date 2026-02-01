'use client'

import React from 'react'
import { Toaster } from 'react-hot-toast'
import { NotificationProvider } from '@/context/NotificationContext'
import { ThemeProvider } from '@/context/ThemeContext'
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration'
import { PWAInstallPrompt } from '@/components/PWAInstallPrompt'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <NotificationProvider>
        <ServiceWorkerRegistration />
        <PWAInstallPrompt />
        {children}
        <Toaster position="bottom-center" />
      </NotificationProvider>
    </ThemeProvider>
  )
}
