import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { verifyAdminSession } from '@/lib/supabase/adminAuth'

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAdminSession()
    if (!auth.isAdmin) {
      return NextResponse.json({ error: auth.error || 'Forbidden: Admin access required' }, { status: 403 })
    }

    const body = await req.json()
    const { draft_ids, assessment_year } = body

    if (!Array.isArray(draft_ids) || draft_ids.length === 0) {
      return NextResponse.json({ error: 'draft_ids must be a non-empty array of IDs' }, { status: 400 })
    }

    const supabase = await createServerClient()

    // 1. Fetch all selected draft rules
    const { data: drafts, error: fetchErr } = await supabase
      .from('relief_rules')
      .select('*')
      .in('id', draft_ids)
      .eq('status', 'draft')

    if (fetchErr) {
      console.error('[api/admin/rules/publish] Fetch error:', fetchErr)
      return NextResponse.json({ error: fetchErr.message }, { status: 500 })
    }

    if (!drafts || drafts.length === 0) {
      return NextResponse.json({ error: 'No valid draft rules found for provided IDs.' }, { status: 400 })
    }

    const activatedIds: string[] = []
    const supersededKeys: string[] = []

    // 2. Process each draft row
    for (const draft of drafts) {
      // Find currently active rule for the same category_key and assessment_year
      const { data: existingActive } = await supabase
        .from('relief_rules')
        .select('id')
        .eq('assessment_year', draft.assessment_year)
        .eq('category_key', draft.category_key)
        .eq('status', 'active')

      if (existingActive && existingActive.length > 0) {
        const activeIds = existingActive.map((r) => r.id).filter((id) => id !== draft.id)
        if (activeIds.length > 0) {
          // Supersede existing active rows (never delete, never overwrite in place)
          await supabase
            .from('relief_rules')
            .update({ status: 'superseded' })
            .in('id', activeIds)

          supersededKeys.push(draft.category_key)
        }
      }

      // Promote draft to active
      const { error: activateErr } = await supabase
        .from('relief_rules')
        .update({ status: 'active' })
        .eq('id', draft.id)

      if (!activateErr) {
        activatedIds.push(draft.id)
      } else {
        console.error(`[api/admin/rules/publish] Error activating rule ${draft.id}:`, activateErr)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully published ${activatedIds.length} rule(s) to active. ${supersededKeys.length} previous version(s) superseded.`,
      activated_count: activatedIds.length,
      activated_ids: activatedIds,
      superseded_categories: supersededKeys,
    })
  } catch (err: any) {
    console.error('[api/admin/rules/publish] Server error:', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
