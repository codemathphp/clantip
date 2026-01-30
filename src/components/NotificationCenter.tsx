'use client'

import { useRouter } from 'next/navigation'
import { useNotifications } from '@/context/NotificationContext'
import { Bell } from 'lucide-react'

export function NotificationCenter() {
  const router = useRouter()
  const { unreadCount } = useNotifications()

  return (
    <button
      onClick={() => router.push('/app/notifications')}
      className="relative p-2 hover:bg-slate-100 rounded-lg transition"
      title="Notifications"
    >
      <Bell size={24} />
      {unreadCount > 0 && (
        <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-teal-600 rounded-full">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  )
}
