'use client'

import React, { useEffect, useRef } from 'react'

type Props = {
  src: string // Lottie JSON URL, local path (e.g., '/animations/heart.json'), or file name (e.g., 'heart.json')
  loop?: boolean
  autoplay?: boolean
  className?: string
  themeColor?: string // Hex color like '#1a9b8e' (Teal) or '#ff9500' (Orange)
}

/**
 * LottieIcon component that wraps a Lottie animation with color theming support.
 * Uses CSS filters (hue-rotate) to apply a unified premium color theme.
 * 
 * For more advanced color mapping, you can extend this to use lottie-web's
 * color replace layer functionality.
 */
export default function LottieIcon({
  src,
  loop = true,
  autoplay = true,
  className = '',
  themeColor = '#1a9b8e', // Default to Teal
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const lottieRef = useRef<any>(null)

  useEffect(() => {
    const loadLottie = async () => {
      try {
        const lottie = await import('lottie-web')
        const lottieDefault = (lottie as any).default || lottie

        // Resolve the source path
        // If it's just a filename or doesn't start with '/', prepend /animations/
        let animationUrl = src
        if (!src.startsWith('http') && !src.startsWith('/')) {
          animationUrl = `/animations/${src}`
        } else if (!src.startsWith('http') && src.startsWith('/') && !src.includes('/animations/')) {
          // If it's an absolute path without /animations/, assume local
          animationUrl = `/animations${src}`
        }

        // Fetch the animation JSON
        const response = await fetch(animationUrl)
        if (!response.ok) {
          throw new Error(`Failed to fetch animation: ${animationUrl}`)
        }
        const animationData = await response.json()

        if (containerRef.current && !lottieRef.current) {
          lottieRef.current = lottieDefault.loadAnimation({
            container: containerRef.current,
            renderer: 'svg',
            loop,
            autoplay,
            animationData,
            rendererSettings: {
              preserveAspectRatio: 'xMidYMid meet',
              clearCanvas: true,
            },
          })
        }
      } catch (error) {
        console.error('Error loading Lottie animation:', error)
      }
    }

    loadLottie()

    return () => {
      if (lottieRef.current) {
        lottieRef.current.destroy()
        lottieRef.current = null
      }
    }
  }, [src, loop, autoplay])

  // Calculate hue rotation to match the theme color
  // This is a simple approach; you can refine it for exact color matching
  const getHueRotation = (hex: string): number => {
    // Convert hex to HSL and calculate hue rotation needed
    // For now, use a preset mapping for common colors
    const colorMap: Record<string, number> = {
      '#1a9b8e': 190, // Teal
      '#ff9500': 40, // Orange
      '#10b981': 160, // Green
      '#ec4899': 320, // Pink
      '#f59e0b': 35, // Amber
    }
    return colorMap[hex.toLowerCase()] || 0
  }

  const hueRotation = getHueRotation(themeColor)

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        filter: `hue-rotate(${hueRotation}deg) saturate(1.2)`,
        width: '100%',
        height: '100%',
      }}
    />
  )
}
