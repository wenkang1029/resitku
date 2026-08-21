import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * Browser-side Supabase client.
 * Use this in Client Components ('use client').
 * Auth state is persisted in localStorage automatically.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
