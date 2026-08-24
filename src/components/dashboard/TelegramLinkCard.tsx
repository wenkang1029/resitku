'use client'

import React, { useState, useEffect } from 'react'
import { Send, CheckCircle2, Copy, Check, Unlink, Clock, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

interface TelegramLinkCardProps {
  telegramId: number | null
  onTelegramIdChange: (id: number | null) => void
}

export function TelegramLinkCard({ telegramId, onTelegramIdChange }: TelegramLinkCardProps) {
  const [linkCode, setLinkCode] = useState<string | null>(null)
  const [codeExpiresAt, setCodeExpiresAt] = useState<Date | null>(null)
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0)
  const [generatingCode, setGeneratingCode] = useState(false)
  const [unlinking, setUnlinking] = useState(false)
  const [showUnlinkModal, setShowUnlinkModal] = useState(false)
  const [copied, setCopied] = useState(false)

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
        toast.success('Generated 6-digit link code')
      } else {
        toast.error(data.error || 'Failed to generate link code.')
      }
    } catch (err) {
      console.error('Error generating link code:', err)
      toast.error('Network error generating link code.')
    } finally {
      setGeneratingCode(false)
    }
  }

  const executeUnlink = async () => {
    setUnlinking(true)
    try {
      const res = await fetch('/api/telegram/unlink', { method: 'POST' })
      const data = await res.json()

      if (res.ok) {
        onTelegramIdChange(null)
        setLinkCode(null)
        toast.success('Telegram account disconnected')
      } else {
        toast.error(data.error || 'Failed to unlink Telegram.')
      }
    } catch (err) {
      console.error('Error unlinking Telegram:', err)
      toast.error('Network error unlinking Telegram.')
    } finally {
      setUnlinking(false)
      setShowUnlinkModal(false)
    }
  }

  const copyToClipboard = () => {
    if (!linkCode) return
    navigator.clipboard.writeText(`/link ${linkCode}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s < 10 ? '0' : ''}${s}`
  }

  return (
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
            onClick={() => setShowUnlinkModal(true)}
            disabled={unlinking}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#EF4444] bg-[#FEE2E2] hover:bg-[#FCA5A5] px-3 py-1.5 rounded-xl transition-colors disabled:opacity-50 min-h-[36px]"
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

      {/* Telegram Unlink Modal */}
      <ConfirmDialog
        isOpen={showUnlinkModal}
        title="Disconnect Telegram Account"
        description="Are you sure you want to disconnect your Telegram account? You will need to generate a new 6-digit code to pair again."
        confirmLabel="Disconnect"
        isDestructive={true}
        isLoading={unlinking}
        onConfirm={executeUnlink}
        onCancel={() => setShowUnlinkModal(false)}
      />
    </div>
  )
}
