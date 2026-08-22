import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 })
    }

    // Set telegram_id to null for the authenticated user (enforced by RLS `users: update own row`)
    const { data, error } = await supabase
      .from('users')
      .update({ telegram_id: null })
      .eq('id', user.id)
      .select()
      .single()

    if (error) {
      console.error('[unlink-telegram] Error unlinking Telegram:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, user: data })
  } catch (err: any) {
    console.error('[unlink-telegram] Server error:', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
