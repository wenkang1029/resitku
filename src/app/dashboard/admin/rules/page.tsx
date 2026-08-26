'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ShieldCheck,
  Plus,
  ArrowRight,
  Filter,
  Edit2,
  FileCheck2,
  ChevronRight,
  Layers,
  Sparkles,
  BookOpen,
  Info,
} from 'lucide-react'
import { buildRulesTree, flattenRulesTree, RuleNode } from '@/lib/relief/rulesTree'
import { RuleEditorModal } from '@/components/admin/RuleEditorModal'
import { useAssessmentYear } from '@/context/YearContext'

function formatRM(amount: number | null): string {
  if (amount == null) return 'No limit'
  return `RM ${amount.toLocaleString('en-MY', {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`
}

export default function AdminRulesPage() {
  const { selectedYear, setSelectedYear, availableYears } = useAssessmentYear()
  const [rules, setRules] = useState<any[]>([])
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'draft' | 'superseded'>('all')
  const [loading, setLoading] = useState(true)

  // Editor Modal state
  const [editorOpen, setEditorOpen] = useState(false)
  const [selectedRule, setSelectedRule] = useState<any | null>(null)

  const loadRules = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/rules?year=${selectedYear}&status=${statusFilter}`)
      const data = await res.json()
      if (res.ok && data.rules) {
        setRules(data.rules)
      }
    } catch (err) {
      console.error('Error fetching admin rules:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRules()
  }, [selectedYear, statusFilter])

  // Count pending drafts for this year
  const draftCount = rules.filter((r) => r.status === 'draft').length
  const treeNodes = buildRulesTree(rules)
  const flattened = flattenRulesTree(treeNodes)

  const handleCreateNew = () => {
    setSelectedRule(null)
    setEditorOpen(true)
  }

  const handleEditRule = (r: any) => {
    setSelectedRule(r)
    setEditorOpen(true)
  }

  return (
    <main className="px-4 py-6 md:p-8 flex-1 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl md:text-2xl font-black text-[#0F172A] tracking-tight">
              Tax Relief Rules Registry
            </h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EFF6FF] text-[#0052FF] border border-[#BFDBFE]">
              Admin
            </span>
          </div>
          <p className="text-xs text-[#64748B] mt-0.5">
            Manage statutory LHDN tax relief categories, sub-caps, and umbrella limits.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleCreateNew}
            className="bg-[#0052FF] hover:bg-[#0040CC] text-white text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-sm shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Draft New Category</span>
          </button>
        </div>
      </div>

      {/* Review Drafts Banner if drafts exist */}
      {draftCount > 0 && (
        <div className="bg-gradient-to-r from-[#FFFBEB] to-[#FEF3C7] border border-[#FDE68A] rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#F59E0B] text-white flex items-center justify-center shrink-0 shadow-xs">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-[#92400E]">
                {draftCount} Pending Draft Rule{draftCount > 1 ? 's' : ''} for YA {selectedYear}
              </h3>
              <p className="text-[11px] text-[#B45309]">
                Drafts do not affect live calculations until reviewed and published.
              </p>
            </div>
          </div>
          <Link
            href={`/dashboard/admin/rules/review?year=${selectedYear}`}
            className="bg-[#92400E] hover:bg-[#78350F] text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 transition-colors shrink-0 shadow-xs"
          >
            <span>Review &amp; Publish Diff</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Filter & Year Bar */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-3 md:p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        {/* Year Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-[#0F172A]">Assessment Year:</span>
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

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 bg-[#F1F5F9] p-1 rounded-xl">
          {(['all', 'active', 'draft', 'superseded'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`text-[11px] font-semibold px-3 py-1 rounded-lg capitalize transition-all ${
                statusFilter === s
                  ? 'bg-white text-[#0F172A] shadow-xs'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Rules Hierarchy Tree Table */}
      <section className="bg-white border border-[#E2E8F0] rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-xs text-[#64748B]">Loading rules hierarchy...</div>
        ) : flattened.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <BookOpen className="w-8 h-8 text-[#94A3B8] mx-auto mb-2" />
            <p className="text-xs font-semibold text-[#0F172A]">No rules found</p>
            <p className="text-[11px] text-[#64748B]">
              No relief rules match assessment year YA {selectedYear} and status '{statusFilter}'.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B] text-[10px] uppercase font-bold tracking-wider">
                <tr>
                  <th className="py-3 px-4">Category &amp; Hierarchy</th>
                  <th className="py-3 px-4">Category Key</th>
                  <th className="py-3 px-4">Statutory Limit</th>
                  <th className="py-3 px-4">Cap Type</th>
                  <th className="py-3 px-4">Source Reference</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {flattened.map((node) => {
                  const isDraft = node.status === 'draft'
                  const isActive = node.status === 'active'
                  const isSuperseded = node.status === 'superseded'

                  return (
                    <tr
                      key={node.id}
                      className={`hover:bg-[#F8FAFC] transition-colors ${
                        isDraft ? 'bg-[#FFFDF5]' : ''
                      }`}
                    >
                      {/* Category Label with Depth Indentation */}
                      <td className="py-3.5 px-4 font-medium text-[#0F172A] min-w-[260px]">
                        <div
                          className="flex items-center gap-2"
                          style={{ paddingLeft: `${node.depth * 20}px` }}
                        >
                          {node.depth > 0 && (
                            <span className="text-[#CBD5E1] select-none">↳</span>
                          )}
                          <div>
                            <span className="font-semibold text-xs text-[#0F172A]">
                              {node.category_label_en}
                            </span>
                            {node.category_label_ms && (
                              <span className="block text-[10px] text-[#64748B]">
                                {node.category_label_ms}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Key */}
                      <td className="py-3.5 px-4 font-mono text-[11px] text-[#475569]">
                        <code>{node.category_key}</code>
                      </td>

                      {/* Limit */}
                      <td className="py-3.5 px-4 font-semibold text-[#0F172A] tabular-nums whitespace-nowrap">
                        {formatRM(node.limit_amount)}
                      </td>

                      {/* Cap Type / Umbrella */}
                      <td className="py-3.5 px-4">
                        {node.enforces_combined_cap ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#EDE9FE] text-[#6D28D9] border border-[#DDD6FE]">
                            <Layers className="w-3 h-3" /> Umbrella Cap
                          </span>
                        ) : node.depth > 0 ? (
                          <span className="text-[10px] text-[#64748B]">Sub-cap</span>
                        ) : (
                          <span className="text-[10px] text-[#94A3B8]">Standard</span>
                        )}
                      </td>

                      {/* Source Reference */}
                      <td className="py-3.5 px-4 text-[11px] text-[#64748B] max-w-[200px] truncate" title={node.source_reference || ''}>
                        {node.source_reference || '—'}
                      </td>

                      {/* Status Badge */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-full capitalize ${
                            isActive
                              ? 'bg-[#DCFCE7] text-[#15803D]'
                              : isDraft
                              ? 'bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A]'
                              : 'bg-[#F1F5F9] text-[#64748B]'
                          }`}
                        >
                          {node.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        {isDraft ? (
                          <button
                            type="button"
                            onClick={() => handleEditRule(node)}
                            className="inline-flex items-center gap-1 text-[#0052FF] hover:text-[#0040CC] font-semibold text-xs hover:underline"
                          >
                            <Edit2 className="w-3 h-3" /> Edit Draft
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleEditRule(node)}
                            className="inline-flex items-center gap-1 text-[#64748B] hover:text-[#0F172A] font-semibold text-xs hover:underline"
                            title="Propose an update by drafting a new version"
                          >
                            <Plus className="w-3 h-3" /> Draft Update
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Editor Modal */}
      <RuleEditorModal
        isOpen={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSaved={loadRules}
        rule={selectedRule}
        assessmentYear={selectedYear}
        existingRules={rules}
      />
    </main>
  )
}
