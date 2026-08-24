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
  const { selectedYear } = useAssessmentYear()

  return (
    <header className="sticky top-0 z-40 bg-[#FAFAFA]/95 backdrop-blur border-b border-[#E2E8F0] px-4 py-3 flex items-center justify-between">
      <div>
        <h1 className="text-lg font-bold tracking-tight text-[#0F172A]">{title}</h1>
        {subtitle && <p className="text-xs text-[#64748B] mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2.5">
        <QuickUploadModal />
        
        {/* Static Display of Selected Assessment Year in Top Bar */}
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#F1F5F9] text-[#0F172A] border border-[#CBD5E1]">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          YA {selectedYear}
        </span>
      </div>
    </header>
  )
}

