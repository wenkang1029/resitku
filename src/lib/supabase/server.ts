import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * Server-side Supabase client.
 * Use this in Server Components, API Route Handlers, and Server Actions.
 * Uses the anon key — swap for the service_role key only in trusted
 * server-only code that needs to bypass RLS (not needed in v1).
 */
export function createServerClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      // Disable auto-refresh and session persistence on the server
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}
