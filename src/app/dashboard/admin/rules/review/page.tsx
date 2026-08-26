'use client'

import React, { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  FileCheck2,
  Layers,
  Sparkles,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useAssessmentYear } from '@/context/YearContext'

function formatRM(amount: number | null | undefined): string {
  if (amount == null) return 'No limit'
  return `RM ${amount.toLocaleString('en-MY', {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`
}

interface RuleDiffItem {
  draft: any
  activeMatch: any | null
  isNew: boolean
  hasChanges: boolean
  changes: {
    field: string
    oldVal: any
    newVal: any
  }[]
}

export default function AdminRulesReviewPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { availableYears } = useAssessmentYear()

  const yearParam = searchParams.get('year')
  const [selectedYear, setSelectedYear] = useState<number>(
    yearParam ? Number(yearParam) : 2026
  )

  const [loading, setLoading] = useState(true)
  const [diffs, setDiffs] = useState<RuleDiffItem[]>([])
  const [selectedDraftIds, setSelectedDraftIds] = useState<string[]>([])
  const [publishing, setPublishing] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const loadDiffs = async () => {
    setLoading(true)
    try {
      // Fetch both drafts and active rules for this year
      const [draftsRes, activeRes] = await Promise.all([
        fetch(`/api/admin/rules?year=${selectedYear}&status=draft`).then((r) => r.json()),
        fetch(`/api/admin/rules?year=${selectedYear}&status=active`).then((r) => r.json()),
      ])

      const drafts = draftsRes.rules || []
      const activeRules = activeRes.rules || []

      const activeMap = new Map<string, any>(activeRules.map((r: any) => [r.category_key, r]))

      const computedDiffs: RuleDiffItem[] = drafts.map((draft: any) => {
        const activeMatch = activeMap.get(draft.category_key) || null
        const isNew = !activeMatch
        const changes: { field: string; oldVal: any; newVal: any }[] = []

        if (activeMatch) {
          if (Number(draft.limit_amount) !== Number(activeMatch.limit_amount)) {
            changes.push({
              field: 'Statutory Limit',
              oldVal: formatRM(activeMatch.limit_amount),
              newVal: formatRM(draft.limit_amount),
            })
          }
          if (draft.category_label_en !== activeMatch.category_label_en) {
            changes.push({
              field: 'English Label',
              oldVal: activeMatch.category_label_en,
              newVal: draft.category_label_en,
            })
          }
          if (Boolean(draft.enforces_combined_cap) !== Boolean(activeMatch.enforces_combined_cap)) {
            changes.push({
              field: 'Umbrella Cap Flag',
              oldVal: activeMatch.enforces_combined_cap ? 'Enforced' : 'Not Enforced',
              newVal: draft.enforces_combined_cap ? 'Enforced' : 'Not Enforced',
            })
          }
          if (draft.sub_cap_parent_id !== activeMatch.sub_cap_parent_id) {
            changes.push({
              field: 'Parent Sub-Cap ID',
              oldVal: activeMatch.sub_cap_parent_id || 'None',
              newVal: draft.sub_cap_parent_id || 'None',
            })
          }
        }

        return {
          draft,
          activeMatch,
          isNew,
          hasChanges: isNew || changes.length > 0,
          changes,
        }
      })

      setDiffs(computedDiffs)
      // By default select all drafts
      setSelectedDraftIds(drafts.map((d: any) => d.id))
    } catch (err) {
      console.error('Error loading diffs:', err)
      toast.error('Failed to load draft diffs.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDiffs()
  }, [selectedYear])

  const toggleSelect = (id: string) => {
    setSelectedDraftIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const toggleSelectAll = () => {
    if (selectedDraftIds.length === diffs.length) {
      setSelectedDraftIds([])
    } else {
      setSelectedDraftIds(diffs.map((d) => d.draft.id))
    }
  }

  const handlePublishConfirmed = async () => {
    if (selectedDraftIds.length === 0) return
    setPublishing(true)

    try {
      const res = await fetch('/api/admin/rules/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draft_ids: selectedDraftIds,
          assessment_year: selectedYear,
        }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(data.message || 'Rules published to active successfully.')
        setConfirmOpen(false)
        router.push('/dashboard/admin/rules')
      } else {
        toast.error(data.error || 'Failed to publish rules.')
      }
    } catch (err) {
      console.error('Error publishing rules:', err)
      toast.error('Network error while publishing rules.')
    } finally {
      setPublishing(false)
    }
  }

  return (
    <main className="px-4 py-6 md:p-8 flex-1 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/dashboard/admin/rules"
              className="text-[#64748B] hover:text-[#0F172A] flex items-center gap-1 text-xs font-semibold"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Rules Registry
            </Link>
          </div>
          <h1 className="text-xl md:text-2xl font-black text-[#0F172A] tracking-tight">
            Draft Review &amp; Publication Diff
          </h1>
          <p className="text-xs text-[#64748B] mt-0.5">
            Compare proposed drafts against currently active rules before promoting them to live status.
          </p>
        </div>

        {/* Year Selector */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-bold text-[#0F172A]">Year:</span>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="bg-[#F8FAFC] border border-[#CBD5E1] font-bold text-xs px-3 py-1.5 rounded-xl text-[#0F172A] cursor-pointer focus:outline-hidden focus:border-[#0052FF]"
          >
            {availableYears.map((y) => (
              <option key={y} value={y}>
                YA {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Safety Notice Callout */}
      <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-2xl p-4 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-[#0052FF] shrink-0 mt-0.5" />
        <div className="text-xs text-[#1E3A8A] leading-relaxed">
          <p className="font-bold mb-0.5">Immutability &amp; Versioning Guarantee (FR-4.4)</p>
          <p>
            Publishing promotes selected drafts to <code>status: active</code>. Any existing active row with matching category key + assessment year is marked <code>status: superseded</code>. Existing receipts with historical <code>rule_version_id</code> remain intact and immutable.
          </p>
        </div>
      </div>

      {/* Main Diff Table */}
      <section className="bg-white border border-[#E2E8F0] rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-xs text-[#64748B]">Loading rule diffs...</div>
        ) : diffs.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-[#16A34A] mx-auto mb-2" />
            <p className="text-xs font-semibold text-[#0F172A]">No Pending Drafts</p>
            <p className="text-[11px] text-[#64748B]">
              All tax relief categories for YA {selectedYear} are currently active and up to date.
            </p>
            <div className="pt-2">
              <Link
                href="/dashboard/admin/rules"
                className="text-xs font-bold text-[#0052FF] hover:underline"
              >
                Return to Registry
              </Link>
            </div>
          </div>
        ) : (
          <div>
            {/* Top Toolbar */}
            <div className="p-4 bg-[#F8FAFC] border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs font-bold text-[#0F172A] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedDraftIds.length === diffs.length && diffs.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded text-[#0052FF] focus:ring-[#0052FF]"
                  />
                  <span>Select All ({diffs.length} drafts)</span>
                </label>
                <span className="text-xs text-[#64748B]">
                  • {selectedDraftIds.length} selected
                </span>
              </div>

              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                disabled={selectedDraftIds.length === 0 || publishing}
                className="bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold px-5 py-2 rounded-xl flex items-center gap-2 transition-all disabled:opacity-50 shadow-sm"
              >
                <FileCheck2 className="w-4 h-4" />
                <span>Publish Selected ({selectedDraftIds.length})</span>
              </button>
            </div>

            {/* Diff Cards List */}
            <div className="divide-y divide-[#F1F5F9]">
              {diffs.map(({ draft, activeMatch, isNew, changes }) => {
                const isSelected = selectedDraftIds.includes(draft.id)

                return (
                  <div
                    key={draft.id}
                    className={`p-4 md:p-5 transition-colors ${
                      isSelected ? 'bg-[#FAFCFF]' : 'bg-white'
                    }`}
                  >
                    <div className="flex items-start gap-3.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(draft.id)}
                        className="w-4 h-4 mt-1 rounded text-[#0052FF] focus:ring-[#0052FF]"
                      />

                      <div className="flex-1 min-w-0 space-y-3">
                        {/* Title & Key */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-[#0F172A]">
                                {draft.category_label_en || draft.category_label || draft.category_key}
                              </span>
                              {draft.category_label_ms && (
                                <span className="text-xs text-[#64748B] hidden sm:inline">
                                  ({draft.category_label_ms})
                                </span>
                              )}
                              {isNew ? (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#DCFCE7] text-[#16A34A] border border-[#BBF7D0]">
                                  + NEW CATEGORY
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A]">
                                  MODIFIED VERSION {draft.rule_version}
                                </span>
                              )}
                            </div>
                            <span className="font-mono text-[11px] text-[#64748B]">
                              Key: <code>{draft.category_key}</code>
                            </span>
                          </div>

                          <div className="text-right">
                            <span className="text-xs font-bold text-[#0F172A] block">
                              Proposed Limit: {formatRM(draft.limit_amount)}
                            </span>
                            {draft.enforces_combined_cap && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#EDE9FE] text-[#6D28D9]">
                                <Layers className="w-2.5 h-2.5" /> Shared Umbrella
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Diff Box */}
                        {isNew ? (
                          <div className="p-3 bg-[#F0FDF4] border border-[#DCFCE7] rounded-xl text-xs space-y-1">
                            <p className="font-bold text-[#166534]">New Statutory Category</p>
                            <p className="text-[#15803D] text-[11px]">
                              Will be introduced as a new relief category for YA {selectedYear}.
                            </p>
                          </div>
                        ) : changes.length > 0 ? (
                          <div className="p-3 bg-[#FFFDF0] border border-[#FEF3C7] rounded-xl text-xs space-y-2">
                            <p className="font-bold text-[#92400E]">Detected Changes against Active Version:</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                              {changes.map((c, i) => (
                                <div key={i} className="p-2 bg-white rounded-lg border border-[#FDE68A]">
                                  <span className="text-[#78350F] font-bold block">{c.field}</span>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="line-through text-[#DC2626]">{String(c.oldVal)}</span>
                                    <span className="text-[#64748B]">→</span>
                                    <span className="font-bold text-[#16A34A]">{String(c.newVal)}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="p-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-[11px] text-[#64748B]">
                            No mathematical limit changes. Updates metadata/descriptions.
                          </div>
                        )}

                        {/* Official Source Reference Citation */}
                        <div className="flex items-center gap-2 text-xs bg-[#F1F5F9] p-2.5 rounded-xl border border-[#E2E8F0]">
                          <span className="font-bold text-[#0F172A] text-[11px] shrink-0">Source Reference:</span>
                          <span className="text-[#475569] font-medium text-[11px] truncate">
                            {draft.source_reference}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </section>

      {/* Confirm Publish Dialog */}
      <ConfirmDialog
        isOpen={confirmOpen}
        title={`Publish ${selectedDraftIds.length} Tax Relief Rules for YA ${selectedYear}?`}
        description={`This will activate the selected draft rules immediately. Any previously active versions will be marked as superseded. All existing receipts referencing prior rule versions will preserve their historical calculation baseline.`}
        confirmLabel="Yes, Publish to Active"
        cancelLabel="Keep in Draft"
        isDestructive={false}
        isLoading={publishing}
        onConfirm={handlePublishConfirmed}
        onCancel={() => setConfirmOpen(false)}
      />
    </main>
  )
}
