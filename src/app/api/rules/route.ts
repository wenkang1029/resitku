import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const yearStr = searchParams.get('year')
    const year = yearStr ? Number(yearStr) : 2025

    // Session-aware client with active user cookies — reads public reference rules (active only)
    const supabase = await createServerClient()
    const { data: rules, error } = await supabase
      .from('relief_rules')
      .select('*')
      .eq('assessment_year', year)
      .eq('status', 'active')
      .order('id', { ascending: true })

    if (error) {
      console.error('[api/rules] Error fetching rules:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ rules: rules || [] })
  } catch (err: any) {
    console.error('[api/rules] Server error:', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
