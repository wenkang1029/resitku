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

export async function PATCH(
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

    const body = await req.json()
    const { assessment_year } = body

    if (!assessment_year || isNaN(Number(assessment_year))) {
      return NextResponse.json({ error: 'Valid assessment_year is required' }, { status: 400 })
    }

    const targetYear = Number(assessment_year)

    // 1. Fetch current receipt to check ownership and relief_category
    const { data: existingReceipt, error: fetchErr } = await supabase
      .from('receipts')
      .select('id, relief_category')
      .eq('id', id)
      .single()

    if (fetchErr || !existingReceipt) {
      return NextResponse.json({ error: 'Receipt not found' }, { status: 404 })
    }

    // 2. Fetch corresponding active rule_version_id for target assessment_year
    const { data: rules } = await supabase
      .from('relief_rules')
      .select('id, category_key, rule_version, status')
      .eq('assessment_year', targetYear)
      .eq('status', 'active')

    let newRuleVersionId: string | null = null
    const matchedRule = (rules || []).find((r) => r.category_key === existingReceipt.relief_category)
    if (matchedRule) {
      newRuleVersionId = matchedRule.id
    } else if (rules && rules.length > 0) {
      const noneRule = rules.find((r) => r.category_key === 'none')
      const fallbackRule = noneRule || rules[0]
      newRuleVersionId = fallbackRule ? fallbackRule.id : null
    }

    // 3. Update receipt record with both assessment_year and new rule_version_id
    const { data: updatedReceipt, error: updateErr } = await supabase
      .from('receipts')
      .update({
        assessment_year: targetYear,
        rule_version_id: newRuleVersionId,
      })
      .eq('id', id)
      .select('*')
      .single()

    if (updateErr) {
      console.error('[api/receipts/[id]] Update error:', updateErr)
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      receipt: updatedReceipt,
    })
  } catch (err: any) {
    console.error('[api/receipts/[id]] PATCH error:', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}

