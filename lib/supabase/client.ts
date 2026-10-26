import { createBrowserClient } from '@supabase/ssr';

/**
 * Creates a browser-side Supabase client using public URL and Anon Key.
 * Manages user authentication cookies automatically in the browser.
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase public configuration: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required.');
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
