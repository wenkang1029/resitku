'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import {
  calculateReliefProgress,
  ReliefRule,
  Receipt,
  ReliefCalculationResult,
  CategoryReliefProgress,
} from '@/lib/relief/calculateRelief'
import {
  FilingProfile,
  getApplicableCategoryKeys,
} from '@/lib/relief/applicableCategories'
import Link from 'next/link'
import {
  ChevronDown,
  ChevronUp,
  Layers,
  AlertTriangle,
  FileText,
  Download,
  Printer,
} from 'lucide-react'

function formatRM(amount: number): string {
  return `RM ${amount.toLocaleString('en-MY', {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`
}

export default function ReliefPage() {
  const [selectedYear, setSelectedYear] = useState(2025)
  const [rules, setRules] = useState<ReliefRule[]>([])
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [profile, setProfile] = useState<FilingProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAllZeroCategories, setShowAllZeroCategories] = useState(false)
  const [expandedSubcaps, setExpandedSubcaps] = useState<Record<string, boolean>>({})

  useEffect(() => {
    async function loadData() {
      setLoading(true)

      try {
        const [rulesRes, receiptsRes, profileRes] = await Promise.all([
          fetch(`/api/rules?year=${selectedYear}`).then((r) => r.json()),
          // include_line_items=true embeds line items so calculateRelief can attribute
          // each item to its OWN relief_category (correct for mixed-category receipts).
          fetch('/api/receipts?include_line_items=true').then((r) => r.json()),
          fetch('/api/profile').then((r) => r.json()).catch(() => ({ filing_profile: null })),
        ])

        if (rulesRes.rules) setRules(rulesRes.rules)
        if (receiptsRes.receipts) setReceipts(receiptsRes.receipts)
        if (profileRes.filing_profile) setProfile(profileRes.filing_profile)
      } catch (err) {
        console.error('Error loading relief data:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [selectedYear])

  const result: ReliefCalculationResult = calculateReliefProgress(rules, receipts, selectedYear)

  // Filter categories by user's personal filing profile (if set)
  const applicableKeys = getApplicableCategoryKeys(profile)
  const filteredCategories = applicableKeys
    ? result.categories.filter((c) => applicableKeys.includes(c.category_key))
    : result.categories

  const activeCategories = filteredCategories.filter((c) => c.claimed_effective > 0)
  const zeroCategories = filteredCategories.filter((c) => c.claimed_effective === 0)

  // Top category by usage
  const topCategory = [...result.categories].sort((a, b) => b.claimed_effective - a.claimed_effective)[0]

  const toggleSubcap = (key: string) => {
    setExpandedSubcaps((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const renderCategoryCard = (cat: CategoryReliefProgress) => {
    const isMaxed = cat.limit_amount !== null && cat.claimed_effective >= cat.limit_amount
    const percent = cat.limit_amount
      ? Math.min((cat.claimed_effective / cat.limit_amount) * 100, 100)
      : 0
    const hasSubcaps = cat.sub_caps && cat.sub_caps.length > 0
    const isExpanded = Boolean(expandedSubcaps[cat.category_key])

    return (
      <div
        key={cat.rule_id}
        className="bg-white border border-[#E2E8F0] rounded-2xl p-4 shadow-sm hover:border-[#CBD5E1] transition-all space-y-3"
      >
        {/* Category Header */}
        <div className="flex justify-between items-start gap-3">
          <div className="space-y-0.5 min-w-0">
            <h3 className="text-sm font-semibold text-[#0F172A] tracking-tight leading-snug">
              {cat.category_label_en}
            </h3>
            {cat.category_label_ms && (
              <p className="text-xs text-[#64748B] line-clamp-1">
                {cat.category_label_ms}
              </p>
            )}
          </div>

          <div className="text-right shrink-0">
            <span className="text-sm font-bold text-[#0F172A] tracking-tight tabular-nums">
              {formatRM(cat.claimed_effective)}
            </span>
            {cat.limit_amount !== null && (
              <span className="text-xs text-[#64748B] block font-normal tabular-nums">
                limit {formatRM(cat.limit_amount)}
              </span>
            )}
          </div>
        </div>

        {/* Progress Bar & Clean Glanceable Status */}
        {cat.limit_amount !== null && (
          <div className="space-y-1.5 pt-1">
            <div className="w-full bg-[#F1F5F9] rounded-full h-2 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${percent}%`,
                  backgroundColor: isMaxed ? '#059669' : '#0052FF',
                }}
              />
            </div>
            <div className="flex justify-between text-xs text-[#64748B] tabular-nums">
              <span>
                {formatRM(cat.claimed_effective)} of {formatRM(cat.limit_amount)} used
              </span>
              <span>
                {percent.toFixed(0)}%
              </span>
            </div>
          </div>
        )}

        {/* Sub-cap Collapsible Section */}
        {hasSubcaps && (
          <div className="pt-2 border-t border-[#F8FAFC]">
            <button
              onClick={() => toggleSubcap(cat.category_key)}
              className="w-full flex items-center justify-between text-xs font-medium text-[#0052FF] py-1"
            >
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                {cat.sub_caps.length} sub-categories
              </span>
              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {isExpanded && (
              <div className="mt-2.5 space-y-2 pl-3 border-l-2 border-[#0052FF]/20 py-1">
                {cat.sub_caps.map((sub) => {
                  const subPercent = sub.limit_amount
                    ? Math.min((sub.claimed_effective / sub.limit_amount) * 100, 100)
                    : 0
                  return (
                    <div key={sub.rule_id} className="space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[#0F172A] font-medium leading-tight">
                          {sub.category_label_en}
                        </span>
                        <span className="text-[#64748B] shrink-0 font-medium tabular-nums">
                          {formatRM(sub.claimed_effective)}
                          {sub.limit_amount !== null && ` / ${formatRM(sub.limit_amount)}`}
                        </span>
                      </div>
                      {sub.limit_amount !== null && (
                        <div className="w-full bg-[#F1F5F9] rounded-full h-1 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#8B5CF6]"
                            style={{ width: `${subPercent}%` }}
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <DashboardHeader
        title="Tax Relief"
        subtitle={`Assessment Year ${selectedYear}`}
      />

      <main className="px-4 py-6 space-y-6 flex-1 max-w-5xl">
        {/* Unmapped Categories Warning Banner */}
        {result.unmapped_category_warnings && result.unmapped_category_warnings.length > 0 && (
          <div className="bg-[#FEF2F2] border border-[#FCA5A5] rounded-2xl p-4 shadow-sm text-xs text-[#991B1B] space-y-2">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-[#EF4444] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-sm text-[#991B1B]">
                  {result.unmapped_category_warnings.length} Line Item(s) with Unmapped Tax Relief Category
                </p>
                <p className="text-xs text-[#7F1D1D] leading-relaxed">
                  These items were not counted in your tax relief totals because their assigned relief categories do not match any active LHDN relief rules for YA {selectedYear}.
                </p>
              </div>
            </div>
            <div className="divide-y divide-[#FECACA] border-t border-[#FECACA] pt-2">
              {result.unmapped_category_warnings.map((w, idx) => (
                <div key={idx} className="py-1.5 flex justify-between items-center text-[11px]">
                  <div>
                    <span className="font-semibold text-[#111827]">{w.item_description}</span>
                    <span className="text-[#6B7280]"> ({w.merchant || 'Unknown'})</span>
                    <span className="block text-[#DC2626] font-mono text-[10px]">Unknown category: "{w.relief_category}"</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-[#111827]">{formatRM(w.item_amount)}</span>
                    <Link
                      href={`/dashboard/receipts/${w.receipt_id}`}
                      className="block text-[#2563EB] hover:underline text-[10px]"
                    >
                      View Receipt →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Key Numbers Headline Section (Apple-style summary cards) */}
        <section className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
          <div className="col-span-2 md:col-span-1 bg-white border border-[#E2E8F0] rounded-2xl p-4 md:p-5 shadow-sm">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-semibold text-[#64748B] tracking-tight">
                Total Claimed
              </span>
              <div className="flex gap-1 text-[11px]">
                {[2024, 2025, 2026].map((y) => (
                  <button
                    key={y}
                    onClick={() => setSelectedYear(y)}
                    className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                      selectedYear === y
                        ? 'bg-[#0052FF] text-white'
                        : 'bg-[#F1F5F9] text-[#64748B] hover:text-[#0F172A]'
                    }`}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-2xl md:text-3xl font-extrabold text-[#0F172A] tracking-tight mt-1 tabular-nums">
              {formatRM(result.total_relief_claimed)}
            </p>
            <p className="text-xs text-[#64748B] mt-1.5 font-normal">
              {activeCategories.length} active relief category
            </p>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 md:p-5 shadow-sm flex flex-col justify-between">
            <span className="text-xs font-semibold text-[#64748B] tracking-tight">
              Total Available Ceiling
            </span>
            <p className="text-2xl font-extrabold text-[#0F172A] tracking-tight mt-1 tabular-nums">
              {formatRM(result.total_relief_available)}
            </p>
            <p className="text-xs text-[#059669] font-medium mt-1 tabular-nums">
              {formatRM(Math.max(0, result.total_relief_available - result.total_relief_claimed))} remaining
            </p>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 md:p-5 shadow-sm flex flex-col justify-between">
            <span className="text-xs font-semibold text-[#64748B] tracking-tight">
              Top Active Category
            </span>
            <p className="text-base font-bold text-[#0F172A] tracking-tight mt-1 truncate">
              {topCategory && topCategory.claimed_effective > 0
                ? topCategory.category_label_en
                : 'None yet'}
            </p>
            <p className="text-xs text-[#64748B] font-normal mt-1 tabular-nums">
              {topCategory && topCategory.claimed_effective > 0
                ? `${formatRM(topCategory.claimed_effective)} claimed`
                : 'Start by uploading receipts'}
            </p>
          </div>
        </section>

        {/* Form BE Export Action Card */}
        <section className="bg-white border border-[#E2E8F0] rounded-2xl p-4 md:p-5 shadow-xs flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#0052FF]" />
              <h3 className="text-sm font-bold text-[#0F172A] tracking-tight">
                LHDN Form BE Reference Export (YA {selectedYear})
              </h3>
            </div>
            <p className="text-[11px] text-[#64748B] max-w-xl">
              Download or print an organized supporting summary matching Form BE relief line items.
              <span className="block text-[#475569] font-medium mt-0.5">
                Note: This export is for your personal reference and record-keeping — it does not submit anything to LHDN.
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <a
              href={`/api/export?year=${selectedYear}&format=csv`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0F172A] bg-[#F1F5F9] hover:bg-[#E2E8F0] px-3.5 py-2 rounded-xl transition-colors min-h-[38px]"
            >
              <Download className="w-3.5 h-3.5 text-[#64748B]" />
              CSV
            </a>

            <Link
              href={`/dashboard/relief/print?year=${selectedYear}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-[#0052FF] hover:bg-[#0040CC] px-4 py-2 rounded-xl shadow-xs transition-colors min-h-[38px]"
            >
              <Printer className="w-3.5 h-3.5" />
              Print / Save PDF
            </Link>
          </div>
        </section>

        {/* Categories Progress Section */}
        <section className="space-y-4">
          <div className="flex justify-between items-center px-1">
            <div>
              <h2 className="text-base font-bold text-[#0F172A] tracking-tight">
                Relief Categories
              </h2>
              <p className="text-xs text-[#64748B]">
                Personal tax relief allowances for YA {selectedYear}
              </p>
            </div>
            <span className="text-xs text-[#64748B] font-medium">
              {activeCategories.length} of {result.categories.length} active
            </span>
          </div>

          {loading ? (
            <div className="bg-white rounded-2xl border border-[#E2E8F0] p-8 text-center text-xs text-[#64748B]">
              Calculating relief progress...
            </div>
          ) : (
            <div className="space-y-4">
              {/* 1. Active Categories (claimed > 0) */}
              {activeCategories.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {activeCategories.map((cat) => renderCategoryCard(cat))}
                </div>
              ) : (
                <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 text-center text-xs text-[#64748B] space-y-1.5 shadow-sm">
                  <p className="font-semibold text-[#0F172A]">No Claimed Reliefs Yet</p>
                  <p className="text-[11px] leading-relaxed">
                    Confirmed receipts matching tax relief categories will appear here automatically.
                  </p>
                </div>
              )}

              {/* 2. Progressive Disclosure for Remaining 0% Categories */}
              {zeroCategories.length > 0 && (
                <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 shadow-sm space-y-3">
                  <button
                    onClick={() => setShowAllZeroCategories(!showAllZeroCategories)}
                    className="w-full flex items-center justify-between text-left py-1"
                  >
                    <div className="space-y-0.5">
                      <p className="text-sm font-semibold text-[#0F172A]">
                        {zeroCategories.length} Other Relief Categories
                      </p>
                      <p className="text-xs text-[#64748B]">
                        RM 0 claimed · Available for future claims
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-medium text-[#0052FF]">
                      <span>{showAllZeroCategories ? 'Hide' : 'View all'}</span>
                      {showAllZeroCategories ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </div>
                  </button>

                  {showAllZeroCategories && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-[#F1F5F9]">
                      {zeroCategories.map((cat) => renderCategoryCard(cat))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </>
  )
}
