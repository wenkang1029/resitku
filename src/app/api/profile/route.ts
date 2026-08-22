import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { FilingProfile } from '@/lib/relief/applicableCategories'

export async function GET() {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Automatically scoped by RLS policy `users: select own row` (auth.uid() = id)
    const { data: userData, error } = await supabase
      .from('users')
      .select('id, email, telegram_id, filing_profile')
      .eq('id', user.id)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('[api/profile] Error fetching profile:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      id: userData?.id,
      email: userData?.email,
      telegram_id: userData?.telegram_id || null,
      filing_profile: userData?.filing_profile || null,
    })
  } catch (err: any) {
    console.error('[api/profile] Server error:', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { filing_profile } = (await req.json()) as { filing_profile: FilingProfile }

    if (!filing_profile) {
      return NextResponse.json({ error: 'Missing filing_profile payload' }, { status: 400 })
    }

    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Automatically scoped by RLS policy `users: update own row` (auth.uid() = id)
    const { data, error } = await supabase
      .from('users')
      .update({
        filing_profile,
      })
      .eq('id', user.id)
      .select()
      .single()

    if (error) {
      console.error('[api/profile] Error updating profile:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, user: data })
  } catch (err: any) {
    console.error('[api/profile] Server error:', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
