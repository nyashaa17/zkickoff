import 'server-only';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Defense in depth: strictly enforce that this file cannot execute in browser environments
if (typeof window !== 'undefined') {
  throw new Error('FATAL SECURITY VIOLATION: SUPABASE_SERVICE_ROLE_KEY client loaded in browser bundle!');
}

let adminClientInstance: SupabaseClient | null = null;

/**
 * Creates or returns the singleton Supabase client authenticated with the service-role key.
 * Strictly server-only. Never expose SUPABASE_SERVICE_ROLE_KEY to browser bundles.
 */
export function createAdminClient(): SupabaseClient {
  if (!adminClientInstance) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error(
        'Missing Supabase service-role credentials: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in server environment.'
      );
    }

    adminClientInstance = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return adminClientInstance;
}
