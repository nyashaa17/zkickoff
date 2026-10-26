import { redirect } from 'next/navigation';
import { createServerClient } from './server';
import { createAdminClient } from './admin';

export interface AdminSession {
  id: string;
  email: string;
  role: string;
}

/**
 * Server-side authorization guard for admin pages and draft previews.
 * Verifies the user session via Supabase Auth and validates that the user
 * exists in public.admin_users with role 'admin' or 'superadmin'.
 * Redirects unauthorized requests to /admin/login immediately.
 */
export async function requireAdminSession(): Promise<AdminSession> {
  let supabase;
  try {
    supabase = await createServerClient();
  } catch (err: any) {
    // If NEXT_PUBLIC_SUPABASE_URL is not set or cookies unavailable
    if (err?.digest?.startsWith('NEXT_REDIRECT')) throw err;
    redirect('/admin/login');
  }

  let user;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) {
      redirect('/admin/login');
    }
    user = data.user;
  } catch (err: any) {
    if (err?.digest?.startsWith('NEXT_REDIRECT')) throw err;
    redirect('/admin/login');
  }

  try {
    const adminClient = createAdminClient();
    const { data: adminRecord, error: adminError } = await adminClient
      .from('admin_users')
      .select('role, email')
      .eq('id', user.id)
      .single();

    if (adminError || !adminRecord || !['admin', 'superadmin'].includes(adminRecord.role)) {
      redirect('/admin/login?error=forbidden');
    }

    return {
      id: user.id,
      email: adminRecord.email || user.email || '',
      role: adminRecord.role,
    };
  } catch (err: any) {
    if (err?.digest?.startsWith('NEXT_REDIRECT')) throw err;
    redirect('/admin/login');
  }
}
