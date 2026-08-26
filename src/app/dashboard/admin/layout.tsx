import React from 'react'
import { verifyAdminSession } from '@/lib/supabase/adminAuth'
import Link from 'next/link'
import { ShieldAlert, ArrowLeft } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const auth = await verifyAdminSession()

  if (!auth.isAdmin) {
    return (
      <main className="px-4 py-12 flex-1 max-w-2xl mx-auto flex flex-col items-center justify-center text-center">
        <div className="w-14 h-14 rounded-2xl bg-[#FEF2F2] border border-[#FECACA] flex items-center justify-center text-[#DC2626] mb-4 shadow-sm">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <h1 className="text-xl font-bold text-[#0F172A]">Access Restricted</h1>
        <p className="text-xs text-[#64748B] mt-2 mb-6 max-w-md leading-relaxed">
          Administrative privileges (`is_admin`) are required to access tax relief rule configuration and drafting workflows.
        </p>
        <Link
          href="/dashboard/expenses"
          className="inline-flex items-center gap-2 bg-[#0052FF] text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-[#0040CC] transition-colors shadow-sm"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
        </Link>
      </main>
    )
  }

  return <>{children}</>
}
