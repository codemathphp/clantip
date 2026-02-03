'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Redirect creator UI to recipient dashboard — creators manage streams via the recipient UI
export default function CreatorGiftStreamPageRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/app/recipient')
  }, [router])
  return null
}
