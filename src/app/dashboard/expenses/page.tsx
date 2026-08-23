'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts'
import {
  ShoppingBag,
  Car,
  Utensils,
  Lightbulb,
  HeartPulse,
  GraduationCap,
  Sparkles,
  Clock,
  CheckCircle2,
  ReceiptText,
} from 'lucide-react'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

interface ReceiptRow {
  id: string
  merchant: string | null
  total_amount: number | null
  claimed_amount: number | null   // null = nothing excluded; use total_amount
  transaction_date: string | null
  spending_category: string | null
  relief_category: string | null
  needs_review: boolean
  status: string
  possible_duplicate?: boolean
  duplicate_of_id?: string | null
  created_at: string
}

const CATEGORY_ICONS: Record<string, any> = {
  transport: Car,
  shopping: ShoppingBag,
  dining: Utensils,
  utilities: Lightbulb,
  medical: HeartPulse,
  education: GraduationCap,
  groceries: ShoppingBag,
  other: Sparkles,
}

const CATEGORY_COLORS: Record<string, string> = {
  transport: '#0052FF',
  shopping: '#8B5CF6',
  dining: '#F59E0B',
  utilities: '#10B981',
  medical: '#EF4444',
  education: '#06B6D4',
  groceries: '#14B8A6',
  other: '#64748B',
}

