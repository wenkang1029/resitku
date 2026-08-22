import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function DELETE(req: NextRequest) {
  try {
    const { receipt_id } = await req.json()

    if (!receipt_id) {
      return NextResponse.json({ error: 'Missing receipt_id' }, { status: 400 })
    }

    const supabase = await createServerClient()
    const { data, error } = await supabase
      .rpc('delete_receipt_admin', { p_receipt_id: receipt_id })

    if (error) {
      console.error('[api/receipts/delete] RPC Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, deleted_id: receipt_id })
  } catch (err: any) {
    console.error('[api/receipts/delete] Server error:', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
