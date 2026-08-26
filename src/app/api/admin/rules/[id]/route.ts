import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { verifyAdminSession } from '@/lib/supabase/adminAuth'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAdminSession()
    if (!auth.isAdmin) {
      return NextResponse.json({ error: auth.error || 'Forbidden: Admin access required' }, { status: 403 })
    }

    const { id } = await params
    const supabase = await createServerClient()
    const { data: rule, error } = await supabase
      .from('relief_rules')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !rule) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
    }

    return NextResponse.json({ rule })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAdminSession()
    if (!auth.isAdmin) {
      return NextResponse.json({ error: auth.error || 'Forbidden: Admin access required' }, { status: 403 })
    }

    const { id } = await params
    const supabase = await createServerClient()

    // 1. Fetch existing rule to verify its status
    const { data: existingRule, error: fetchErr } = await supabase
      .from('relief_rules')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchErr || !existingRule) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
    }

    // 2. Strict Immutability Guard: Only DRAFT rows may be modified in place.
    if (existingRule.status !== 'draft') {
      return NextResponse.json(
        {
          error: `Cannot modify rule with status '${existingRule.status}'. Historical and active rules are immutable. To propose changes, create a new draft rule.`,
        },
        { status: 400 }
      )
    }

    const body = await req.json()
    const {
      category_label_en,
      category_label_ms,
      limit_amount,
      sub_cap_parent_id,
      enforces_combined_cap,
      source_reference,
      description,
    } = body

    if (source_reference !== undefined && (!source_reference || !source_reference.trim())) {
      return NextResponse.json({ error: 'source_reference is required and cannot be empty' }, { status: 400 })
    }

    const labelEn = category_label_en !== undefined ? category_label_en.trim() : existingRule.category_label_en
    const labelMs = category_label_ms !== undefined ? (category_label_ms ? category_label_ms.trim() : null) : existingRule.category_label_ms
    const combinedLabel = labelMs ? `${labelMs} / ${labelEn}` : labelEn

    const updatePayload: Record<string, any> = {}
    if (category_label_en !== undefined) updatePayload.category_label_en = labelEn
    if (category_label_ms !== undefined) updatePayload.category_label_ms = labelMs
    if (category_label_en !== undefined || category_label_ms !== undefined) updatePayload.category_label = combinedLabel
    if (limit_amount !== undefined) updatePayload.limit_amount = limit_amount !== '' && limit_amount != null ? Number(limit_amount) : null
    if (sub_cap_parent_id !== undefined) updatePayload.sub_cap_parent_id = sub_cap_parent_id || null
    if (enforces_combined_cap !== undefined) updatePayload.enforces_combined_cap = Boolean(enforces_combined_cap)
    if (source_reference !== undefined) updatePayload.source_reference = source_reference.trim()
    if (description !== undefined) updatePayload.description = description ? description.trim() : null

    const { data: updatedRule, error: updateErr } = await supabase
      .from('relief_rules')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single()

    if (updateErr) {
      console.error('[api/admin/rules/[id]] Update error:', updateErr)
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Draft rule updated successfully.',
      rule: updatedRule,
    })
  } catch (err: any) {
    console.error('[api/admin/rules/[id]] Server error:', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
