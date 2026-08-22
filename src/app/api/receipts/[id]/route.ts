import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: 'Missing receipt ID' }, { status: 400 })
    }

    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Scoped by RLS `receipts: select own` (auth.uid() = user_id)
    const { data: receipt, error: rError } = await supabase
      .from('receipts')
      .select('*')
      .eq('id', id)
      .single()

    if (rError || !receipt) {
      return NextResponse.json({ error: 'Receipt not found' }, { status: 404 })
    }

    // Load line items (scoped by RLS `receipt_line_items: select own`)
    const { data: lineItems } = await supabase
      .from('receipt_line_items')
      .select('*')
      .eq('receipt_id', id)

    // If duplicate, load original receipt info
    let duplicateOf = null
    if (receipt.duplicate_of_id) {
      const { data: dupData } = await supabase
        .from('receipts')
        .select('id, merchant, total_amount, transaction_date')
        .eq('id', receipt.duplicate_of_id)
        .single()

      if (dupData) duplicateOf = dupData
    }

    return NextResponse.json({
      receipt,
      line_items: lineItems || [],
      duplicate_of: duplicateOf,
    })
  } catch (err: any) {
    console.error('[api/receipts/[id]] Server error:', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
