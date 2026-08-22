'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { ReceiptImageViewer } from '@/components/dashboard/ReceiptImageViewer'
import Link from 'next/link'
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  Trash2,
  AlertTriangle,
} from 'lucide-react'

function formatRM(amount: number): string {
  return `RM ${amount.toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export default function ReceiptDetailPage() {
  const params = useParams()
  const id = params?.id as string
  const router = useRouter()
  const [receipt, setReceipt] = useState<any>(null)
  const [lineItems, setLineItems] = useState<any[]>([])
  const [duplicateOf, setDuplicateOf] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    async function loadReceipt() {
      if (!id) return
      setLoading(true)

      try {
        const res = await fetch(`/api/receipts/${id}`)
        const data = await res.json()

        if (res.ok && data.receipt) {
          setReceipt(data.receipt)
          setLineItems(data.line_items || [])
          setDuplicateOf(data.duplicate_of || null)
        } else {
          setReceipt(null)
        }
      } catch (err) {
        console.error('Error fetching receipt details:', err)
        setReceipt(null)
      } finally {
        setLoading(false)
      }
    }

    loadReceipt()
  }, [id])

  async function handleDelete() {
    if (!window.confirm('Are you sure you want to delete this receipt? This action cannot be undone.')) {
      return
    }

    setDeleting(true)
    try {
      const res = await fetch('/api/receipts/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receipt_id: id }),
      })

      if (res.ok) {
        router.push('/dashboard/expenses')
      } else {
        alert('Failed to delete receipt.')
      }
    } catch (err) {
      console.error(err)
      alert('Error deleting receipt.')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-center text-xs text-[#64748B]">
        Loading receipt details...
      </div>
    )
  }

  if (!receipt) {
    return (
      <div className="p-8 text-center space-y-3">
        <p className="text-sm font-bold text-[#0F172A]">Receipt not found</p>
        <Link href="/dashboard/expenses" className="text-xs text-[#0052FF] font-medium">
          ← Back to Expenses
        </Link>
      </div>
    )
  }

  return (
    <>
      <DashboardHeader
        title={receipt.merchant || 'Receipt Details'}
        subtitle={`Ref: ${receipt.id.slice(0, 8)}`}
      />

      <main className="px-4 py-6 space-y-6 flex-1 max-w-5xl">
        {/* Navigation & Delete Bar */}
        <div className="flex justify-between items-center">
          <Link
            href="/dashboard/expenses"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0052FF] hover:underline"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Expenses
          </Link>

          <button
            onClick={handleDelete}
            disabled={deleting}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#EF4444] bg-[#FEE2E2] hover:bg-[#FCA5A5] px-3 py-1.5 rounded-xl transition-colors disabled:opacity-50 min-h-[36px]"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {deleting ? 'Deleting...' : 'Delete Receipt'}
          </button>
        </div>

        {/* Duplicate Soft Warning Badge if applicable */}
        {receipt.possible_duplicate && (
          <div className="bg-[#FEF3C7] border border-[#FDE68A] rounded-2xl p-4 flex items-start gap-3 shadow-sm text-xs text-[#92400E]">
            <AlertTriangle className="w-5 h-5 text-[#D97706] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-sm">Possible Duplicate Receipt</p>
              <p className="text-xs opacity-90 leading-relaxed">
                This transaction matches an existing entry with the same merchant, date, and amount.
                {duplicateOf && (
                  <Link
                    href={`/dashboard/receipts/${duplicateOf.id}`}
                    className="block mt-1 text-[#0052FF] font-semibold underline"
                  >
                    View Original: {duplicateOf.merchant} ({duplicateOf.transaction_date})
                  </Link>
                )}
              </p>
            </div>
          </div>
        )}

        {/* 2-column Grid: Image Preview on Left / Extracted Fields on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Image Container */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 shadow-sm space-y-2">
            <h3 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">
              Original Receipt Image
            </h3>
            <ReceiptImageViewer imagePath={receipt.image_url} merchant={receipt.merchant} />
          </div>

          {/* Details & Extracted Fields */}
          <div className="space-y-4">
            {/* Primary Details Card */}
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                    Total Paid
                  </span>
                  <p className="text-3xl font-extrabold text-[#0F172A] tracking-tight mt-0.5 tabular-nums">
                    {formatRM(Number(receipt.total_amount || 0))}
                  </p>
                </div>

                <div className="mt-1">
                  {receipt.status === 'confirmed' ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#059669] bg-[#D1FAE5] px-2.5 py-1 rounded-full">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Confirmed
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#D97706] bg-[#FEF3C7] px-2.5 py-1 rounded-full">
                      <Clock className="w-3.5 h-3.5" /> Pending Review
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[#F1F5F9] text-xs">
                <div>
                  <span className="text-[10px] text-[#64748B] block">Merchant</span>
                  <span className="font-semibold text-[#0F172A]">{receipt.merchant || 'Unknown'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#64748B] block">Transaction Date</span>
                  <span className="font-semibold text-[#0F172A] tabular-nums">{receipt.transaction_date || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#64748B] block">Spending Category</span>
                  <span className="font-semibold text-[#0F172A] capitalize">{receipt.spending_category || 'other'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#64748B] block">Assessment Year</span>
                  <span className="font-semibold text-[#0F172A] tabular-nums">YA {receipt.assessment_year || 2025}</span>
                </div>
                <div className="col-span-2 pt-2 border-t border-[#F1F5F9]">
                  <span className="text-[10px] text-[#64748B] block">Tax Relief Category</span>
                  <span className="font-semibold text-[#0052FF]">
                    {receipt.relief_category === 'none' ? 'None (Not tax-relief eligible)' : receipt.relief_category}
                  </span>
                </div>
              </div>
            </div>

            {/* Line Items Card if present */}
            {lineItems.length > 0 && (
              <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-sm space-y-3">
                <h3 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                  Line Items Breakdown
                </h3>
                <div className="divide-y divide-[#F1F5F9]">
                  {lineItems.map((item) => (
                    <div key={item.id} className="py-2.5 flex justify-between items-center text-xs">
                      <div className="pr-2">
                        <p className="font-medium text-[#0F172A]">{item.description}</p>
                        <p className="text-[10px] text-[#64748B] capitalize">{item.spending_category}</p>
                      </div>
                      <span className="font-semibold text-[#0F172A] tabular-nums">
                        {formatRM(Number(item.amount || 0))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  )
}
