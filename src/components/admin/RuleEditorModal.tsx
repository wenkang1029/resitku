'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Save, ShieldAlert, Info, HelpCircle } from 'lucide-react'
import { toast } from 'sonner'

interface RuleEditorModalProps {
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
  rule: any | null // null = create new, object = edit draft
  assessmentYear: number
  existingRules: any[]
}

export function RuleEditorModal({
  isOpen,
  onClose,
  onSaved,
  rule,
  assessmentYear,
  existingRules,
}: RuleEditorModalProps) {
  const [mounted, setMounted] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form fields
  const [categoryKey, setCategoryKey] = useState('')
  const [labelEn, setLabelEn] = useState('')
  const [labelMs, setLabelMs] = useState('')
  const [limitAmount, setLimitAmount] = useState<string>('')
  const [subCapParentId, setSubCapParentId] = useState<string>('')
  const [enforcesCombinedCap, setEnforcesCombinedCap] = useState(false)
  const [sourceReference, setSourceReference] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (rule) {
      setCategoryKey(rule.category_key || '')
      setLabelEn(rule.category_label_en || rule.category_label?.split('/')[1]?.trim() || rule.category_label || '')
      setLabelMs(rule.category_label_ms || rule.category_label?.split('/')[0]?.trim() || '')
      setLimitAmount(rule.limit_amount != null ? String(rule.limit_amount) : '')
      setSubCapParentId(rule.sub_cap_parent_id || '')
      setEnforcesCombinedCap(Boolean(rule.enforces_combined_cap))
      setSourceReference(rule.source_reference || '')
      setDescription(rule.description || '')
    } else {
      setCategoryKey('')
      setLabelEn('')
      setLabelMs('')
      setLimitAmount('')
      setSubCapParentId('')
      setEnforcesCombinedCap(false)
      setSourceReference('')
      setDescription('')
    }
  }, [rule, isOpen])

  if (!isOpen || !mounted) return null

  // Potential parent options: only rules from the same assessment year, excluding self (if editing)
  const eligibleParents = existingRules.filter((r) => {
    if (rule && r.id === rule.id) return false
    return true
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!categoryKey.trim()) {
      toast.error('Category key is required.')
      return
    }
    if (!labelEn.trim()) {
      toast.error('English label is required.')
      return
    }
    if (!sourceReference.trim()) {
      toast.error('Source reference is mandatory (cite LHDN/Budget document).')
      return
    }

    setSaving(true)
    try {
      const payload = {
        assessment_year: assessmentYear,
        category_key: categoryKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'),
        category_label_en: labelEn.trim(),
        category_label_ms: labelMs.trim() || null,
        limit_amount: limitAmount !== '' ? Number(limitAmount) : null,
        sub_cap_parent_id: subCapParentId || null,
        enforces_combined_cap: enforcesCombinedCap,
        source_reference: sourceReference.trim(),
        description: description.trim() || null,
      }

      let res: Response
      if (rule?.id) {
        // Edit existing draft
        res = await fetch(`/api/admin/rules/${rule.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        // Create new draft
        res = await fetch('/api/admin/rules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(data.message || 'Draft saved successfully.')
        onSaved()
        onClose()
      } else {
        toast.error(data.error || 'Failed to save draft rule.')
      }
    } catch (err: any) {
      console.error('Error saving rule:', err)
      toast.error('Network error saving rule.')
    } finally {
      setSaving(false)
    }
  }

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose()
      }}
    >
      <div className="bg-white border border-[#E2E8F0] rounded-3xl w-full max-w-xl shadow-2xl flex flex-col max-h-[90vh] my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-150 relative">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-[#F1F5F9] bg-white sticky top-0 z-10">
          <div>
            <h2 className="text-base font-bold text-[#0F172A]">
              {rule ? 'Edit Draft Relief Rule' : 'Draft New Relief Rule'}
            </h2>
            <p className="text-xs text-[#64748B]">Assessment Year: YA {assessmentYear}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="p-1.5 rounded-xl text-[#64748B] hover:bg-[#F1F5F9] transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
            {/* Draft Safety Callout */}
            <div className="p-3 bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl flex items-start gap-2.5 text-[#1E40AF]">
              <Info className="w-4 h-4 text-[#3B82F6] shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed">
                <b>Draft Protection:</b> All changes are saved as unpublished drafts. They will not affect your live tax calculations or receipt scanning until you review and publish them on the review page.
              </p>
            </div>

            {/* Category Key */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#0F172A] uppercase tracking-wider block">
                Category Key (snake_case) *
              </label>
              <input
                type="text"
                required
                disabled={Boolean(rule)}
                value={categoryKey}
                onChange={(e) => setCategoryKey(e.target.value)}
                placeholder="e.g. lifestyle_sports"
                className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl p-2.5 text-xs font-mono disabled:opacity-60 focus:bg-white focus:outline-hidden focus:border-[#0052FF]"
              />
              {rule && <p className="text-[10px] text-[#64748B]">Key is immutable for existing rule version.</p>}
            </div>

            {/* Bilingual Labels */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#0F172A] uppercase tracking-wider block">
                  English Label *
                </label>
                <input
                  type="text"
                  required
                  value={labelEn}
                  onChange={(e) => setLabelEn(e.target.value)}
                  placeholder="e.g. Additional lifestyle: sports equipment"
                  className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl p-2.5 text-xs font-medium focus:bg-white focus:outline-hidden focus:border-[#0052FF]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#0F172A] uppercase tracking-wider block">
                  Bahasa Malaysia Label
                </label>
                <input
                  type="text"
                  value={labelMs}
                  onChange={(e) => setLabelMs(e.target.value)}
                  placeholder="e.g. Gaya hidup tambahan: peralatan sukan"
                  className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl p-2.5 text-xs font-medium focus:bg-white focus:outline-hidden focus:border-[#0052FF]"
                />
              </div>
            </div>

            {/* Limit Amount & Parent Rule */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#0F172A] uppercase tracking-wider block">
                  Limit Amount (RM)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={limitAmount}
                  onChange={(e) => setLimitAmount(e.target.value)}
                  placeholder="Leave empty for unconstrained"
                  className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl p-2.5 text-xs font-medium focus:bg-white focus:outline-hidden focus:border-[#0052FF]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#0F172A] uppercase tracking-wider block">
                  Parent Category (Sub-Cap)
                </label>
                <select
                  value={subCapParentId}
                  onChange={(e) => setSubCapParentId(e.target.value)}
                  className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl p-2.5 text-xs font-medium focus:bg-white focus:outline-hidden focus:border-[#0052FF] cursor-pointer"
                >
                  <option value="">None (Top-level Root Category)</option>
                  {eligibleParents.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.category_label_en || p.category_key} {p.limit_amount ? `(RM ${p.limit_amount})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Enforces Combined Cap Flag */}
            <div className="p-3.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl space-y-1.5">
              <label className="flex items-center gap-2.5 cursor-pointer font-bold text-[#0F172A]">
                <input
                  type="checkbox"
                  checked={enforcesCombinedCap}
                  onChange={(e) => setEnforcesCombinedCap(e.target.checked)}
                  className="w-4 h-4 rounded text-[#0052FF] focus:ring-[#0052FF]"
                />
                <span>Enforces Shared Combined Umbrella Cap</span>
              </label>
              <p className="text-[11px] text-[#64748B] leading-relaxed pl-6.5">
                <b>When true:</b> The calculation engine caps the <i>aggregate sum of all children</i> against this parent's ceiling (e.g. <code>medical_combined_umbrella</code> RM10,000 across items 6, 7, 8). Leave unchecked for independent sub-caps (like EPF + life insurance).
              </p>
            </div>

            {/* Source Reference (Mandatory) */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#0F172A] uppercase tracking-wider flex items-center justify-between">
                <span>Official Source Reference *</span>
                <span className="text-[#DC2626] font-normal lowercase">required</span>
              </label>
              <input
                type="text"
                required
                value={sourceReference}
                onChange={(e) => setSourceReference(e.target.value)}
                placeholder="e.g. Budget 2026 Speech Para 45 / LHDN PIN 2026 Item 12"
                className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl p-2.5 text-xs font-medium focus:bg-white focus:outline-hidden focus:border-[#0052FF]"
              />
              <p className="text-[10px] text-[#64748B]">
                Citation of the government gazette or tax guideline backing this rule.
              </p>
            </div>

            {/* Description */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#0F172A] uppercase tracking-wider block">
                Description / Internal Notes
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Any special eligibility constraints, qualifying conditions, or date windows..."
                className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl p-2.5 text-xs font-medium focus:bg-white focus:outline-hidden focus:border-[#0052FF]"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-[#F1F5F9] bg-[#F8FAFC] flex justify-between items-center sticky bottom-0 z-10">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-xs font-semibold text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] rounded-xl transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="bg-[#0052FF] hover:bg-[#0040CC] text-white text-xs font-semibold px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all disabled:opacity-50 shadow-sm"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving Draft...' : 'Save as Draft'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null
}
