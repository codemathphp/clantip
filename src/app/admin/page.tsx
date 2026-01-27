'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { auth, db } from '@/firebase/config'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, query, where, getDocs, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Image from 'next/image'
import toast from 'react-hot-toast'
import {
  LayoutDashboard,
  ShoppingBag,
  Users,
  Settings,
  Bell,
  LogOut,
  ChevronRight,
  TrendingUp,
  DollarSign,
  CheckCircle,
  AlertCircle,
} from 'lucide-react'

type AdminTab = 'dashboard' | 'store' | 'users' | 'settings' | 'notifications'

const DEFAULT_FEES = {
  platformFee: 5,
  processingFee: 10,
  fixedFee: 0.20,
  minPayout: 100,
  maxVoucherAmount: 1000,
  heroBackgroundUrl: '',
}

const MENU_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'store', label: 'Store', icon: ShoppingBag },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'notifications', label: 'Notifications', icon: Bell },
]

export default function AdminDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard')
  const [dashboardData, setDashboardData] = useState({
    totalUsers: 0,
    totalPayments: 0,
    totalVouchers: 0,
    pendingRedemptions: 0,
  })
  const [redemptions, setRedemptions] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [storeItems, setStoreItems] = useState<any[]>([])
  const [settings, setSettings] = useState(DEFAULT_FEES)
  const [newVoucher, setNewVoucher] = useState({ label: '', amount: '' })
  const [notificationMessage, setNotificationMessage] = useState('')
  const [notificationTitle, setNotificationTitle] = useState('')

  // Define loadDashboardData before useEffect to avoid dependency array issues
  const loadDashboardData = useCallback(async () => {
    try {
      // Load stats
      const usersSnap = await getDocs(collection(db, 'users'))
      const paymentsSnap = await getDocs(collection(db, 'payments'))
      const vouchersSnap = await getDocs(collection(db, 'vouchers'))
      const redemptionsSnap = await getDocs(
        query(collection(db, 'redemptions'), where('status', '==', 'requested'))
      )

      setDashboardData({
        totalUsers: usersSnap.size,
        totalPayments: paymentsSnap.size,
        totalVouchers: vouchersSnap.size,
        pendingRedemptions: redemptionsSnap.size,
      })

      // Load redemptions
      setRedemptions(
        redemptionsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
      )

      // Load users
      setUsers(
        usersSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
      )

      // Load store items
      loadStoreItems()

      // Load settings
      loadSettings()
    } catch (error) {
      console.error('Error loading dashboard data:', error)
      toast.error('Failed to load dashboard data')
    }
  }, [])

  // Check if user is admin
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser: any) => {
      if (!authUser) {
        router.push('/auth')
        return
      }

      try {
        const userDoc = await getDocs(
          query(collection(db, 'users'), where('id', '==', authUser.uid))
        )

        if (userDoc.empty || userDoc.docs[0].data().role !== 'admin') {
          router.push('/')
          toast.error('Admin access only')
          return
        }

        setUser(authUser)
        await loadDashboardData()
      } catch (error) {
        console.error('Auth check error:', error)
        router.push('/')
      } finally {
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [router, loadDashboardData])

  const loadStoreItems = async () => {
    // Default items - can be moved to Firestore
    const items = [
      { id: 1, label: '$10', amount: 10, active: true },
      { id: 2, label: '$25', amount: 25, active: true },
      { id: 3, label: '$50', amount: 50, active: true },
      { id: 4, label: '$100', amount: 100, active: true },
      { id: 5, label: '$250', amount: 250, active: true },
      { id: 6, label: '$500', amount: 500, active: true },
    ]
    setStoreItems(items)
  }

  const loadSettings = async () => {
    try {
      const settingsSnap = await getDocs(collection(db, 'settings'))
      if (!settingsSnap.empty) {
        setSettings(settingsSnap.docs[0].data() as typeof DEFAULT_FEES)
      }
    } catch (error) {
      console.error('Error loading settings:', error)
    }
  }

  const handleApproveRedemption = async (redemptionId: string) => {
    try {
      await updateDoc(doc(db, 'redemptions', redemptionId), {
        status: 'approved',
        updatedAt: serverTimestamp(),
      })
      toast.success('Redemption approved')
      await loadDashboardData()
    } catch (error) {
      console.error('Error approving:', error)
      toast.error('Failed to approve redemption')
    }
  }

  const handleRejectRedemption = async (redemptionId: string) => {
    try {
      await updateDoc(doc(db, 'redemptions', redemptionId), {
        status: 'rejected',
        updatedAt: serverTimestamp(),
      })
      toast.success('Redemption rejected')
      await loadDashboardData()
    } catch (error) {
      console.error('Error rejecting:', error)
      toast.error('Failed to reject redemption')
    }
  }

  const handleBlockUser = async (userId: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        status: 'blocked',
      })
      toast.success('User blocked')
      await loadDashboardData()
    } catch (error) {
      console.error('Error blocking user:', error)
      toast.error('Failed to block user')
    }
  }

  const handleBanUser = async (userId: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        status: 'banned',
      })
      toast.success('User banned')
      await loadDashboardData()
    } catch (error) {
      console.error('Error banning user:', error)
      toast.error('Failed to ban user')
    }
  }

  const handleAddVoucher = async () => {
    if (!newVoucher.label || !newVoucher.amount) {
      toast.error('Please fill all fields')
      return
    }

    try {
      const newItem = {
        id: Math.max(...storeItems.map((i) => i.id), 0) + 1,
        label: newVoucher.label,
        amount: parseFloat(newVoucher.amount),
        active: true,
      }

      setStoreItems([...storeItems, newItem])
      setNewVoucher({ label: '', amount: '' })
      toast.success('Voucher added')

      // Save to Firestore
      await addDoc(collection(db, 'storeItems'), newItem)
    } catch (error) {
      console.error('Error adding voucher:', error)
      toast.error('Failed to add voucher')
    }
  }

  const handleToggleVoucher = async (voucherId: number) => {
    const updated = storeItems.map((item) =>
      item.id === voucherId ? { ...item, active: !item.active } : item
    )
    setStoreItems(updated)
    toast.success('Voucher updated')
  }

  const handleDeleteVoucher = async (voucherId: number) => {
    if (window.confirm('Are you sure you want to delete this voucher? This action cannot be undone.')) {
      const updated = storeItems.filter((item) => item.id !== voucherId)
      setStoreItems(updated)
      toast.success('Voucher deleted')
    }
  }

  const handleSaveSettings = async () => {
    try {
      const settingsRef = collection(db, 'settings')
      const settingsSnap = await getDocs(settingsRef)

      if (settingsSnap.empty) {
        await addDoc(settingsRef, settings)
      } else {
        await updateDoc(doc(db, 'settings', settingsSnap.docs[0].id), settings)
      }

      toast.success('Settings saved')
    } catch (error) {
      console.error('Error saving settings:', error)
      toast.error('Failed to save settings')
    }
  }

  const handleSendNotification = async () => {
    if (!notificationTitle || !notificationMessage) {
      toast.error('Please fill all notification fields')
      return
    }

    try {
      // Send to all users
      const usersSnap = await getDocs(collection(db, 'users'))

      for (const userDoc of usersSnap.docs) {
        await addDoc(collection(db, 'notifications'), {
          userId: userDoc.id,
          title: notificationTitle,
          body: notificationMessage,
          type: 'system',
          read: false,
          createdAt: serverTimestamp(),
        })
      }

      setNotificationTitle('')
      setNotificationMessage('')
      toast.success(`Notification sent to ${usersSnap.size} users`)
    } catch (error) {
      console.error('Error sending notification:', error)
      toast.error('Failed to send notification')
    }
  }


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-primary border-r-transparent mb-4"></div>
          <p className="text-lg font-semibold text-foreground">Loading Admin Dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-card border-r border-border transition-all duration-300 flex flex-col sticky top-0 h-screen shadow-lg`}
      >
        {/* Logo Section */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between">
            {sidebarOpen && (
              <div className="relative w-32 h-12">
                <Image
                  src="/clantip_logo.png"
                  alt="ClanTip"
                  fill
                  className="object-contain"
                />
              </div>
            )}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-accent/10 rounded-lg transition-colors"
            >
              <ChevronRight
                size={20}
                className={`transition-transform ${sidebarOpen ? 'rotate-180' : ''}`}
              />
            </button>
          </div>
        </div>

        {/* Menu Items */}
        <nav className="flex-1 p-4 space-y-2">
          {MENU_ITEMS.map((item) => {
            const Icon = item.icon
            const isActive = activeTab === item.id
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as AdminTab)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-md'
                    : 'text-muted-foreground hover:bg-accent/10 hover:text-foreground'
                }`}
                title={sidebarOpen ? '' : item.label}
              >
                <Icon size={20} className="flex-shrink-0" />
                {sidebarOpen && <span>{item.label}</span>}
              </button>
            )
          })}
        </nav>

        {/* Logout Button */}
        <div className="p-4 border-t border-border">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-red-500 hover:bg-red-500/10 hover:text-red-600"
            onClick={() => {
              auth.signOut()
              router.push('/')
            }}
          >
            <LogOut size={20} />
            {sidebarOpen && 'Logout'}
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Top Header */}
        <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-40">
          <div className="px-8 py-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {MENU_ITEMS.find((m) => m.id === activeTab)?.label}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">Manage your ClanTip platform</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">{user?.email}</span>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-semibold">
                {user?.email?.charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="p-8">
          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
            <div className="space-y-8 animate-fadeIn">
              {/* KPI Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Total Users Card */}
                <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Total Users
                      </CardTitle>
                      <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/20">
                        <Users size={20} className="text-blue-600" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-4xl font-bold text-foreground">{dashboardData.totalUsers}</p>
                    <p className="text-xs text-muted-foreground mt-1">Active users</p>
                  </CardContent>
                </Card>

                {/* Total Payments Card */}
                <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Total Payments
                      </CardTitle>
                      <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/20">
                        <DollarSign size={20} className="text-green-600" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-4xl font-bold text-foreground">${dashboardData.totalPayments}</p>
                    <p className="text-xs text-muted-foreground mt-1">Processed</p>
                  </CardContent>
                </Card>

                {/* Total Vouchers Card */}
                <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Total Vouchers
                      </CardTitle>
                      <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/20">
                        <ShoppingBag size={20} className="text-purple-600" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-4xl font-bold text-foreground">{dashboardData.totalVouchers}</p>
                    <p className="text-xs text-muted-foreground mt-1">Created</p>
                  </CardContent>
                </Card>

                {/* Pending Redemptions Card */}
                <Card className="border-0 shadow-md hover:shadow-lg transition-shadow bg-gradient-to-br from-accent/20 to-accent/5">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Pending Redemptions
                      </CardTitle>
                      <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/20">
                        <AlertCircle size={20} className="text-amber-600" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-4xl font-bold text-accent">{dashboardData.pendingRedemptions}</p>
                    <p className="text-xs text-muted-foreground mt-1">Awaiting approval</p>
                  </CardContent>
                </Card>
              </div>

              {/* Redemptions Table */}
              <Card className="border-0 shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle size={24} className="text-primary" />
                    Pending Redemption Requests
                  </CardTitle>
                  <CardDescription>Review and approve/reject pending requests</CardDescription>
                </CardHeader>
                <CardContent>
                  {redemptions.length === 0 ? (
                    <div className="py-12 text-center">
                      <div className="inline-block p-3 rounded-full bg-accent/10 mb-3">
                        <CheckCircle size={24} className="text-accent" />
                      </div>
                      <p className="text-muted-foreground">No pending redemptions</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {redemptions.map((redemption) => (
                        <div
                          key={redemption.id}
                          className="p-4 border border-border rounded-lg hover:bg-accent/5 transition-colors flex justify-between items-center"
                        >
                          <div>
                            <p className="font-semibold text-lg">${redemption.amount}</p>
                            <p className="text-sm text-muted-foreground">
                              {redemption.details?.accountName || 'N/A'}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => handleApproveRedemption(redemption.id)}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleRejectRedemption(redemption.id)}
                            >
                              Reject
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

        {/* Store Tab */}
        {activeTab === 'store' && (
          <div className="space-y-8 animate-fadeIn">
            {/* Add New Voucher */}
            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingBag size={24} className="text-primary" />
                  Add New Voucher Package
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Label (e.g., $50)</Label>
                    <Input
                      placeholder="$50"
                      value={newVoucher.label}
                      onChange={(e) => setNewVoucher({ ...newVoucher, label: e.target.value })}
                      className="border-border focus:ring-primary"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Amount</Label>
                    <Input
                      type="number"
                      placeholder="50"
                      value={newVoucher.amount}
                      onChange={(e) => setNewVoucher({ ...newVoucher, amount: e.target.value })}
                      className="border-border focus:ring-primary"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button onClick={handleAddVoucher} className="w-full bg-primary hover:bg-primary/90">
                      + Add Voucher
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Current Vouchers */}
            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle>Current Voucher Packages ({storeItems.length})</CardTitle>
                <CardDescription>Manage and toggle voucher availability</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {storeItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 border border-border rounded-lg space-y-3 hover:border-primary/50 hover:shadow-md transition-all"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-xl text-primary">{item.label}</p>
                          <p className="text-sm text-muted-foreground">${item.amount.toFixed(2)}</p>
                        </div>
                        <Badge variant={item.active ? 'default' : 'secondary'} className="ml-auto">
                          {item.active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => handleToggleVoucher(item.id)}
                        >
                          {item.active ? '✓ Disable' : '○ Enable'}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="flex-1"
                          onClick={() => handleDeleteVoucher(item.id)}
                        >
                          🗑️ Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="space-y-8 animate-fadeIn">
            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users size={24} className="text-primary" />
                  User Management ({users.length})
                </CardTitle>
                <CardDescription>View and manage user accounts</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Name</th>
                        <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Phone</th>
                        <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Role</th>
                        <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Status</th>
                        <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id} className="border-b border-border hover:bg-primary/5 transition-colors">
                          <td className="py-4 px-4">
                            <p className="font-medium">{u.fullName || 'N/A'}</p>
                          </td>
                          <td className="py-4 px-4 text-muted-foreground">{u.phone}</td>
                          <td className="py-4 px-4">
                            <Badge className="capitalize">{u.role}</Badge>
                          </td>
                          <td className="py-4 px-4">
                            <Badge
                              variant={
                                u.status === 'active'
                                  ? 'default'
                                  : u.status === 'blocked'
                                  ? 'secondary'
                                  : 'destructive'
                              }
                            >
                              {u.status}
                            </Badge>
                          </td>
                          <td className="py-4 px-4 space-x-2">
                            {u.status === 'active' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="hover:bg-amber-50 dark:hover:bg-amber-900/20 text-amber-600"
                                  onClick={() => handleBlockUser(u.id)}
                                >
                                  Block
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleBanUser(u.id)}
                                >
                                  Ban
                                </Button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="space-y-8 animate-fadeIn">
            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings size={24} className="text-primary" />
                  Fee Configuration
                </CardTitle>
                <CardDescription>Set platform fees and transaction limits</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                  {/* Platform Fee */}
                  <div className="space-y-3 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/20">
                        <DollarSign size={16} className="text-blue-600" />
                      </div>
                      <Label className="font-semibold">Platform Fee</Label>
                    </div>
                    <Input
                      type="number"
                      step="0.1"
                      value={settings.platformFee}
                      onChange={(e) =>
                        setSettings({ ...settings, platformFee: parseFloat(e.target.value) })
                      }
                      className="border-blue-200 dark:border-blue-800"
                    />
                    <p className="text-xs text-muted-foreground">
                      <span className="font-semibold text-blue-600">{settings.platformFee}%</span> per transaction
                    </p>
                  </div>

                  {/* Processing Fee */}
                  <div className="space-y-3 p-4 rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-800">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/20">
                        <DollarSign size={16} className="text-green-600" />
                      </div>
                      <Label className="font-semibold">Processing Fee</Label>
                    </div>
                    <Input
                      type="number"
                      step="0.1"
                      value={settings.processingFee}
                      onChange={(e) =>
                        setSettings({ ...settings, processingFee: parseFloat(e.target.value) })
                      }
                      className="border-green-200 dark:border-green-800"
                    />
                    <p className="text-xs text-muted-foreground">
                      <span className="font-semibold text-green-600">{settings.processingFee}%</span> per transaction
                    </p>
                  </div>

                  {/* Fixed Fee */}
                  <div className="space-y-3 p-4 rounded-lg bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-800">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/20">
                        <DollarSign size={16} className="text-purple-600" />
                      </div>
                      <Label className="font-semibold">Fixed Fee</Label>
                    </div>
                    <Input
                      type="number"
                      step="0.01"
                      value={settings.fixedFee}
                      onChange={(e) =>
                        setSettings({ ...settings, fixedFee: parseFloat(e.target.value) })
                      }
                      className="border-purple-200 dark:border-purple-800"
                    />
                    <p className="text-xs text-muted-foreground">
                      <span className="font-semibold text-purple-600">${settings.fixedFee}</span> per transaction
                    </p>
                  </div>

                  {/* Min Payout */}
                  <div className="space-y-3 p-4 rounded-lg bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-800">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/20">
                        <TrendingUp size={16} className="text-orange-600" />
                      </div>
                      <Label className="font-semibold">Min Payout</Label>
                    </div>
                    <Input
                      type="number"
                      step="0.01"
                      value={settings.minPayout}
                      onChange={(e) =>
                        setSettings({ ...settings, minPayout: parseFloat(e.target.value) })
                      }
                      className="border-orange-200 dark:border-orange-800"
                    />
                    <p className="text-xs text-muted-foreground">
                      Minimum: <span className="font-semibold text-orange-600">${settings.minPayout}</span>
                    </p>
                  </div>

                  {/* Max Voucher */}
                  <div className="space-y-3 p-4 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-800">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/20">
                        <ShoppingBag size={16} className="text-red-600" />
                      </div>
                      <Label className="font-semibold">Max Voucher</Label>
                    </div>
                    <Input
                      type="number"
                      step="0.01"
                      value={settings.maxVoucherAmount}
                      onChange={(e) =>
                        setSettings({ ...settings, maxVoucherAmount: parseFloat(e.target.value) })
                      }
                      className="border-red-200 dark:border-red-800"
                    />
                    <p className="text-xs text-muted-foreground">
                      Maximum: <span className="font-semibold text-red-600">${settings.maxVoucherAmount}</span>
                    </p>
                  </div>
                </div>

                {/* Hero Background Image URL */}
                <div className="space-y-3 p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/20">
                      <Image src="/clantip_logo.png" alt="hero" width={20} height={20} />
                    </div>
                    <Label className="font-semibold">Hero Background Image URL</Label>
                  </div>
                  <Input
                    type="text"
                    placeholder="https://example.com/hero.jpg"
                    value={(settings as any).heroBackgroundUrl || ''}
                    onChange={(e) => setSettings({ ...(settings as any), heroBackgroundUrl: e.target.value })}
                    className="border-emerald-200 dark:border-emerald-800"
                  />
                  <p className="text-xs text-muted-foreground">Enter a publicly accessible image URL for the homepage hero background</p>
                  {(settings as any).heroBackgroundUrl && (
                    <div className="mt-3 rounded-lg overflow-hidden border border-border">
                      <Image src={(settings as any).heroBackgroundUrl} alt="hero preview" width={600} height={160} className="w-full h-40 object-cover" />
                    </div>
                  )}
                </div>

                <Button onClick={handleSaveSettings} size="lg" className="bg-primary hover:bg-primary/90 w-full md:w-auto">
                  ✓ Save Settings
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <div className="space-y-8 animate-fadeIn">
            <Card className="border-0 shadow-md">
              <CardHeader>
                <div className="flex items-center justify-between w-full">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Bell size={24} className="text-primary" />
                      Broadcast Notification
                    </CardTitle>
                    <CardDescription>Send app-wide messages to all {users.length} active users</CardDescription>
                  </div>
                  <div>
                    <Button
                      onClick={handleSendNotification}
                      size="sm"
                      className="bg-emerald-600 text-white hover:bg-emerald-700 font-semibold"
                      disabled={!notificationTitle || !notificationMessage}
                    >
                      <Bell size={16} className="mr-2" />
                      Send
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <Label htmlFor="notif-title" className="font-semibold">Notification Title</Label>
                  <Input
                    id="notif-title"
                    placeholder="e.g., System Maintenance, New Feature Alert"
                    value={notificationTitle}
                    onChange={(e) => setNotificationTitle(e.target.value)}
                    className="border-border focus:ring-primary"
                  />
                </div>

                <div className="space-y-3">
                  <Label htmlFor="notif-message" className="font-semibold">Message</Label>
                  <textarea
                    id="notif-message"
                    placeholder="Enter your notification message... Be clear and concise."
                    value={notificationMessage}
                    onChange={(e) => setNotificationMessage(e.target.value)}
                    className="w-full px-4 py-3 border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                    rows={6}
                  />
                  <p className="text-xs text-muted-foreground">{notificationMessage.length}/500 characters</p>
                </div>

                <div className="bg-gradient-to-br from-primary/5 to-accent/5 p-6 rounded-lg border border-primary/10">
                  <p className="text-sm font-semibold text-muted-foreground mb-3">Preview (How users will see it):</p>
                  <div className="bg-card p-4 rounded-lg border border-border shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-full bg-primary/10">
                        <Bell size={20} className="text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-foreground">
                          {notificationTitle || 'Your notification title here'}
                        </p>
                        <p className="text-sm text-muted-foreground mt-2">
                          {notificationMessage || 'Your notification message will appear here...'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-sm text-blue-900 dark:text-blue-200">
                    <span className="font-semibold">📊 Recipients:</span> This notification will be sent to all {users.length} active users instantly.
                  </p>
                </div>

                <Button
                  onClick={handleSendNotification}
                  size="lg"
                  className="w-full bg-primary hover:bg-primary/90 text-white font-semibold"
                  disabled={!notificationTitle || !notificationMessage}
                >
                  <Bell size={18} className="mr-2" />
                  Send to All {users.length} Users
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
        </div>
      </main>
    </div>
  )
}