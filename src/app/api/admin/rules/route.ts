import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { verifyAdminSession } from '@/lib/supabase/adminAuth'

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyAdminSession()
    if (!auth.isAdmin) {
      return NextResponse.json({ error: auth.error || 'Forbidden: Admin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const yearStr = searchParams.get('year')
    const status = searchParams.get('status') || null
    const year = yearStr ? Number(yearStr) : null

    const supabase = await createServerClient()
    let query = supabase
      .from('relief_rules')
      .select('*')
      .order('id', { ascending: true })

    if (year) {
      query = query.eq('assessment_year', year)
    }

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    const { data: rules, error } = await query

    if (error) {
      console.error('[api/admin/rules] Error fetching rules:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ rules: rules || [] })
  } catch (err: any) {
    console.error('[api/admin/rules] Server error:', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAdminSession()
    if (!auth.isAdmin) {
      return NextResponse.json({ error: auth.error || 'Forbidden: Admin access required' }, { status: 403 })
    }

    const body = await req.json()
    const {
      assessment_year,
      category_key,
      category_label_en,
      category_label_ms,
      limit_amount,
      sub_cap_parent_id,
      enforces_combined_cap,
      source_reference,
      description,
    } = body

    // Validation
    if (!assessment_year) {
      return NextResponse.json({ error: 'assessment_year is required' }, { status: 400 })
    }
    if (!category_key || typeof category_key !== 'string' || !category_key.trim()) {
      return NextResponse.json({ error: 'category_key is required (alphanumeric snake_case)' }, { status: 400 })
    }
    if (!category_label_en || !category_label_en.trim()) {
      return NextResponse.json({ error: 'category_label_en (English label) is required' }, { status: 400 })
    }
    if (!source_reference || !source_reference.trim()) {
      return NextResponse.json({ error: 'source_reference is strictly required (cite Budget speech, Gazette, or LHDN guidance)' }, { status: 400 })
    }

    const cleanKey = category_key.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_')
    const combinedLabel = category_label_ms && category_label_ms.trim()
      ? `${category_label_ms.trim()} / ${category_label_en.trim()}`
      : category_label_en.trim()

    const supabase = await createServerClient()

    // Determine next rule_version for this assessment_year + category_key
    const { data: existingRows } = await supabase
      .from('relief_rules')
      .select('rule_version')
      .eq('assessment_year', Number(assessment_year))
      .eq('category_key', cleanKey)
      .order('rule_version', { ascending: false })
      .limit(1)

    const nextVersion = existingRows && existingRows.length > 0 ? (existingRows[0].rule_version || 1) + 1 : 1

    // Always create as DRAFT. There is no path to create directly as active.
    const { data: newRule, error: insertError } = await supabase
      .from('relief_rules')
      .insert({
        assessment_year: Number(assessment_year),
        rule_version: nextVersion,
        status: 'draft',
        category_key: cleanKey,
        category_label: combinedLabel,
        category_label_en: category_label_en.trim(),
        category_label_ms: category_label_ms ? category_label_ms.trim() : null,
        limit_amount: limit_amount !== '' && limit_amount != null ? Number(limit_amount) : null,
        sub_cap_parent_id: sub_cap_parent_id || null,
        enforces_combined_cap: Boolean(enforces_combined_cap),
        source_reference: source_reference.trim(),
        description: description ? description.trim() : null,
      })
      .select()
      .single()

    if (insertError) {
      console.error('[api/admin/rules] Insert error:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Draft rule created successfully. Review and publish to activate.',
      rule: newRule,
    })
  } catch (err: any) {
    console.error('[api/admin/rules] Server error:', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
