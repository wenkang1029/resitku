import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { buildExportReliefData, generateReliefCSV } from '@/lib/relief/exportRelief'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const yearStr = searchParams.get('year')
    const format = searchParams.get('format') || 'json'
    const assessmentYear = yearStr ? Number(yearStr) : 2025

    const supabase = await createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 1. Fetch rules for the target assessment year
    let { data: rules } = await supabase
      .from('relief_rules')
      .select('*')
      .eq('assessment_year', assessmentYear)
      .order('id', { ascending: true })

    // 2. Fetch confirmed receipts with embedded line items for the user
    const { data: receipts, error: receiptsError } = await supabase
      .from('receipts')
      .select('*, receipt_line_items(*)')
      .eq('user_id', user.id)
      .eq('status', 'confirmed')
      .eq('needs_review', false)
      .order('transaction_date', { ascending: false })

    if (receiptsError) {
      console.error('[api/export] Error fetching receipts:', receiptsError)
      return NextResponse.json({ error: 'Failed to fetch receipts' }, { status: 500 })
    }

    // 3. Build canonical export data using shared calculateRelief logic
    const exportData = buildExportReliefData(
      rules || [],
      receipts || [],
      assessmentYear,
      user.email ?? null
    )

    // 4. Return formatted response
    if (format === 'csv') {
      const csv = generateReliefCSV(exportData)
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="ResitKu_Tax_Relief_YA${assessmentYear}.csv"`,
        },
      })
    }

    // Default JSON payload for print view and client consumption
    return NextResponse.json(exportData)
  } catch (err: any) {
    console.error('[api/export] Server error:', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
