"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function SplashPage() {
  const router = useRouter()

  useEffect(() => {
    const t = setTimeout(() => {
      router.replace('/auth')
    }, 900)
    return () => clearTimeout(t)
  }, [router])

  return (
    <div
      aria-hidden
      style={{
        height: '100vh',
        width: '100vw',
        backgroundImage: "url('/splash-bg.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    />
  )
}
