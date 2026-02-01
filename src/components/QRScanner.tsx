"use client"

import React, { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'

type Props = {
  onDetected: (data: string) => void
  onClose: () => void
}

// Helper: track events (can integrate with analytics later)
const trackEvent = (eventName: string, data?: Record<string, any>) => {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', eventName, data || {})
  }
  console.log(`[Analytics] ${eventName}`, data || {})
}

export default function QRScanner({ onDetected, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isScanning, setIsScanning] = useState(true)

  useEffect(() => {
    let stream: MediaStream | null = null
    let scanning = true
    const startTime = Date.now()

    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }

        const BarcodeDetector = (window as any).BarcodeDetector
        if (BarcodeDetector) {
          const detector = new BarcodeDetector({ formats: ['qr_code'] })
          const poll = async () => {
            if (!scanning) return
            try {
              const barcodes = await detector.detect(videoRef.current!)
              if (barcodes && barcodes.length) {
                scanning = false
                setIsScanning(false)
                const scanDuration = Date.now() - startTime
                playSuccessSound()
                trackEvent('qr_scan_success', { method: 'barcode_detector', duration: scanDuration })
                onDetected(barcodes[0].rawValue || barcodes[0].rawText || '')
                return
              }
            } catch (e) {
              // detection may throw intermittently — ignore and retry
            }
            setTimeout(poll, 300)
          }
          poll()
        } else {
          // Fallback: draw video frames to canvas and run jsQR
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          const scan = () => {
            if (!scanning || !videoRef.current || !ctx) return
            try {
              const video = videoRef.current
              canvas.width = video.videoWidth
              canvas.height = video.videoHeight
              if (canvas.width === 0 || canvas.height === 0) {
                requestAnimationFrame(scan)
                return
              }
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
              const code = jsQR(imageData.data, canvas.width, canvas.height)
              if (code && code.data) {
                scanning = false
                setIsScanning(false)
                const scanDuration = Date.now() - startTime
                playSuccessSound()
                trackEvent('qr_scan_success', { method: 'jsqr_fallback', duration: scanDuration })
                onDetected(code.data)
                return
              }
            } catch (e) {
              // ignore and continue
            }
            requestAnimationFrame(scan)
          }
          requestAnimationFrame(scan)
        }
      } catch (e: any) {
        setError(e?.message || 'Camera permission denied or unavailable.')
      }
    }

    start()

    return () => {
      scanning = false
      if (stream) stream.getTracks().forEach((t) => t.stop())
      trackEvent('qr_scanner_closed', { duration: Date.now() - startTime })
    }
  }, [onDetected])

  // Play success sound feedback
  const playSuccessSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gain = audioContext.createGain()
      oscillator.connect(gain)
      gain.connect(audioContext.destination)
      oscillator.frequency.value = 800
      gain.gain.setValueAtTime(0.3, audioContext.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2)
      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.2)
    } catch (e) {
      // AudioContext may not be available
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="relative w-full max-w-md rounded-xl bg-white dark:bg-slate-900 overflow-hidden">
        <div className="flex items-center justify-between p-3 border-b">
          <h3 className="font-semibold">Scanning to send love</h3>
          <button onClick={onClose} className="p-1">
            <X />
          </button>
        </div>

        <div className="flex flex-col items-center p-3">
          {error ? (
            <div className="p-4 text-sm text-center">
              <p>{error}</p>
              <div className="mt-3">
                <Button onClick={onClose}>Close</Button>
              </div>
            </div>
          ) : (
            <>
              <div className="relative w-full h-64 bg-black rounded-lg overflow-hidden">
                <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                {isScanning && (
                  <>
                    {/* Animated scanning line */}
                    <div className="absolute inset-0 pointer-events-none">
                      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-b from-teal-400 to-transparent animate-pulse" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        {/* Visual reticle/crosshair */}
                        <div className="w-32 h-32 border-2 border-teal-400/50 rounded-lg">
                          <div className="absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-teal-400 to-transparent transform -translate-y-1/2" />
                          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-teal-400 to-transparent transform -translate-x-1/2" />
                          {/* Corner accents */}
                          <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-teal-400" />
                          <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-teal-400" />
                          <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-teal-400" />
                          <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-teal-400" />
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
              <p className="text-sm text-muted-foreground dark:text-slate-300 mt-2">Point your camera at a ClanTip QR code</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
