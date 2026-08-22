import React from 'react'
import { Navigation } from '@/components/dashboard/Navigation'
import { createServerClient } from '@/lib/supabase/server'

interface DashboardLayoutProps {
  children: React.ReactNode
}

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const supabase = await createServerClient()
  const { data: pendingData } = await supabase
    .from('receipts')
    .select('id')
    .eq('status', 'pending_review')

  const pendingCount = pendingData?.length || 0

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#0F172A] flex justify-center">
      <div className="w-full max-w-6xl min-h-screen flex flex-col lg:flex-row pb-20 lg:pb-0">
        {/* Single Shared Navigation for ALL Dashboard Pages */}
        <Navigation pendingCount={pendingCount} />

        {/* Dynamic Page Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {children}
        </div>
      </div>
    </div>
  )
}
