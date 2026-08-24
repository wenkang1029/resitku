'use client'

import React, { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { ExportReliefData, ExportCategoryDetail } from '@/lib/relief/exportRelief'
import { Printer, ArrowLeft, Shield, AlertCircle, CheckCircle2 } from 'lucide-react'

function formatRM(amount: number): string {
  return `RM ${amount.toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function PrintViewContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const yearStr = searchParams.get('year')
  const selectedYear = yearStr ? Number(yearStr) : 2025

  const [data, setData] = useState<ExportReliefData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        // Fetches from canonical /api/export endpoint (single source of truth)
        const res = await fetch(`/api/export?year=${selectedYear}&format=json`)
        if (!res.ok) {
          throw new Error('Failed to load export data')
        }
        const json = await res.json()
        setData(json)
      } catch (err: any) {
        console.error(err)
        setError(err.message || 'Error loading data')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [selectedYear])

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center text-xs text-[#64748B]">
        Generating Form BE Tax Relief Summary...
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-white p-8 max-w-2xl mx-auto space-y-4">
        <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-xl p-4 text-xs text-[#991B1B]">
          {error || 'Unable to load export record.'}
        </div>
        <button
          onClick={() => router.push('/dashboard/relief')}
          className="text-xs font-semibold text-[#0052FF] hover:underline"
        >
          ← Back to Tax Relief Dashboard
        </button>
      </div>
    )
  }

  const activeCategories = data.categories.filter((c) => c.claimed_effective > 0)
  const zeroCategories = data.categories.filter((c) => c.claimed_effective === 0)

  return (
    <div className="min-h-screen bg-white text-[#0F172A] font-sans antialiased p-6 sm:p-10 max-w-4xl mx-auto space-y-8 print:p-0 print:max-w-none">
      {/* Top Action Bar (Hidden when printed) */}
      <div className="flex justify-between items-center pb-4 border-b border-[#E2E8F0] print:hidden">
        <button
          onClick={() => router.push('/dashboard/relief')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#64748B] hover:text-[#0F172A] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
        </button>

        <div className="flex items-center gap-3">
          <a
            href={`/api/export?year=${selectedYear}&format=csv`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0F172A] bg-[#F1F5F9] hover:bg-[#E2E8F0] px-3.5 py-2 rounded-xl transition-colors"
          >
            Download CSV
          </a>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-[#0052FF] hover:bg-[#0040CC] px-4 py-2 rounded-xl shadow-xs transition-colors"
          >
            <Printer className="w-3.5 h-3.5" /> Print / Save as PDF
          </button>
        </div>
      </div>

      {/* Document Header */}
      <header className="space-y-2 border-b border-[#0F172A] pb-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[#0F172A]">
              ResitKu · Tax Relief Supporting Record
            </h1>
            <p className="text-xs font-semibold text-[#475569] uppercase tracking-wider mt-0.5">
              LHDN Form BE Reference Summary — Assessment Year {data.assessment_year}
            </p>
          </div>
          <div className="text-right text-[11px] text-[#64748B]">
            <p>Generated: {new Date(data.generated_at).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
            {data.user_email && <p className="font-mono text-[10px]">{data.user_email}</p>}
          </div>
        </div>

        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-2.5 text-[11px] text-[#475569] flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 text-[#0052FF] shrink-0" />
          <span>
            <b>Legal Notice:</b> This document is an organized reference summary for your personal tax filing. It does not replace original invoices or submit any data to LHDN.
          </span>
        </div>
      </header>

      {/* Total Headline Summary Card */}
      <section className="grid grid-cols-2 sm:grid-cols-3 gap-4 border border-[#CBD5E1] rounded-xl p-4 bg-[#FAFAFA]">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] block">Total Claimed</span>
          <span className="text-2xl font-black text-[#0F172A] tabular-nums">{formatRM(data.total_relief_claimed)}</span>
        </div>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] block">Available Relief Cap</span>
          <span className="text-2xl font-bold text-[#475569] tabular-nums">{formatRM(data.total_relief_available)}</span>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] block">Active Categories</span>
          <span className="text-2xl font-bold text-[#0052FF]">{activeCategories.length} Categories</span>
        </div>
      </section>

      {/* Section 1: Summary Table (Form BE Aligned) */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[#0F172A] border-b border-[#CBD5E1] pb-1">
          1. Tax Relief Summary by Category
        </h2>
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="border-b border-[#94A3B8] text-[11px] text-[#475569]">
              <th className="py-2 font-bold">Category</th>
              <th className="py-2 font-bold text-right">Statutory Limit</th>
              <th className="py-2 font-bold text-right">Claimed Amount</th>
              <th className="py-2 font-bold text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E8F0]">
            {data.categories.map((cat) => {
              const isMaxed = cat.limit_amount !== null && cat.claimed_effective >= cat.limit_amount
              return (
                <React.Fragment key={cat.rule_id}>
                  <tr className="hover:bg-[#F8FAFC]">
                    <td className="py-2 pr-2">
                      <span className="font-semibold text-[#0F172A]">{cat.category_label_en}</span>
                      {cat.category_label_ms && <span className="block text-[10px] text-[#64748B]">{cat.category_label_ms}</span>}
                    </td>
                    <td className="py-2 text-right tabular-nums text-[#475569]">
                      {cat.limit_amount !== null ? formatRM(cat.limit_amount) : 'Unlimited'}
                    </td>
                    <td className="py-2 text-right font-bold tabular-nums text-[#0F172A]">
                      {formatRM(cat.claimed_effective)}
                    </td>
                    <td className="py-2 text-center text-[10px]">
                      {isMaxed ? (
                        <span className="px-1.5 py-0.5 bg-[#FEF3C7] text-[#92400E] font-bold rounded">MAXED</span>
                      ) : cat.claimed_effective > 0 ? (
                        <span className="text-[#059669] font-medium">Claimed</span>
                      ) : (
                        <span className="text-[#94A3B8]">RM 0</span>
                      )}
                    </td>
                  </tr>
                  {/* Sub-caps rendering */}
                  {cat.sub_caps &&
                    cat.sub_caps.map((sub) => (
                      <tr key={sub.rule_id} className="bg-[#F8FAFC]/50 text-[11px]">
                        <td className="py-1.5 pl-4 pr-2 text-[#475569]">
                          ↳ {sub.category_label_en}
                        </td>
                        <td className="py-1.5 text-right tabular-nums text-[#64748B]">
                          {sub.limit_amount !== null ? formatRM(sub.limit_amount) : 'Shared'}
                        </td>
                        <td className="py-1.5 text-right font-semibold tabular-nums text-[#334155]">
                          {formatRM(sub.claimed_effective)}
                        </td>
                        <td className="py-1.5 text-center text-[9px] text-[#64748B]">Sub-cap</td>
                      </tr>
                    ))}
                </React.Fragment>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[#0F172A] font-bold text-xs">
              <td className="py-3">TOTAL CLAIMABLE RELIEF</td>
              <td className="py-3 text-right tabular-nums text-[#475569]">{formatRM(data.total_relief_available)}</td>
              <td className="py-3 text-right tabular-nums text-[#0F172A] text-sm">{formatRM(data.total_relief_claimed)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </section>

      {/* Section 2: Detailed Itemized Receipts */}
      <section className="space-y-4 pt-4 border-t border-[#CBD5E1] break-before-page">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[#0F172A] border-b border-[#CBD5E1] pb-1">
          2. Itemized Contributing Receipts &amp; Expenses
        </h2>

        {data.all_contributing_items.length === 0 ? (
          <p className="text-xs text-[#64748B] italic py-4">
            No confirmed relief-eligible expenses recorded for Assessment Year {data.assessment_year}.
          </p>
        ) : (
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-[#94A3B8] text-[11px] text-[#475569]">
                <th className="py-2 font-bold">Date</th>
                <th className="py-2 font-bold">Merchant / Store</th>
                <th className="py-2 font-bold">Item Description</th>
                <th className="py-2 font-bold">Relief Category</th>
                <th className="py-2 font-bold text-right">Amount Claimed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {data.all_contributing_items.map((item, idx) => (
                <tr key={idx} className="hover:bg-[#F8FAFC]">
                  <td className="py-2 tabular-nums text-[#64748B] whitespace-nowrap">{item.transaction_date}</td>
                  <td className="py-2 font-medium text-[#0F172A]">{item.merchant}</td>
                  <td className="py-2 text-[#334155]">{item.description}</td>
                  <td className="py-2 text-[#0052FF] font-mono text-[10px]">{item.relief_category}</td>
                  <td className="py-2 text-right font-bold tabular-nums text-[#0F172A] whitespace-nowrap">
                    {formatRM(item.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Document Footer */}
      <footer className="pt-8 border-t border-[#E2E8F0] text-center text-[10px] text-[#94A3B8] space-y-1">
        <p>ResitKu · Personal Expense &amp; Malaysian Tax Relief Tracking System</p>
        <p>Keep your original receipts and documentation for at least 7 years in accordance with LHDN record-keeping requirements.</p>
      </footer>
    </div>
  )
}

export default function ReliefPrintPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-[#64748B]">Loading Print View...</div>}>
      <PrintViewContent />
    </Suspense>
  )
}
