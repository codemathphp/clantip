import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/**
 * Custom hook to manage PWA install prompt.
 * Shows prompt periodically (every 7 days) unless app is already installed.
 * Call this in sender/recipient pages; skip for admin pages.
 */
export function usePwaPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)

  useEffect(() => {
    // Check if app is already installed (PWA mode)
    const isAppInstalled = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true

    if (isAppInstalled) {
      console.log('✅ App is already installed. Hiding PWA prompt.')
      return
    }

    // Check if user dismissed prompt recently (last 7 days)
    const lastDismissed = localStorage.getItem('pwaPromptDismissedAt')
    if (lastDismissed) {
      const daysSinceDismissed = (Date.now() - parseInt(lastDismissed)) / (1000 * 60 * 60 * 24)
      if (daysSinceDismissed < 7) {
        console.log(`PWA prompt dismissed ${Math.round(daysSinceDismissed)} days ago. Skipping for now.`)
        return
      }
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      // Show after a short delay so user settles in
      setTimeout(() => setShowPrompt(true), 3000)
    }

    const handleAppInstalled = () => {
      console.log('✅ PWA installed successfully')
      setDeferredPrompt(null)
      setShowPrompt(false)
      localStorage.removeItem('pwaPromptDismissedAt')
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return

    try {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      console.log(`User PWA install response: ${outcome}`)
      setDeferredPrompt(null)
      setShowPrompt(false)
    } catch (error) {
      console.error('Error installing PWA:', error)
    }
  }

  const handleDismiss = () => {
    // Remember dismissal for 7 days
    localStorage.setItem('pwaPromptDismissedAt', Date.now().toString())
    setShowPrompt(false)
  }

  return {
    showPrompt,
    handleInstall,
    handleDismiss,
  }
}
