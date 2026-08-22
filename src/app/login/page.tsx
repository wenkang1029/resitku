'use client'

import React, { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Lock, Mail, KeyRound, Loader2, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') || '/dashboard/expenses'

  const [email, setEmail] = useState('wenkang1029+test1@gmail.com')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [authMode, setAuthMode] = useState<'password' | 'magic_link'>('password')

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErrorMessage(null)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        throw error
      }

      if (data.session) {
        router.push(redirectTo)
        router.refresh()
      }
    } catch (err: any) {
      console.error('Login error:', err)
      setErrorMessage(err.message || 'Invalid login credentials')
    } finally {
      setLoading(false)
    }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErrorMessage(null)

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/auth/callback?redirectTo=${encodeURIComponent(redirectTo)}` : undefined,
        },
      })

      if (error) throw error

      setMagicLinkSent(true)
    } catch (err: any) {
      console.error('Magic link error:', err)
      setErrorMessage(err.message || 'Failed to send magic link')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#0052FF]/10 text-[#0052FF] mb-2 shadow-xs">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-[#0F172A]">ResitKu</h1>
          <p className="text-xs text-[#64748B]">Personal Expense & Tax Relief Dashboard</p>
        </div>

        {/* Login Card */}
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm space-y-5">
          <div className="flex border-b border-[#F1F5F9] pb-3 text-xs font-semibold">
            <button
              type="button"
              onClick={() => { setAuthMode('password'); setErrorMessage(null); }}
              className={`flex-1 pb-2 border-b-2 transition-colors ${
                authMode === 'password'
                  ? 'border-[#0052FF] text-[#0052FF]'
                  : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              Password Login
            </button>
            <button
              type="button"
              onClick={() => { setAuthMode('magic_link'); setErrorMessage(null); }}
              className={`flex-1 pb-2 border-b-2 transition-colors ${
                authMode === 'magic_link'
                  ? 'border-[#0052FF] text-[#0052FF]'
                  : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              Magic Link
            </button>
          </div>

          {errorMessage && (
            <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-xl p-3 flex items-start gap-2.5 text-xs text-[#991B1B]">
              <AlertCircle className="w-4 h-4 text-[#EF4444] shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {magicLinkSent ? (
            <div className="bg-[#ECFDF5] border border-[#A7F3D0] rounded-xl p-4 text-center space-y-2">
              <p className="text-xs font-bold text-[#065F46]">Magic Link Sent! ✉️</p>
              <p className="text-[11px] text-[#047857]">
                Check your inbox at <span className="font-semibold">{email}</span> and click the link to sign in.
              </p>
              <button
                type="button"
                onClick={() => setMagicLinkSent(false)}
                className="text-[11px] text-[#0052FF] font-semibold hover:underline block pt-2"
              >
                Back to Login
              </button>
            </div>
          ) : authMode === 'password' ? (
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-[#0F172A] block uppercase tracking-wider">
                  Account Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-[#0F172A] focus:bg-white focus:outline-hidden focus:border-[#0052FF]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-[#0F172A] block uppercase tracking-wider">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-[#0F172A] focus:bg-white focus:outline-hidden focus:border-[#0052FF]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#0052FF] hover:bg-[#0040CC] text-white text-xs font-semibold py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 shadow-xs"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Signing In...
                  </>
                ) : (
                  <>
                    Sign In to ResitKu <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleMagicLink} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-[#0F172A] block uppercase tracking-wider">
                  Email for Magic Link
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-[#0F172A] focus:bg-white focus:outline-hidden focus:border-[#0052FF]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#0052FF] hover:bg-[#0040CC] text-white text-xs font-semibold py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 shadow-xs"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Sending Link...
                  </>
                ) : (
                  <>
                    Send Magic Link <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        <div className="text-center">
          <p className="text-[11px] text-[#94A3B8]">
            Protected by Supabase Auth & PostgreSQL Row-Level Security (RLS)
          </p>
        </div>
      </div>
    </div>
  )
}
