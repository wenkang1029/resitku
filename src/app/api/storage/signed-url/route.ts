import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const { path } = await req.json()

    if (!path) {
      return NextResponse.json({ error: 'Missing image path' }, { status: 400 })
    }

    const supabase = createAdminClient()
    // Generate signed URL with 15 minutes expiration (900 seconds) per NFR-1.1
    const { data, error } = await supabase.storage
      .from('receipts-images')
      .createSignedUrl(path, 900)

    if (error) {
      console.error('[signed-url] Error generating signed URL:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ signed_url: data.signedUrl })
  } catch (err: any) {
    console.error('[signed-url] Server error:', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
