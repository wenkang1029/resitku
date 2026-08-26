'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  FilingProfile,
  DependentChild,
  EducationStage,
} from '@/lib/relief/applicableCategories'
import {
  Heart,
  Baby,
  Plus,
  Trash2,
  CheckCircle2,
  Save,
  Shield,
} from 'lucide-react'
import { toast } from 'sonner'

interface TaxReliefProfileFormProps {
  initialProfile: FilingProfile | null
  initialRules?: any[]
}

function formatRM(amount: number | null | undefined, fallback: number): string {
  const val = amount !== null && amount !== undefined ? Number(amount) : fallback
  return `RM ${val.toLocaleString('en-MY')}`
}

export function TaxReliefProfileForm({ initialProfile, initialRules = [] }: TaxReliefProfileFormProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)

  // Map category_key -> limit_amount from fetched rules
  const ruleLimits = React.useMemo(() => {
    const map: Record<string, number> = {}
    for (const r of initialRules) {
      if (r.category_key && r.limit_amount != null) {
        map[r.category_key] = Number(r.limit_amount)
      }
    }
    return map
  }, [initialRules])

  const spouseOkuLimit = ruleLimits['disabled_spouse'] ?? 6000
  const selfOkuLimit = ruleLimits['disabled_individual'] ?? 7000
  const childUnder18Limit = ruleLimits['child_below_18'] ?? 2000
  const childAlevelLimit = ruleLimits['child_18plus_alevel_matriculation'] ?? 2000
  const childHigherEdLimit = ruleLimits['child_18plus_higher_ed'] ?? 8000
  const disabledChildLimit = ruleLimits['disabled_child'] ?? 8000
  const disabledChildHigherEdLimit = ruleLimits['disabled_child_higher_ed_additional'] ?? 8000
  const disabledChildTotalWithHigherEd = disabledChildLimit + disabledChildHigherEdLimit

  // Profile Form States initialized from props
  const [maritalStatus, setMaritalStatus] = useState<'single' | 'married'>(
    initialProfile?.marital_status || 'single'
  )
  const [filingType, setFilingType] = useState<'joint' | 'separate'>(
    initialProfile?.filing_type || 'separate'
  )
  const [hasDisability, setHasDisability] = useState<boolean>(
    Boolean(initialProfile?.has_disability)
  )
  const [spouseHasDisability, setSpouseHasDisability] = useState<boolean>(
    Boolean(initialProfile?.spouse_has_disability)
  )
  const [children, setChildren] = useState<DependentChild[]>(
    initialProfile?.dependent_children || []
  )

  const addChild = () => {
    setChildren((prev) => [
      ...prev,
      {
        birth_year: new Date().getFullYear() - 5,
        education_stage: 'below_18',
        has_disability: false,
      },
    ])
  }

  const removeChild = (index: number) => {
    setChildren((prev) => prev.filter((_, i) => i !== index))
  }

  const updateChild = (index: number, updates: Partial<DependentChild>) => {
    setChildren((prev) =>
      prev.map((c, i) => (i === index ? { ...c, ...updates } : c))
    )
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSavedSuccess(false)

    const profile: FilingProfile = {
      marital_status: maritalStatus,
      filing_type: maritalStatus === 'married' ? filingType : undefined,
      has_disability: hasDisability,
      spouse_has_disability: maritalStatus === 'married' ? spouseHasDisability : false,
      dependent_children: children,
    }

    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filing_profile: profile }),
      })

      if (res.ok) {
        setSavedSuccess(true)
        toast.success('Tax profile updated successfully')
        setTimeout(() => {
          router.push('/dashboard/relief')
        }, 1000)
      } else {
        toast.error('Failed to save tax profile.')
      }
    } catch (err) {
      console.error('Error saving profile:', err)
      toast.error('Error saving profile.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm">
      <form onSubmit={handleSave} className="space-y-6">
        {/* Marital Status */}
        <div className="space-y-3">
          <label className="text-xs font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-1.5">
            <Heart className="w-4 h-4 text-[#0052FF]" /> Marital Status
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setMaritalStatus('single')}
              className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                maritalStatus === 'single'
                  ? 'border-[#0052FF] bg-[#0052FF]/5 text-[#0052FF] shadow-sm'
                  : 'border-[#E2E8F0] bg-white text-[#64748B] hover:bg-[#F8FAFC]'
              }`}
            >
              Single / Unmarried
            </button>
            <button
              type="button"
              onClick={() => setMaritalStatus('married')}
              className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                maritalStatus === 'married'
                  ? 'border-[#0052FF] bg-[#0052FF]/5 text-[#0052FF] shadow-sm'
                  : 'border-[#E2E8F0] bg-white text-[#64748B] hover:bg-[#F8FAFC]'
              }`}
            >
              Married
            </button>
          </div>
        </div>

        {/* If Married: Filing Type & Spouse Disability */}
        {maritalStatus === 'married' && (
          <div className="p-4 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-[#0F172A] block">
                Tax Assessment Filing Type
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFilingType('separate')}
                  className={`p-2.5 rounded-lg border text-xs font-medium transition-all ${
                    filingType === 'separate'
                      ? 'border-[#0052FF] bg-white text-[#0052FF] font-bold shadow-xs'
                      : 'border-[#E2E8F0] bg-transparent text-[#64748B]'
                  }`}
                >
                  Separate Assessment
                </button>
                <button
                  type="button"
                  onClick={() => setFilingType('joint')}
                  className={`p-2.5 rounded-lg border text-xs font-medium transition-all ${
                    filingType === 'joint'
                      ? 'border-[#0052FF] bg-white text-[#0052FF] font-bold shadow-xs'
                      : 'border-[#E2E8F0] bg-transparent text-[#64748B]'
                  }`}
                >
                  Joint Assessment
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={spouseHasDisability}
                onChange={(e) => setSpouseHasDisability(e.target.checked)}
                className="w-4 h-4 rounded text-[#0052FF] focus:ring-[#0052FF]"
              />
              <span className="text-xs text-[#0F172A] font-medium">
                Spouse has a registered disability (OKU) — {formatRM(spouseOkuLimit, 6000)}
              </span>
            </label>
          </div>
        )}

        {/* Self Disability Status */}
        <div className="space-y-2 pt-2 border-t border-[#F1F5F9]">
          <label className="text-xs font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-[#0052FF]" /> Personal Status
          </label>
          <label className="flex items-center gap-2.5 cursor-pointer p-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]">
            <input
              type="checkbox"
              checked={hasDisability}
              onChange={(e) => setHasDisability(e.target.checked)}
              className="w-4 h-4 rounded text-[#0052FF] focus:ring-[#0052FF]"
            />
            <div className="text-xs">
              <span className="font-semibold text-[#0F172A] block">
                I have a registered disability (OKU)
              </span>
              <span className="text-[#64748B] text-[11px]">
                Unlocks additional {formatRM(selfOkuLimit, 7000)} disabled individual relief
              </span>
            </div>
          </label>
        </div>

        {/* Dependent Children */}
        <div className="space-y-3 pt-2 border-t border-[#F1F5F9]">
          <div className="flex justify-between items-center">
            <div>
              <label className="text-xs font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-1.5">
                <Baby className="w-4 h-4 text-[#0052FF]" /> Dependent Children
              </label>
              <p className="text-[11px] text-[#64748B]">
                Adds child allowances matching age & education tier
              </p>
            </div>

            <button
              type="button"
              onClick={addChild}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#0052FF] bg-[#0052FF]/10 hover:bg-[#0052FF]/20 px-3 py-1.5 rounded-xl transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add Child
            </button>
          </div>

          {children.length === 0 ? (
            <p className="text-xs text-[#94A3B8] p-4 text-center bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
              No dependent children added. Child reliefs will be hidden.
            </p>
          ) : (
            <div className="space-y-3">
              {children.map((child, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] space-y-3"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-[#0F172A]">
                      Child #{idx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeChild(idx)}
                      className="text-[#EF4444] hover:text-[#DC2626] p-1 text-xs"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="text-[10px] font-semibold text-[#64748B] block mb-1">
                        Birth Year
                      </label>
                      <input
                        type="number"
                        value={child.birth_year}
                        onChange={(e) =>
                          updateChild(idx, { birth_year: Number(e.target.value) })
                        }
                        className="w-full bg-white border border-[#CBD5E1] rounded-lg p-2 text-xs font-medium"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-semibold text-[#64748B] block mb-1">
                        Education Stage
                      </label>
                      <select
                        value={child.education_stage}
                        onChange={(e) =>
                          updateChild(idx, {
                            education_stage: e.target.value as EducationStage,
                          })
                        }
                        className="w-full bg-white border border-[#CBD5E1] rounded-lg p-2 text-xs font-medium"
                      >
                        <option value="below_18">Under 18 Years Old ({formatRM(childUnder18Limit, 2000)})</option>
                        <option value="a_level_matriculation">
                          18+ Studying A-Level / Pre-U / Matriculation ({formatRM(childAlevelLimit, 2000)})
                        </option>
                        <option value="diploma_degree_higher">
                          18+ Studying Diploma / Degree or higher ({formatRM(childHigherEdLimit, 8000)})
                        </option>
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label className="flex items-center gap-2 cursor-pointer pt-1">
                        <input
                          type="checkbox"
                          checked={Boolean(child.has_disability)}
                          onChange={(e) =>
                            updateChild(idx, { has_disability: e.target.checked })
                          }
                          className="w-3.5 h-3.5 rounded text-[#0052FF]"
                        />
                        <span className="text-[11px] text-[#0F172A] font-medium">
                          Child has a registered disability (OKU) — {formatRM(disabledChildLimit, 8000)} / {formatRM(disabledChildTotalWithHigherEd, 16000)} (with higher education)
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Save Button */}
        <div className="pt-4 border-t border-[#F1F5F9] flex items-center justify-between">
          {savedSuccess ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#059669]">
              <CheckCircle2 className="w-4 h-4" /> Profile saved! Redirecting...
            </span>
          ) : (
            <span className="text-xs text-[#64748B]">
              Updates your active tax relief categories
            </span>
          )}

          <button
            type="submit"
            disabled={saving}
            className="bg-[#0052FF] text-white text-xs font-semibold py-2.5 px-5 rounded-xl flex items-center gap-2 active:bg-[#0040CC] transition-colors disabled:opacity-50 shadow-sm"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Tax Profile'}
          </button>
        </div>
      </form>
    </div>
  )
}
