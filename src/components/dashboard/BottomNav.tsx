import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ReceiptText, ShieldCheck, Clock, PlusCircle } from 'lucide-react'

interface BottomNavProps {
  pendingCount?: number
}

export function BottomNav({ pendingCount = 0 }: BottomNavProps) {
  const pathname = usePathname()

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
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#FFFFFF] border-t border-[#E2E8F0] shadow-sm max-w-lg mx-auto">
      <div className="flex items-center justify-around h-16 px-4">
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
                  <span className="absolute -top-1 -right-2 bg-[#F59E0B] text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
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
  )
}
