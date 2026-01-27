'use client'

import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the default install prompt
      e.preventDefault()
      // Store the event for later use
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      // Show our custom prompt after 2 seconds
      setTimeout(() => setShowPrompt(true), 2000)
    }

    const handleAppInstalled = () => {
      console.log('✅ PWA installed successfully')
      setDeferredPrompt(null)
      setShowPrompt(false)
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
      // Show the install prompt
      await deferredPrompt.prompt()
      // Wait for user choice
      const { outcome } = await deferredPrompt.userChoice
      console.log(`User response: ${outcome}`)
      // Clear the prompt
      setDeferredPrompt(null)
      setShowPrompt(false)
    } catch (error) {
      console.error('Error installing PWA:', error)
    }
  }

  if (!showPrompt || !deferredPrompt) {
    return null
  }

  return (
    <div className="fixed bottom-20 left-4 right-4 bg-white rounded-2xl shadow-xl border border-slate-200/50 p-4 z-40 md:left-auto md:right-4 md:w-80 animate-in slide-in-from-bottom">
      <div className="flex items-start gap-3">
        <div className="bg-primary/10 p-2 rounded-lg flex-shrink-0">
          <Download size={20} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm">Install ClanTip</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Install the app on your device for quick access and offline support
          </p>
          <div className="flex gap-2 mt-3">
            <Button
              size="sm"
              onClick={handleInstall}
              className="h-8 text-xs rounded-lg flex-1"
            >
              Install
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowPrompt(false)}
              className="h-8 text-xs rounded-lg"
            >
              <X size={14} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
