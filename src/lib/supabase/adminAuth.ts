import { createServerClient } from './server'
import { User } from '@supabase/supabase-js'

export interface AdminAuthResult {
  isAdmin: boolean
  user: User | null
  error?: string
}

/**
 * Server-side authorization helper for admin routes and components.
 * Verifies that:
 * 1. User is authenticated via session cookies.
 * 2. User record in the `users` table has `is_admin === true`.
 */
export async function verifyAdminSession(): Promise<AdminAuthResult> {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { isAdmin: false, user: null, error: 'Unauthorized: User not authenticated' }
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email, is_admin')
      .eq('id', user.id)
      .single()

    if (userError || !userData) {
      return { isAdmin: false, user, error: 'Forbidden: User profile not found' }
    }

    if (!userData.is_admin) {
      return { isAdmin: false, user, error: 'Forbidden: Admin privileges required' }
    }

    return { isAdmin: true, user }
  } catch (err: any) {
    return { isAdmin: false, user: null, error: err.message || 'Authorization check failed' }
  }
}
