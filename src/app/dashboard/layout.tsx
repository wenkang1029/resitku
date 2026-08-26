import React from 'react'
import { Navigation } from '@/components/dashboard/Navigation'
import { createServerClient } from '@/lib/supabase/server'
import { YearProvider } from '@/context/YearContext'

interface DashboardLayoutProps {
  children: React.ReactNode
}

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const supabase = await createServerClient()
  const [
    { data: pendingData },
    { data: { user } },
  ] = await Promise.all([
    supabase.from('receipts').select('id').eq('status', 'pending_review'),
    supabase.auth.getUser(),
  ])

  let isAdmin = false
  if (user) {
    const { data: userData } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single()
    isAdmin = Boolean(userData?.is_admin)
  }

  const pendingCount = pendingData?.length || 0

  return (
    <YearProvider>
      <div className="min-h-screen bg-[#FAFAFA] text-[#0F172A] flex justify-center">
        <div className="w-full max-w-6xl min-h-screen flex flex-col lg:flex-row pb-20 lg:pb-0">
          {/* Single Shared Navigation for ALL Dashboard Pages */}
          <Navigation pendingCount={pendingCount} isAdmin={isAdmin} />

          {/* Dynamic Page Content */}
          <div className="flex-1 flex flex-col min-w-0">
            {children}
          </div>
        </div>
      </div>
    </YearProvider>
  )
}

