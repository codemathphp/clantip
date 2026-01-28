'use client'

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { Notification } from '@/types'
import { auth, db } from '@/firebase/config'
import { collection, query, where, onSnapshot, updateDoc, doc, deleteDoc } from 'firebase/firestore'
import { playNotificationSound } from '@/lib/notificationSound'

interface NotificationContextType {
  notifications: Notification[]
  unreadCount: number
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt'>) => void
  markAsRead: (id: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  deleteNotification: (id: string) => Promise<void>
  clearAll: () => Promise<void>
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const previousCountRef = useRef(0)

  // Listen to notifications from Firestore
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user: any) => {
      if (!user) {
        setNotifications([])
        setLoading(false)
        return undefined
      }

      try {
        const notificationsQuery = query(
          collection(db, 'notifications'),
          where('userId', '==', user.uid)
        )

        const unsubscribeNotifications = onSnapshot(notificationsQuery, (snapshot) => {
          const notifs = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as Notification))
            .sort((a, b) => b.createdAt.valueOf() - a.createdAt.valueOf())
          
          console.log(`🔔 [NotificationContext] Received ${notifs.length} notifications for user ${user.uid}`, notifs)
          
          // Check if new notifications have arrived
          if (notifs.length > previousCountRef.current && previousCountRef.current > 0) {
            console.log('🔊 Playing notification sound - new notification received')
            playNotificationSound()
          }
          
          previousCountRef.current = notifs.length
          setNotifications(notifs)
          setLoading(false)
        }, (error) => {
          console.error('❌ Error in notifications listener:', error)
        })

        return () => unsubscribeNotifications()
      } catch (error) {
        console.error('Error setting up notifications listener:', error)
        setLoading(false)
        return undefined
      }
    })

    return () => unsubscribe()
  }, [])

  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'createdAt'>) => {
    const newNotification: Notification = {
      ...notification,
      id: `notif_${Date.now()}`,
      createdAt: new Date(),
    }
    playNotificationSound()
    setNotifications(prev => [newNotification, ...prev])
  }, [])

  const markAsRead = useCallback(async (id: string) => {
    try {
      const notifRef = doc(db, 'notifications', id)
      await updateDoc(notifRef, { read: true })
      setNotifications(prev =>
        prev.map(notif => (notif.id === id ? { ...notif, read: true } : notif))
      )
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }, [])

  const markAllAsRead = useCallback(async () => {
    try {
      const unreadNotifs = notifications.filter(n => !n.read)
      await Promise.all(
        unreadNotifs.map(notif =>
          updateDoc(doc(db, 'notifications', notif.id), { read: true })
        )
      )
      setNotifications(prev => prev.map(notif => ({ ...notif, read: true })))
    } catch (error) {
      console.error('Error marking all as read:', error)
    }
  }, [notifications])

  const deleteNotification = useCallback(async (id: string) => {
    try {
      await deleteDoc(doc(db, 'notifications', id))
      setNotifications(prev => prev.filter(notif => notif.id !== id))
    } catch (error) {
      console.error('Error deleting notification:', error)
    }
  }, [])

  const clearAll = useCallback(async () => {
    try {
      await Promise.all(
        notifications.map(notif =>
          deleteDoc(doc(db, 'notifications', notif.id))
        )
      )
      setNotifications([])
    } catch (error) {
      console.error('Error clearing notifications:', error)
    }
  }, [notifications])

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        addNotification,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        clearAll,
      }}
    >
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (context === undefined) {
    throw new Error('useNotifications must be used within NotificationProvider')
  }
  return context
}
