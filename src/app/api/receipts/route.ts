import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || null
    const yearStr = searchParams.get('year')
    const year = yearStr ? Number(yearStr) : null

    // Session-aware client with active user cookies — strictly governed by RLS (auth.uid() = user_id)
    const supabase = await createServerClient()
    
    // Check authenticated session
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 })
    }

    let query = supabase
      .from('receipts')
      .select('*')
      .order('transaction_date', { ascending: false, nullsFirst: false })

    if (status) {
      query = query.eq('status', status)
    }

    if (year) {
      query = query.eq('assessment_year', year)
    }

    const { data, error } = await query

    if (error) {
      console.error('[api/receipts] Error fetching receipts:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ receipts: data || [] })
  } catch (err: any) {
    console.error('[api/receipts] Server error:', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
