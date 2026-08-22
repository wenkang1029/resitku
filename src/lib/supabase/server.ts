import { createServerClient as createSSRServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

/**
 * Standard session-aware server-side Supabase client using Anon key.
 * Reads & writes auth tokens directly from HTTP cookies via @supabase/ssr.
 * Strictly subject to Postgres Row-Level Security (RLS) policies based on `auth.uid()`.
 * Use this in regular Server Components, Server Actions, and client-facing API routes.
 */
export async function createServerClient() {
  const cookieStore = await cookies()

  return createSSRServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing user sessions.
        }
      },
    },
  })
}

/**
 * Trusted Admin Supabase client using Service Role Key.
 * Bypasses Postgres RLS via Postgres `bypassrls` privilege.
 * ONLY use in specific backend contexts where there is NO browser user session
 * (e.g. the Telegram bot daemon).
 * NEVER expose this in browser components or standard user routes.
 */
export function createAdminClient() {
  const key = supabaseServiceKey || supabaseAnonKey
  return createSupabaseClient(supabaseUrl, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}
