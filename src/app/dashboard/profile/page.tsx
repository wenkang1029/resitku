'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
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
  Send,
  Loader2,
  Copy,
  Check,
  Unlink,
  Clock,
  ExternalLink,
} from 'lucide-react'

export default function TaxProfilePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)

  // User Profile States
  const [telegramId, setTelegramId] = useState<number | null>(null)
  const [maritalStatus, setMaritalStatus] = useState<'single' | 'married'>('single')
  const [filingType, setFilingType] = useState<'joint' | 'separate'>('separate')
  const [hasDisability, setHasDisability] = useState<boolean>(false)
  const [spouseHasDisability, setSpouseHasDisability] = useState<boolean>(false)
  const [children, setChildren] = useState<DependentChild[]>([])

  // Telegram Link Code States
  const [linkCode, setLinkCode] = useState<string | null>(null)
  const [codeExpiresAt, setCodeExpiresAt] = useState<Date | null>(null)
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0)
  const [generatingCode, setGeneratingCode] = useState(false)
  const [unlinking, setUnlinking] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    async function loadProfile() {
      try {
        setLoading(true)
        const res = await fetch('/api/profile')
        const data = await res.json()

        if (data.telegram_id !== undefined) {
          setTelegramId(data.telegram_id)
        }

        if (data.filing_profile) {
          const p: FilingProfile = data.filing_profile
          setMaritalStatus(p.marital_status || 'single')
          setFilingType(p.filing_type || 'separate')
          setHasDisability(Boolean(p.has_disability))
          setSpouseHasDisability(Boolean(p.spouse_has_disability))
          setChildren(p.dependent_children || [])
        }
      } catch (err) {
        console.error('Failed to load profile:', err)
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [])

  // Timer countdown for link code expiration
  useEffect(() => {
    if (!codeExpiresAt) return

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((codeExpiresAt.getTime() - Date.now()) / 1000))
      setSecondsRemaining(remaining)

      if (remaining <= 0) {
        setLinkCode(null)
        setCodeExpiresAt(null)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [codeExpiresAt])

  const generateLinkCode = async () => {
    setGeneratingCode(true)
    try {
      const res = await fetch('/api/telegram/generate-code', { method: 'POST' })
      const data = await res.json()

      if (res.ok && data.code) {
        setLinkCode(data.code)
        const exp = new Date(data.expires_at)
        setCodeExpiresAt(exp)
        setSecondsRemaining(Math.max(0, Math.floor((exp.getTime() - Date.now()) / 1000)))
      } else {
        alert(data.error || 'Failed to generate link code.')
      }
    } catch (err) {
      console.error('Error generating link code:', err)
      alert('Failed to generate link code.')
    } finally {
      setGeneratingCode(false)
    }
  }

  const unlinkTelegram = async () => {
    if (!window.confirm('Are you sure you want to disconnect your Telegram account from this dashboard?')) {
      return
    }

    setUnlinking(true)
    try {
      const res = await fetch('/api/telegram/unlink', { method: 'POST' })
      const data = await res.json()

      if (res.ok) {
        setTelegramId(null)
        setLinkCode(null)
      } else {
        alert(data.error || 'Failed to unlink Telegram.')
      }
    } catch (err) {
      console.error('Error unlinking Telegram:', err)
      alert('Failed to unlink Telegram.')
    } finally {
      setUnlinking(false)
    }
  }

  const copyToClipboard = () => {
    if (!linkCode) return
    navigator.clipboard.writeText(`/link ${linkCode}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

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
        setTimeout(() => {
          router.push('/dashboard/relief')
        }, 1000)
      } else {
        alert('Failed to save profile.')
      }
    } catch (err) {
      console.error('Error saving profile:', err)
      alert('Error saving profile.')
    } finally {
      setSaving(false)
    }
  }

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s < 10 ? '0' : ''}${s}`
  }

  return (
    <>
      <DashboardHeader
        title="Tax Profile & Settings"
        subtitle="Manage tax relief allowances and connected accounts"
      />

      <main className="px-4 py-6 space-y-6 flex-1 max-w-3xl">
        {/* 1. Connect Telegram Bot Section */}
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <h2 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                <Send className="w-4 h-4 text-[#0088cc]" /> Telegram Bot Integration
              </h2>
              <p className="text-xs text-[#64748B]">
                Upload receipt photos on the go via our zero-typing Telegram bot.
              </p>
            </div>

            {telegramId ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#D1FAE5] text-[#059669]">
                <CheckCircle2 className="w-3.5 h-3.5" /> Connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#FEF3C7] text-[#D97706]">
                Not Connected
              </span>
            )}
          </div>

          {telegramId ? (
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="text-xs space-y-0.5">
                <p className="font-semibold text-[#0F172A]">
                  Linked Telegram ID: <span className="font-mono text-[#0052FF]">{telegramId}</span>
                </p>
                <p className="text-[11px] text-[#64748B]">
                  Receipts uploaded by this Telegram account will automatically appear in your dashboard.
                </p>
              </div>

              <button
                type="button"
                onClick={unlinkTelegram}
                disabled={unlinking}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#EF4444] bg-[#FEE2E2] hover:bg-[#FCA5A5] px-3 py-1.5 rounded-xl transition-colors disabled:opacity-50"
              >
                <Unlink className="w-3.5 h-3.5" />
                {unlinking ? 'Disconnecting...' : 'Unlink Telegram'}
              </button>
            </div>
          ) : (
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 space-y-3">
              {linkCode ? (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-[#E2E8F0] pb-3">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider font-bold text-[#64748B] block">
                        Your 6-Digit Link Code
                      </span>
                      <p className="text-3xl font-mono font-black text-[#0052FF] tracking-widest mt-0.5">
                        {linkCode}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#D97706] bg-[#FEF3C7] px-2.5 py-1 rounded-lg tabular-nums">
                        <Clock className="w-3.5 h-3.5" /> {formatTimer(secondsRemaining)}
                      </span>
                      <button
                        type="button"
                        onClick={copyToClipboard}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#0F172A] bg-white border border-[#CBD5E1] hover:bg-[#F1F5F9] px-2.5 py-1 rounded-lg transition-colors"
                      >
                        {copied ? <Check className="w-3.5 h-3.5 text-[#059669]" /> : <Copy className="w-3.5 h-3.5" />}
                        {copied ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>

                  <div className="text-xs space-y-1.5 text-[#0F172A]">
                    <p className="font-semibold">How to link your account:</p>
                    <ol className="list-decimal list-inside space-y-1 text-[11px] text-[#64748B]">
                      <li>Open Telegram and message our bot: <span className="font-mono text-[#0088cc] font-semibold">@ResitKuBot</span></li>
                      <li>Send the command: <code className="bg-white border px-1.5 py-0.5 rounded font-mono text-[#0052FF]">/link {linkCode}</code></li>
                      <li>Your Telegram account will instantly link to this dashboard.</li>
                    </ol>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="text-xs space-y-0.5">
                    <p className="font-semibold text-[#0F172A]">Link your Telegram Identity</p>
                    <p className="text-[11px] text-[#64748B]">
                      Generate a temporary 10-minute code to pair your Telegram chat with this ResitKu account.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={generateLinkCode}
                    disabled={generatingCode}
                    className="inline-flex items-center gap-1.5 bg-[#0088cc] hover:bg-[#0077b5] text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all shadow-xs disabled:opacity-50"
                  >
                    {generatingCode ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating...
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" /> Generate Link Code
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 2. Personal Tax Profile Form */}
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
                    Spouse has a registered disability (OKU) — RM 6,000
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
                    Unlocks additional RM 7,000 disabled individual relief
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
                            <option value="below_18">Under 18 Years Old (RM 2,000)</option>
                            <option value="a_level_matriculation">
                              18+ Studying A-Level / Pre-U / Matriculation (RM 2,000)
                            </option>
                            <option value="diploma_degree_higher">
                              18+ Studying Diploma / Degree or higher (RM 8,000)
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
                              Child has a registered disability (OKU) — RM 6,000 / RM 14,000
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
      </main>
    </>
  )
}
