'use client'

import React, { useEffect, useState } from 'react'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { TelegramLinkCard } from '@/components/dashboard/TelegramLinkCard'
import { TaxReliefProfileForm } from '@/components/dashboard/TaxReliefProfileForm'
import { FilingProfile } from '@/lib/relief/applicableCategories'

export default function TaxProfilePage() {
  const [loading, setLoading] = useState(true)
  const [telegramId, setTelegramId] = useState<number | null>(null)
  const [filingProfile, setFilingProfile] = useState<FilingProfile | null>(null)
  const [rules, setRules] = useState<any[]>([])

  useEffect(() => {
    async function loadProfileAndRules() {
      try {
        setLoading(true)
        const [profileRes, rulesRes] = await Promise.all([
          fetch('/api/profile'),
          fetch('/api/rules?year=2025')
        ])
        
        const data = await profileRes.json()
        const rulesData = await rulesRes.json()

        if (data.telegram_id !== undefined) {
          setTelegramId(data.telegram_id)
        }
        if (data.filing_profile) {
          setFilingProfile(data.filing_profile)
        }
        if (rulesData.rules) {
          setRules(rulesData.rules)
        }
      } catch (err) {
        console.error('Failed to load profile or rules:', err)
      } finally {
        setLoading(false)
      }
    }

    loadProfileAndRules()
  }, [])

  if (loading) {
    return (
      <>
        <DashboardHeader
          title="Tax Profile & Settings"
          subtitle="Manage tax relief allowances and connected accounts"
        />
        <main className="px-4 py-6 space-y-6 flex-1 max-w-3xl">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-8 text-center text-xs text-[#64748B]">
            Loading profile settings...
          </div>
        </main>
      </>
    )
  }

  return (
    <>
      <DashboardHeader
        title="Tax Profile & Settings"
        subtitle="Manage tax relief allowances and connected accounts"
      />

      <main className="px-4 py-6 space-y-6 flex-1 max-w-3xl">
        {/* 1. Telegram Bot Integration Card */}
        <TelegramLinkCard
          telegramId={telegramId}
          onTelegramIdChange={setTelegramId}
        />

        {/* 2. Personal Tax Profile & Filing Status Form */}
        <TaxReliefProfileForm initialProfile={filingProfile} initialRules={rules} />
      </main>
    </>
  )
}