function formatRM(amount: number): string {
  return `RM ${amount.toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export default function ExpensesPage() {
  const [receipts, setReceipts] = useState<ReceiptRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedYear, setSelectedYear] = useState(2025)

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        const res = await fetch('/api/receipts')
        const json = await res.json()
        if (json.receipts) {
          setReceipts(json.receipts)
        }
      } catch (err) {
        console.error('Error fetching receipts:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // Extract available years from receipts dynamically
  const availableYears = Array.from(
    new Set(
      receipts
        .map((r) => (r.transaction_date ? new Date(r.transaction_date).getFullYear() : null))
        .filter((y): y is number => y !== null)
    )
  ).sort((a, b) => b - a)

  const displayYears = Array.from(new Set([...availableYears, 2025, 2026])).sort((a, b) => b - a)

  const yearReceipts = receipts.filter((r) => {
    if (r.transaction_date) {
      return new Date(r.transaction_date).getFullYear() === selectedYear
    }
    return selectedYear === 2025
  })

  const totalSpent = yearReceipts.reduce(
    // COALESCE: use claimed_amount (excluded items removed) when set, else full total
    (acc, r) => acc + (Number(r.claimed_amount ?? r.total_amount) || 0),
    0
  )

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const monthlyData = months.map((m, idx) => {
    const monthReceipts = yearReceipts.filter((r) => {
      if (!r.transaction_date) return false
      return new Date(r.transaction_date).getMonth() === idx
    })
    const total = monthReceipts.reduce(
      (acc, r) => acc + (Number(r.claimed_amount ?? r.total_amount) || 0), 0)
    return {
      name: m,
      total: Number(total.toFixed(2)),
    }
  })

  const categoryTotals: Record<string, number> = {}
  for (const r of yearReceipts) {
    const cat = r.spending_category || 'other'
    categoryTotals[cat] = (categoryTotals[cat] || 0) + (Number(r.claimed_amount ?? r.total_amount) || 0)
  }

  const categoryList = Object.entries(categoryTotals)
    .map(([cat, amount]) => ({
      cat,
      amount,
      percentage: totalSpent > 0 ? (amount / totalSpent) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount)

  return (
    <>
      <DashboardHeader title="Expenses" subtitle={`Spending overview for ${selectedYear}`} />

      <main className="px-4 py-6 space-y-6 flex-1 max-w-5xl">
        {/* Total Expenses Card */}
        <section className="bg-white border border-[#E2E8F0] rounded-2xl p-4 md:p-5 shadow-sm">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-semibold text-[#64748B] tracking-tight">
              Total Expenses
            </span>
            <div className="flex gap-1 text-[11px] flex-wrap">
              {displayYears.map((y) => (
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
          <p className="text-3xl md:text-4xl font-extrabold text-[#0F172A] tracking-tight mt-1 tabular-nums">
            {formatRM(totalSpent)}
          </p>
          <p className="text-xs text-[#64748B] mt-1.5 font-normal">
            {yearReceipts.length} recorded receipt{yearReceipts.length === 1 ? '' : 's'}
          </p>
        </section>

        {/* 2-column Grid on Desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Monthly Trend Chart */}
          <section className="bg-white border border-[#E2E8F0] rounded-2xl p-4 md:p-5 shadow-sm flex flex-col justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#0F172A]">Monthly Spending Trend</h2>
              <p className="text-xs text-[#64748B] mt-0.5">Month-by-month cash outflow</p>
            </div>
            <div className="h-48 md:h-56 w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" stroke="#64748B" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748B" fontSize={11} tickLine={false} tickFormatter={(v) => `RM${v}`} />
                  <Tooltip
                    formatter={(val: any) => [`RM ${Number(val).toFixed(2)}`, 'Spent']}
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: '12px',
                      border: '1px solid #E2E8F0',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                    {monthlyData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.total > 0 ? '#0052FF' : '#E2E8F0'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Category Breakdown */}
          <section className="bg-white border border-[#E2E8F0] rounded-2xl p-4 md:p-5 shadow-sm">
            <h2 className="text-sm font-bold text-[#0F172A]">Spending by Category</h2>
            <p className="text-xs text-[#64748B] mt-0.5 mb-4">Distribution across budget groups</p>

            {categoryList.length === 0 ? (
              <p className="text-xs text-[#64748B] py-6 text-center">No expenses recorded for {selectedYear}.</p>
            ) : (
              <div className="space-y-3.5">
                {categoryList.map(({ cat, amount, percentage }) => {
                  const Icon = CATEGORY_ICONS[cat] || Sparkles
                  const color = CATEGORY_COLORS[cat] || '#64748B'
                  return (
                    <div key={cat} className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="flex items-center gap-2 font-medium text-[#0F172A] capitalize">
                          <Icon className="w-3.5 h-3.5" style={{ color }} />
                          {cat}
                        </span>
                        <span className="font-semibold text-[#0F172A] tabular-nums">
                          {formatRM(amount)}{' '}
                          <span className="text-[11px] text-[#64748B] font-normal">
                            ({percentage.toFixed(0)}%)
                          </span>
                        </span>
                      </div>
                      <div className="w-full bg-[#F1F5F9] rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(percentage, 100)}%`,
                            backgroundColor: color,
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>

        {/* Recent Receipts List */}
        <section className="bg-white border border-[#E2E8F0] rounded-2xl p-4 md:p-5 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-sm font-bold text-[#0F172A]">Recent Receipts</h2>
              <p className="text-xs text-[#64748B] mt-0.5">Transactions logged via Telegram & web</p>
            </div>
            <span className="text-xs text-[#64748B]">{receipts.length} total</span>
          </div>

          {loading ? (
            <p className="text-xs text-[#64748B] py-4 text-center">Loading receipts...</p>
          ) : receipts.length === 0 ? (
            <div className="text-center py-8 text-xs text-[#64748B] space-y-2">
              <ReceiptText className="w-8 h-8 mx-auto text-[#E2E8F0]" />
              <p>No receipts captured yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-[#F1F5F9]">
              {receipts.slice(0, 10).map((r) => {
                const Icon = CATEGORY_ICONS[r.spending_category || 'other'] || Sparkles
                const isPending = r.status === 'pending_review'
                return (
                  <Link
                    key={r.id}
                    href={`/dashboard/receipts/${r.id}`}
                    className="py-3 flex items-center justify-between min-h-[48px] hover:bg-[#F8FAFC] -mx-2 px-2 rounded-xl transition-colors group"
                  >
                    <div className="flex items-center gap-3 pr-2 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-[#F1F5F9] group-hover:bg-[#E2E8F0] flex items-center justify-center shrink-0 transition-colors">
                        <Icon className="w-4 h-4 text-[#0052FF]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#0F172A] truncate group-hover:text-[#0052FF] transition-colors">
                          {r.merchant || 'Unknown Merchant'}
                        </p>
                        <div className="flex items-center gap-2 text-[11px] text-[#64748B] mt-0.5 tabular-nums">
                          <span>{r.transaction_date || 'No Date'}</span>
                          <span>•</span>
                          <span className="capitalize">{r.spending_category || 'other'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold text-[#0F172A] tabular-nums">
                        {formatRM(Number(r.total_amount || 0))}
                      </p>
                      <div className="mt-0.5 flex items-center justify-end gap-1">
                        {r.possible_duplicate && (
                          <span className="text-[10px] font-semibold text-[#D97706] bg-[#FEF3C7] px-1.5 py-0.2 rounded">
                            Duplicate?
                          </span>
                        )}
                        {isPending ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#D97706] bg-[#FEF3C7] px-2 py-0.5 rounded-full">
                            <Clock className="w-2.5 h-2.5" /> Pending
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#059669] bg-[#D1FAE5] px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-2.5 h-2.5" /> Confirmed
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </section>
      </main>
    </>
  )
}
