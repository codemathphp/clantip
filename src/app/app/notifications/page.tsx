'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { auth } from '@/firebase/config'
import { onAuthStateChanged } from 'firebase/auth'
import { useNotifications } from '@/context/NotificationContext'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Image from 'next/image'
import { Menu, X, Bell, Trash2, CheckCheck, Home, Gift, History, Settings, LogOut, ArrowLeft, Volume2, VolumeX } from 'lucide-react'
import toast from 'react-hot-toast'
import { isSoundEnabled, setSoundEnabled, playNotificationSound } from '@/lib/notificationSound'

export default function NotificationsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [showDrawer, setShowDrawer] = useState(false)
  const [soundEnabled, setSoundEnabledState] = useState(true)
  const { notifications, markAsRead, markAllAsRead, deleteNotification, clearAll } = useNotifications()

  useEffect(() => {
    setSoundEnabledState(isSoundEnabled())
  }, [])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user: any) => {
      if (!user) {
        router.push('/auth')
      }
      setLoading(false)
    })
    return () => unsubscribe()
  }, [router])

  const handleToggleSound = () => {
    const newState = !soundEnabled
    setSoundEnabledState(newState)
    setSoundEnabled(newState)
    if (newState) {
      playNotificationSound()
      toast.success('Notification sounds enabled')
    } else {
      toast.success('Notification sounds disabled')
    }
  }

  const getNotificationIcon = (type?: string) => {
    switch (type) {
      case 'payment':
        return '💳'
      case 'voucher':
        return '🎁'
      case 'redemption':
        return '📤'
      case 'admin':
        return '⚠️'
      default:
        return '🔔'
    }
  }

  const getNotificationColor = (type?: string) => {
    switch (type) {
      case 'payment':
        return 'border-l-blue-500 bg-blue-50'
      case 'voucher':
        return 'border-l-green-500 bg-green-50'
      case 'redemption':
        return 'border-l-purple-500 bg-purple-50'
      case 'admin':
        return 'border-l-red-500 bg-red-50'
      default:
        return 'border-l-slate-500 bg-slate-50'
    }
  }

  const getBadgeColor = (type?: string) => {
    switch (type) {
      case 'payment':
        return 'bg-blue-100 text-blue-800'
      case 'voucher':
        return 'bg-green-100 text-green-800'
      case 'redemption':
        return 'bg-purple-100 text-purple-800'
      case 'admin':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-slate-100 text-slate-800'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-accent/5">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-slate-200/50">
        <div className="px-4 py-3 flex items-center justify-between max-w-2xl mx-auto">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-slate-100 rounded-lg transition"
            >
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-xl font-bold">Notifications</h1>
          </div>
          <button
            onClick={() => setShowDrawer(!showDrawer)}
            className="p-2 hover:bg-slate-100 rounded-lg transition"
          >
            {showDrawer ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </header>

      {/* Navigation Drawer */}
      {showDrawer && (
        <div className="fixed inset-0 z-50 bg-black/20" onClick={() => setShowDrawer(false)}>
          <div className="fixed inset-y-0 left-0 w-64 bg-white shadow-lg animate-in slide-in-from-left" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-200/50 flex items-center justify-between">
              <div className="relative w-24 h-8">
                <Image
                  src="/clantip_logo.png"
                  alt="ClanTip Logo"
                  fill
                  className="object-contain"
                />
              </div>
              <button onClick={() => setShowDrawer(false)} className="p-1 hover:bg-slate-100 rounded">
                <X size={20} />
              </button>
            </div>

            <nav className="p-4 space-y-2">
              <button
                onClick={() => {
                  router.push('/app/sender')
                  setShowDrawer(false)
                }}
                className="w-full flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-slate-100 transition text-left"
              >
                <Home size={20} />
                <span className="text-sm font-medium">Send Credits</span>
              </button>
              <button
                onClick={() => {
                  router.push('/app/recipient')
                  setShowDrawer(false)
                }}
                className="w-full flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-slate-100 transition text-left"
              >
                <Gift size={20} />
                <span className="text-sm font-medium">Receive Credits</span>
              </button>

              <div className="my-3 border-t border-slate-200"></div>

              <button
                onClick={() => {
                  router.push('/app/notifications')
                  setShowDrawer(false)
                }}
                className="w-full flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-slate-100 transition text-left bg-slate-50 border border-slate-200"
              >
                <Bell size={20} />
                <span className="text-sm font-medium">Notifications</span>
              </button>
              <button
                onClick={() => setShowDrawer(false)}
                className="w-full flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-slate-100 transition text-left"
              >
                <Settings size={20} />
                <span className="text-sm font-medium">Settings</span>
              </button>
            </nav>

            <div className="absolute bottom-4 left-4 right-4">
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={() => {
                  auth.signOut()
                  router.push('/')
                }}
              >
                <LogOut size={18} />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* Controls */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold mb-1">All Notifications</h2>
            <p className="text-sm text-muted-foreground">
              {notifications.length === 0 ? 'No notifications' : `${notifications.length} total`}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            <Button
              size="sm"
              variant="outline"
              onClick={handleToggleSound}
              className="text-xs rounded-lg gap-1"
              title={soundEnabled ? 'Disable notification sounds' : 'Enable notification sounds'}
            >
              {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
              {soundEnabled ? 'Sound On' : 'Sound Off'}
            </Button>
            {notifications.length > 0 && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={markAllAsRead}
                  className="text-xs rounded-lg gap-1"
                >
                  <CheckCheck size={14} />
                  Mark all read
                </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={clearAll}
                className="text-xs rounded-lg gap-1 text-red-600 border-red-200 hover:bg-red-50"
              >
                <Trash2 size={14} />
                Clear all
              </Button>
              </>
            )}
          </div>
        </div>

        {/* Notifications List */}
        {notifications.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200/50">
            <div className="inline-block bg-slate-100 p-4 rounded-full mb-4">
              <Bell size={32} className="text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No notifications yet</h3>
            <p className="text-muted-foreground text-sm">
              When you receive gifts or your payments are processed, notifications will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`bg-white rounded-2xl p-4 border-l-4 border border-slate-200/50 transition hover:shadow-md ${getNotificationColor(notification.type)}`}
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className="text-3xl flex-shrink-0 mt-1">
                    {getNotificationIcon(notification.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex-1">
                        <h3 className="font-bold text-base text-foreground">
                          {notification.title}
                        </h3>
                        <Badge className={`mt-2 ${getBadgeColor(notification.type)}`}>
                          {notification.type || 'notification'}
                        </Badge>
                      </div>
                      {!notification.read && (
                        <div className="w-3 h-3 bg-primary rounded-full flex-shrink-0 mt-2" />
                      )}
                    </div>

                    <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
                      {notification.body}
                    </p>

                    <p className="text-xs text-muted-foreground mt-3">
                      {formatTime(notification.createdAt)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    {!notification.read && (
                      <button
                        onClick={() => markAsRead(notification.id)}
                        className="p-2 hover:bg-slate-200 rounded-lg transition text-muted-foreground hover:text-foreground"
                        title="Mark as read"
                      >
                        <CheckCheck size={18} />
                      </button>
                    )}
                    <button
                      onClick={() => {
                        deleteNotification(notification.id)
                        toast.success('Notification deleted')
                      }}
                      className="p-2 hover:bg-red-100 rounded-lg transition text-muted-foreground hover:text-red-600"
                      title="Delete"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function formatTime(date: Date | { toDate?: () => Date }) {
  const actualDate = date instanceof Date ? date : date.toDate?.() || new Date()
  const now = new Date()
  const diff = now.getTime() - actualDate.getTime()

  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`

  return actualDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: actualDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}
