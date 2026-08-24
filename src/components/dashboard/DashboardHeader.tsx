'use client'

import React from 'react'
import { QuickUploadModal } from '@/components/dashboard/QuickUploadModal'
import { useAssessmentYear } from '@/context/YearContext'
import { ChevronDown } from 'lucide-react'

interface HeaderProps {
  title: string
  subtitle?: string
}

export function DashboardHeader({ title, subtitle }: HeaderProps) {
  const { selectedYear, setSelectedYear, availableYears } = useAssessmentYear()

  return (
    <header className="sticky top-0 z-40 bg-[#FAFAFA]/95 backdrop-blur border-b border-[#E2E8F0] px-4 py-3 flex items-center justify-between">
      <div>
        <h1 className="text-lg font-bold tracking-tight text-[#0F172A]">{title}</h1>
        {subtitle && <p className="text-xs text-[#64748B] mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2.5">
        <QuickUploadModal />
        
        {/* Synced Global Assessment Year Selector in Navbar */}
        <div className="relative inline-flex items-center">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="appearance-none bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#0F172A] font-bold text-xs pl-3 pr-7 py-1.5 rounded-full border border-[#CBD5E1] transition-colors cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[#0052FF]"
            title="Change Assessment Year"
          >
            {availableYears.map((y) => (
              <option key={y} value={y}>
                YA {y}
              </option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-[#64748B] absolute right-2 pointer-events-none" />
        </div>
      </div>
    </header>
  )
}

