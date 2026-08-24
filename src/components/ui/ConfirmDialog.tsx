'use client'

import React from 'react'
import { AlertTriangle, Trash2, X } from 'lucide-react'

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  isDestructive?: boolean
  isLoading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDestructive = true,
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xl max-w-md w-full p-5 space-y-4 animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start gap-3">
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
              isDestructive ? 'bg-[#FEE2E2] text-[#EF4444]' : 'bg-[#EFF6FF] text-[#0052FF]'
            }`}
          >
            {isDestructive ? <Trash2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          </div>

          <div className="space-y-1 flex-1 min-w-0">
            <h3 className="text-sm font-bold text-[#0F172A] leading-tight">{title}</h3>
            <p className="text-xs text-[#64748B] leading-relaxed">{description}</p>
          </div>

          <button
            onClick={onCancel}
            disabled={isLoading}
            className="text-[#94A3B8] hover:text-[#0F172A] transition-colors p-1 -mr-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex justify-end items-center gap-2 pt-2 border-t border-[#F1F5F9]">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-[#64748B] hover:bg-[#F1F5F9] transition-colors disabled:opacity-50 min-h-[36px]"
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-1.5 rounded-xl text-xs font-semibold text-white shadow-xs transition-colors disabled:opacity-50 min-h-[36px] flex items-center gap-1.5 ${
              isDestructive ? 'bg-[#EF4444] hover:bg-[#DC2626]' : 'bg-[#0052FF] hover:bg-[#0040CC]'
            }`}
          >
            {isLoading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
