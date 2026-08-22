'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { ReceiptImageViewer } from '@/components/dashboard/ReceiptImageViewer'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Check,
  AlertCircle,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Trash2,
  ExternalLink,
} from 'lucide-react'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

function formatRM(amount: number): string {
  return `RM ${amount.toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

interface PendingReceipt {
  id: string
  merchant: string | null
  total_amount: number | null
  transaction_date: string | null
  spending_category: string | null
  relief_category: string | null
  image_url: string | null
  needs_review: boolean
  status: string
  possible_duplicate?: boolean
  duplicate_of_id?: string | null
  created_at: string
}

export default function PendingReviewPage() {
  const [receipts, setReceipts] = useState<PendingReceipt[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const router = useRouter()

  const loadPending = useCallback(async () => {
    setLoading(true)
    setErrorMessage(null)
    try {
      const res = await fetch('/api/receipts?status=pending_review')
      const json = await res.json()
      if (!res.ok || json.error) {
        throw new Error(json.error || 'Failed to fetch pending receipts')
      }
      setReceipts(json.receipts || [])
    } catch (err: any) {
      console.error('Error fetching pending receipts:', err)
      setErrorMessage(err.message || 'Error fetching pending receipts')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPending()
  }, [loadPending])

  async function handleConfirm(id: string) {
    setUpdatingId(id)
    setErrorMessage(null)

    try {
      const res = await fetch('/api/receipts/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receipt_id: id }),
      })

      const json = await res.json()
      if (!res.ok || json.error) {
        throw new Error(json.error || 'Failed to update receipt status')
      }

      setReceipts((prev) => prev.filter((r) => r.id !== id))
      router.refresh()
    } catch (err: any) {
      console.error('Failed to confirm receipt:', err)
      setErrorMessage(err.message || 'Failed to confirm receipt. Please try again.')
    } finally {
      setUpdatingId(null)
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this pending receipt?')) return

    setDeletingId(id)
    try {
      const res = await fetch('/api/receipts/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receipt_id: id }),
      })

      if (res.ok) {
        setReceipts((prev) => prev.filter((r) => r.id !== id))
        router.refresh()
      } else {
        alert('Failed to delete receipt.')
      }
    } catch (err) {
      console.error(err)
      alert('Error deleting receipt.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
      <DashboardHeader
        title="Pending Review"
        subtitle="Receipts requiring verification"
      />

      <main className="px-4 py-6 space-y-6 flex-1 max-w-5xl">
        {/* Error Banner */}
        {errorMessage && (
          <div className="bg-[#FEE2E2] border border-[#FECACA] rounded-2xl p-4 flex items-start gap-3 shadow-sm text-xs text-[#991B1B]">
            <AlertCircle className="w-5 h-5 text-[#EF4444] shrink-0" />
            <p className="font-semibold">{errorMessage}</p>
          </div>
        )}

        {/* Notice Banner */}
        <div className="bg-[#FEF3C7] border border-[#FDE68A] rounded-2xl p-4 flex items-start gap-3 shadow-sm">
          <AlertCircle className="w-5 h-5 text-[#D97706] shrink-0 mt-0.5" />
          <div className="text-xs text-[#92400E] space-y-0.5">
            <p className="font-semibold text-sm">Review Flagged Receipts</p>
            <p className="text-xs leading-relaxed opacity-90">
              Verify receipt images and extracted categories before confirming them to your tax reports.
            </p>
          </div>
        </div>

        {/* List of Pending Receipts */}
        <div className="space-y-4">
          {loading ? (
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-8 text-center text-xs text-[#64748B]">
              Loading pending receipts...
            </div>
          ) : receipts.length === 0 ? (
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-10 text-center text-xs text-[#64748B] space-y-2 shadow-sm">
              <CheckCircle2 className="w-10 h-10 mx-auto text-[#059669]" />
              <p className="font-bold text-sm text-[#0F172A]">All Clear</p>
              <p className="text-xs text-[#64748B]">No receipts currently require manual confirmation.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {receipts.map((r) => (
                <div
                  key={r.id}
                  className="bg-white border border-[#E2E8F0] rounded-2xl p-4 md:p-5 shadow-sm space-y-3.5 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <Link
                          href={`/dashboard/receipts/${r.id}`}
                          className="text-sm font-bold text-[#0F172A] hover:text-[#0052FF] flex items-center gap-1 truncate"
                        >
                          {r.merchant || 'Unknown Merchant'}
                          <ExternalLink className="w-3 h-3 text-[#94A3B8]" />
                        </Link>
                        <p className="text-[11px] text-[#64748B] mt-0.5">Ref: {r.id.slice(0, 8)}</p>
                      </div>
                      <span className="text-sm font-extrabold text-[#0F172A] shrink-0 tabular-nums">
                        {formatRM(Number(r.total_amount || 0))}
                      </span>
                    </div>

                    {/* Duplicate Soft Warning Badge */}
                    {r.possible_duplicate && (
                      <div className="bg-[#FEF3C7] border border-[#FDE68A] rounded-xl p-2.5 flex items-center justify-between text-xs text-[#92400E]">
                        <span className="flex items-center gap-1.5 font-medium">
                          <AlertTriangle className="w-4 h-4 text-[#D97706]" />
                          Possible duplicate receipt
                        </span>
                        {r.duplicate_of_id && (
                          <Link
                            href={`/dashboard/receipts/${r.duplicate_of_id}`}
                            className="text-[#0052FF] font-semibold text-[11px] underline"
                          >
                            Compare
                          </Link>
                        )}
                      </div>
                    )}

                    {/* Image Preview */}
                    {r.image_url && (
                      <ReceiptImageViewer imagePath={r.image_url} merchant={r.merchant} />
                    )}

                    {/* Extracted Meta Fields */}
                    <div className="grid grid-cols-2 gap-2 text-xs bg-[#F8FAFC] p-3 rounded-xl border border-[#E2E8F0]/60">
                      <div>
                        <span className="text-[10px] text-[#64748B] block">Date</span>
                        <span className="font-semibold text-[#0F172A] tabular-nums">{r.transaction_date || 'Unspecified'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#64748B] block">Category</span>
                        <span className="font-semibold text-[#0F172A] capitalize">{r.spending_category || 'other'}</span>
                      </div>
                      <div className="col-span-2 pt-2 border-t border-[#E2E8F0]/40">
                        <span className="text-[10px] text-[#64748B] block">Tax Relief Tag</span>
                        <span className="font-semibold text-[#0052FF]">
                          {r.relief_category === 'none' ? 'None (Not claimable)' : r.relief_category}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => handleConfirm(r.id)}
                      disabled={updatingId === r.id || deletingId === r.id}
                      className="flex-1 bg-[#0052FF] text-white text-xs font-semibold py-2.5 px-4 rounded-xl min-h-[44px] flex items-center justify-center gap-1.5 active:bg-[#0040CC] transition-colors disabled:opacity-50 shadow-sm"
                    >
                      <Check className="w-4 h-4" />
                      {updatingId === r.id ? 'Confirming...' : 'Confirm'}
                    </button>

                    <button
                      onClick={() => handleDelete(r.id)}
                      disabled={deletingId === r.id || updatingId === r.id}
                      className="text-[#EF4444] bg-[#FEE2E2] hover:bg-[#FCA5A5] px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center min-h-[44px] transition-colors disabled:opacity-50"
                      title="Delete receipt"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  )
}
