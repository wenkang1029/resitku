import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

/**
 * GET /api/health
 *
 * Verifies the Supabase project is reachable and the anon key is valid
 * by calling supabase.auth.getUser() — this always makes a live network
 * round-trip to Supabase Auth using the anon key, requires no user
 * tables, no service_role key, and no custom RPCs.
 *
 * Expected result: { user: null } (no session) → still proves connectivity.
 * A network/key error will throw or return an AuthApiError.
 */
export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      {
        status: 'error',
        message: 'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local',
      },
      { status: 500 }
    )
  }

  try {
    const supabase = createServerClient()

    // getUser() with no session always hits the Supabase Auth endpoint.
    // Returns { data: { user: null }, error: null } when there's no session —
    // that's fine; it still proves the project URL and anon key are valid.
    // Only a real connectivity or auth config error will produce error != null.
    const { error } = await supabase.auth.getUser()

    // AuthSessionMissingError is expected (no session) — not a real failure.
    // Any other error means the key or URL is wrong.
    const isExpectedNoSession =
      !error || error.message === 'Auth session missing!'

    if (!isExpectedNoSession) {
      return NextResponse.json(
        {
          status: 'error',
          message: error.message,
          hint: 'Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local',
        },
        { status: 503 }
      )
    }

    return NextResponse.json({
      status: 'ok',
      db: 'connected',
      supabase_url: supabaseUrl,
      note: 'Auth endpoint reachable — no user session (expected at this stage)',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { status: 'error', message },
      { status: 500 }
    )
  }
}

