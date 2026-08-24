'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ReceiptText, ShieldCheck, Clock, Settings } from 'lucide-react'

import { useAssessmentYear } from '@/context/YearContext'

interface NavigationProps {
  pendingCount?: number
}

export function Navigation({ pendingCount = 0 }: NavigationProps) {
  const pathname = usePathname()
  const { selectedYear } = useAssessmentYear()

  const navItems = [
    {
      label: 'Expenses',
      href: '/dashboard/expenses',
      icon: ReceiptText,
      active: pathname === '/dashboard/expenses' || pathname === '/dashboard',
    },
    {
      label: 'Tax Relief',
      href: '/dashboard/relief',
      icon: ShieldCheck,
      active: pathname === '/dashboard/relief',
    },
    {
      label: 'Pending',
      href: '/dashboard/pending',
      icon: Clock,
      active: pathname === '/dashboard/pending',
      badge: pendingCount > 0 ? pendingCount : null,
    },
    {
      label: 'Tax Profile',
      href: '/dashboard/profile',
      icon: Settings,
      active: pathname === '/dashboard/profile',
    },
  ]

  return (
    <>
      {/* Desktop Sidebar (lg screens >= 1024px) */}
      <aside className="hidden lg:flex flex-col w-64 border-r border-[#E2E8F0] bg-white h-screen sticky top-0 px-4 py-6 shrink-0 justify-between">
        <div className="space-y-6">
          <div className="px-3 flex items-center justify-between">
            <div>
              <span className="text-xl font-black text-[#0F172A] tracking-tight">ResitKu</span>
              <span className="block text-[11px] text-[#64748B]">Personal Expense & Tax</span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F1F5F9] text-[#64748B]">
              YA {selectedYear}
            </span>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    item.active
                      ? 'bg-[#0052FF] text-white shadow-sm'
                      : 'text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${item.active ? 'text-white' : 'text-[#64748B]'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        item.active
                          ? 'bg-white/20 text-white'
                          : 'bg-[#FEF3C7] text-[#D97706]'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              )
            })}
          </nav>
        </div>

        <div className="px-3 py-3 border-t border-[#F1F5F9] flex justify-between items-center text-[11px] text-[#94A3B8]">
          <span>Single-User Edition</span>
          <button
            type="button"
            onClick={async () => {
              const { supabase } = await import('@/lib/supabase/client')
              await supabase.auth.signOut()
              window.location.href = '/login'
            }}
            className="text-[#EF4444] hover:underline font-semibold"
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Navigation (< 1024px) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#FFFFFF] border-t border-[#E2E8F0] shadow-sm">
        <div className="flex items-center justify-around h-16 px-4 max-w-lg mx-auto">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center w-full h-full min-h-[44px] transition-colors ${
                  item.active
                    ? 'text-[#0052FF] font-semibold'
                    : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                <div className="relative">
                  <Icon className="w-5 h-5 mb-1" />
                  {item.badge && (
                    <span className="absolute -top-1 -right-2 bg-[#D97706] text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </div>
                <span className="text-[11px] tracking-tight">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
