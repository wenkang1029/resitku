import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 })
    }

    // Invalidate previous unused codes for this user
    await supabase
      .from('link_codes')
      .update({ used: true })
      .eq('user_id', user.id)
      .eq('used', false)

    // Retry loop (up to 5 attempts) to guarantee uniqueness on rare collision
    let code = ''
    let expiresAt = ''
    let inserted = false
    let attempts = 0

    while (!inserted && attempts < 5) {
      attempts++
      code = Math.floor(100000 + Math.random() * 900000).toString()
      expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

      const { error } = await supabase
        .from('link_codes')
        .insert({
          code,
          user_id: user.id,
          expires_at: expiresAt,
          used: false,
        })

      if (!error) {
        inserted = true
      } else if (error.code !== '23505') {
        // If not a unique constraint violation, throw the error
        console.error('[generate-code] DB error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    }

    if (!inserted) {
      return NextResponse.json({ error: 'Failed to generate a unique link code. Please try again.' }, { status: 500 })
    }

    return NextResponse.json({
      code,
      expires_at: expiresAt,
    })
  } catch (err: any) {
    console.error('[generate-code] Server error:', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
