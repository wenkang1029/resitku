'use client'

import React, { useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import {
  UploadCloud,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  X,
  ArrowRight,
  ImageIcon,
} from 'lucide-react'
import Link from 'next/link'

export function QuickUploadModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    setMounted(true)
  }, [])

  // Prevent background body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected) return

    setFile(selected)
    setResult(null)

    const reader = new FileReader()
    reader.onload = () => {
      setPreview(reader.result as string)
    }
    reader.readAsDataURL(selected)
  }

  const handleUpload = async () => {
    if (!preview || !file) return

    setUploading(true)
    setResult(null)

    try {
      const base64Data = preview.split(',')[1]
      const mimeType = file.type || 'image/jpeg'

      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: base64Data,
          mime_type: mimeType,
        }),
      })

      const data = await res.json()
      setResult(data)
      if (res.ok && data.success) {
        router.refresh()
      }
    } catch (err: any) {
      console.error('Extraction error:', err)
      setResult({
        success: false,
        error: err.message || 'Failed to process receipt.',
      })
    } finally {
      setUploading(false)
    }
  }

  const resetModal = () => {
    setFile(null)
    setPreview(null)
    setResult(null)
    setUploading(false)
    setIsOpen(false)
  }

  const modalContent = isOpen && mounted ? (
    <div 
      className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !uploading) resetModal()
      }}
    >
      <div className="bg-white border border-[#E2E8F0] rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-150 relative">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-[#F1F5F9] bg-white sticky top-0 z-10">
          <div>
            <h2 className="text-base font-bold text-[#0F172A]">Upload Receipt</h2>
            <p className="text-xs text-[#64748B]">Scan receipt with AI multimodal extraction</p>
          </div>
          <button
            type="button"
            onClick={resetModal}
            disabled={uploading}
            className="p-1.5 rounded-xl text-[#64748B] hover:bg-[#F1F5F9] transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* Upload & Preview State */}
          {!result && (
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />

              {preview ? (
                <div className="relative rounded-2xl overflow-hidden border border-[#E2E8F0] bg-black/5 flex flex-col items-center justify-center p-2">
                  <img
                    src={preview}
                    alt="Receipt preview"
                    className="max-h-64 sm:max-h-72 w-auto object-contain rounded-xl shadow-xs"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="absolute bottom-4 right-4 bg-black/75 hover:bg-black/90 text-white text-xs font-semibold px-3 py-1.5 rounded-xl backdrop-blur transition-all flex items-center gap-1.5 shadow-md"
                  >
                    <ImageIcon className="w-3.5 h-3.5" /> Change Photo
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-[#CBD5E1] hover:border-[#0052FF] hover:bg-[#0052FF]/5 rounded-2xl p-8 sm:p-10 text-center cursor-pointer transition-all bg-[#F8FAFC] space-y-3 group"
                >
                  <div className="w-12 h-12 rounded-2xl bg-white border border-[#E2E8F0] shadow-xs flex items-center justify-center mx-auto text-[#64748B] group-hover:text-[#0052FF] group-hover:scale-105 transition-all">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#0F172A]">
                      Click to browse or take receipt photo
                    </p>
                    <p className="text-[11px] text-[#94A3B8] mt-1">
                      Supports JPEG, PNG, HEIC, WebP (Max 15MB)
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 3 Result States: Rejected, Needs Review, or Confirmed */}
          {result && (
            <div className="space-y-4">
              {/* State 1: Rejected / Legibility Error */}
              {(!result.success || result.raw_llm_response?.is_legible === false) && (
                <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-2xl p-4 space-y-2 text-xs text-[#991B1B]">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <XCircle className="w-5 h-5 text-[#EF4444] shrink-0" /> Receipt Unreadable
                  </div>
                  <p className="text-[11px] leading-relaxed text-[#7F1D1D]">
                    {result.error ||
                      result.raw_llm_response?.extraction_notes ||
                      'The image provided is unreadable. Please capture a clearer, well-lit photo.'}
                  </p>
                </div>
              )}

              {/* State 2: Needs Review (Flagged / Possible Duplicate / Multi-item) */}
              {result.success && result.needs_review && (
                <div className="bg-[#FEF3C7] border border-[#FDE68A] rounded-2xl p-4 space-y-3 text-xs text-[#92400E]">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <AlertTriangle className="w-5 h-5 text-[#D97706] shrink-0" /> Flagged for Review
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs pt-1 border-t border-[#FDE68A]/60">
                    <div>
                      <span className="text-[#B45309] text-[10px] uppercase font-bold block">Merchant</span>
                      <span className="font-bold text-[#0F172A] text-sm">
                        {result.raw_llm_response?.merchant || 'Unknown'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#B45309] text-[10px] uppercase font-bold block">Total Amount</span>
                      <span className="font-extrabold text-[#0F172A] text-sm tabular-nums">
                        RM {Number(result.raw_llm_response?.total_amount || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                  {result.review_reasons && result.review_reasons.length > 0 && (
                    <div className="pt-2 border-t border-[#FDE68A]/60 space-y-1">
                      <span className="text-[10px] uppercase font-bold text-[#B45309] block">Flagged Reasons:</span>
                      <ul className="text-[11px] list-disc list-inside text-[#92400E] space-y-0.5">
                        {result.review_reasons.map((r: string, idx: number) => (
                          <li key={idx}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* State 3: Auto-Confirmed */}
              {result.success && !result.needs_review && (
                <div className="bg-[#ECFDF5] border border-[#A7F3D0] rounded-2xl p-4 space-y-3 text-xs text-[#065F46]">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <CheckCircle2 className="w-5 h-5 text-[#059669] shrink-0" /> Receipt Processed & Confirmed!
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs pt-1 border-t border-[#A7F3D0]/60">
                    <div>
                      <span className="text-[#047857] text-[10px] uppercase font-bold block">Merchant</span>
                      <span className="font-bold text-[#0F172A] text-sm">
                        {result.raw_llm_response?.merchant || 'Unknown'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#047857] text-[10px] uppercase font-bold block">Total Paid</span>
                      <span className="font-extrabold text-[#0F172A] text-sm tabular-nums">
                        RM {Number(result.raw_llm_response?.total_amount || 0).toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#047857] text-[10px] uppercase font-bold block">Spending Category</span>
                      <span className="font-semibold capitalize text-[#0F172A]">
                        {result.raw_llm_response?.spending_category || 'other'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#047857] text-[10px] uppercase font-bold block">Tax Relief Category</span>
                      <span className="font-bold text-[#0052FF]">
                        {result.raw_llm_response?.relief_category === 'none' ? 'None (Not claimable)' : result.raw_llm_response?.relief_category}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 border-t border-[#F1F5F9] bg-[#F8FAFC] flex justify-between items-center sticky bottom-0 z-10">
          {!result ? (
            <>
              <button
                type="button"
                onClick={resetModal}
                disabled={uploading}
                className="px-4 py-2 text-xs font-semibold text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] rounded-xl transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpload}
                disabled={!file || uploading}
                className="bg-[#0052FF] hover:bg-[#0040CC] text-white text-xs font-semibold px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all disabled:opacity-50 shadow-sm"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analyzing Receipt...
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-4 h-4" />
                    Extract & Record
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setResult(null)
                  setFile(null)
                  setPreview(null)
                }}
                className="text-xs text-[#0052FF] font-semibold hover:underline px-2 py-1"
              >
                Upload Another Receipt
              </button>

              <div className="flex items-center gap-2">
                {result.db_receipt && (
                  <Link
                    href={`/dashboard/receipts/${result.db_receipt.id}`}
                    onClick={resetModal}
                    className="bg-[#0052FF] hover:bg-[#0040CC] text-white text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5 transition-colors shadow-xs"
                  >
                    View Details <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )}
                <button
                  type="button"
                  onClick={resetModal}
                  className="px-3.5 py-2 text-xs font-medium text-[#64748B] hover:bg-[#F1F5F9] rounded-xl transition-colors"
                >
                  Done
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  ) : null

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 bg-[#0052FF] hover:bg-[#0040CC] text-white text-xs font-semibold px-3 py-1.5 rounded-xl transition-all shadow-xs active:scale-95 shrink-0"
      >
        <UploadCloud className="w-4 h-4" />
        <span className="hidden sm:inline">+ Upload Receipt</span>
        <span className="sm:hidden">+ Upload</span>
      </button>

      {mounted && typeof document !== 'undefined' && createPortal(modalContent, document.body)}
    </>
  )
}
