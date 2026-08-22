'use client'

import React, { useEffect, useState } from 'react'
import { ImageOff, Loader2, ZoomIn } from 'lucide-react'

interface ReceiptImageViewerProps {
  imagePath: string | null
  merchant?: string | null
  className?: string
}

export function ReceiptImageViewer({ imagePath, merchant, className = '' }: ReceiptImageViewerProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(Boolean(imagePath))
  const [error, setError] = useState<boolean>(false)
  const [isZoomed, setIsZoomed] = useState<boolean>(false)

  useEffect(() => {
    if (!imagePath) {
      setLoading(false)
      setSignedUrl(null)
      return
    }

    let isMounted = true

    async function fetchSignedUrl() {
      try {
        setLoading(true)
        setError(false)
        const res = await fetch('/api/storage/signed-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: imagePath }),
        })

        const data = await res.json()
        if (isMounted) {
          if (res.ok && data.signed_url) {
            setSignedUrl(data.signed_url)
          } else {
            console.error('Failed to get signed URL for:', imagePath, data)
            setError(true)
          }
        }
      } catch (err) {
        if (isMounted) {
          console.error('Error fetching signed URL for:', imagePath, err)
          setError(true)
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    fetchSignedUrl()

    return () => {
      isMounted = false
    }
  }, [imagePath])

  if (!imagePath || error) {
    return (
      <div className={`bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl flex flex-col items-center justify-center p-8 text-center text-xs text-[#94A3B8] space-y-2 min-h-[160px] ${className}`}>
        <ImageOff className="w-8 h-8 text-[#CBD5E1]" />
        <span>No image available</span>
      </div>
    )
  }

  if (loading) {
    return (
      <div className={`bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl flex items-center justify-center p-8 min-h-[160px] ${className}`}>
        <Loader2 className="w-6 h-6 animate-spin text-[#0052FF]" />
      </div>
    )
  }

  return (
    <>
      <div className={`relative group overflow-hidden rounded-2xl border border-[#E2E8F0] bg-black/5 ${className}`}>
        <img
          src={signedUrl!}
          alt={merchant ? `Receipt from ${merchant}` : 'Receipt image'}
          className="w-full h-auto object-cover max-h-96 cursor-pointer transition-transform duration-200 group-hover:scale-[1.02]"
          onClick={() => setIsZoomed(true)}
          onError={() => setError(true)}
        />
        <button
          type="button"
          onClick={() => setIsZoomed(true)}
          className="absolute bottom-2.5 right-2.5 bg-black/60 hover:bg-black/80 text-white p-2 rounded-xl text-xs flex items-center gap-1.5 backdrop-blur transition-colors"
        >
          <ZoomIn className="w-3.5 h-3.5" />
          <span>Zoom</span>
        </button>
      </div>

      {/* Lightbox Modal */}
      {isZoomed && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setIsZoomed(false)}
        >
          <div className="relative max-w-3xl max-h-[90vh] overflow-auto">
            <img
              src={signedUrl!}
              alt="Receipt preview full"
              className="w-full h-auto rounded-2xl shadow-2xl"
            />
          </div>
        </div>
      )}
    </>
  )
}
