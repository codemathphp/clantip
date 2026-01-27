'use client'

import { useEffect } from 'react'
import toast from 'react-hot-toast'

export function ServiceWorkerRegistration() {
  useEffect(() => {
    // Check if service workers are supported
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      window.addEventListener('load', async () => {
        try {
          const registration = await navigator.serviceWorker.register('/service-worker.js', {
            scope: '/',
            updateViaCache: 'none',
          })

          console.log('✅ Service Worker registered successfully:', registration)

          // Listen for updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // New service worker is ready
                  toast.success('App updated! Restart for latest version.', {
                    duration: 5000,
                    icon: '🔄',
                  })

                  // Allow user to skip waiting
                  newWorker.postMessage({ type: 'SKIP_WAITING' })
                }
              })
            }
          })

          // Refresh page when new SW is activated
          let refreshing = false
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (refreshing) return
            refreshing = true
            window.location.reload()
          })
        } catch (error) {
          console.warn('⚠️ Service Worker registration failed:', error)
        }
      })

      // Periodic update check (every 1 hour)
      const updateCheckInterval = setInterval(async () => {
        try {
          const registration = await navigator.serviceWorker.getRegistration()
          if (registration) {
            registration.update()
          }
        } catch (error) {
          console.warn('Error checking for updates:', error)
        }
      }, 60 * 60 * 1000)

      return () => clearInterval(updateCheckInterval)
    }
    return undefined
  }, [])

  return null
}
