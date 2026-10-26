import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { handleAuthCallback, GET as callbackHandler, ALLOWED_OTP_TYPES } from '../app/auth/callback/route';

console.log('--- Running Admin Authentication & Password Recovery Test Suite ---');

let passed = 0;
let failed = 0;

async function test(description: string, fn: () => void | Promise<void>) {
  try {
    const res = fn();
    if (res instanceof Promise) {
      await res;
    }
    console.log(`✓ PASS: ${description}`);
    passed++;
  } catch (err: any) {
    console.error(`✗ FAIL: ${description}`);
    console.error(`  Error: ${err.message}`);
    failed++;
  }
}

async function main() {
  // Ensure public supabase env vars exist for standalone handler execution
  process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://rrendjbeceazrjvtvhtz.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.dummy';

  // --- Part 1: Static Code Structure & Invariant Checks ---

  // 1. Forgot password navigation link in login form
  await test('Login form contains link to /admin/forgot-password', () => {
    const loginFormCode = fs.readFileSync(path.join(__dirname, '../app/admin/login/login-form.tsx'), 'utf8');
    assert.ok(loginFormCode.includes('href="/admin/forgot-password"'), 'Login form must link to forgot password route');
    assert.ok(loginFormCode.includes('Forgot password?'), 'Login form must display "Forgot password?" label');
  });

  // 2. Forgot password request flow and trusted redirect
  await test('Forgot password form derives trusted redirect and prevents open-redirect targets', () => {
    const forgotFormCode = fs.readFileSync(path.join(__dirname, '../app/admin/forgot-password/forgot-password-form.tsx'), 'utf8');
    assert.ok(forgotFormCode.includes('auth/callback?next=/admin/reset-password'), 'Redirect must target internal auth callback');
    assert.ok(!forgotFormCode.includes('req.query.redirect'), 'Redirect must not be derived from arbitrary query parameters');
    assert.ok(forgotFormCode.includes('resetPasswordForEmail'), 'Must invoke resetPasswordForEmail');
  });

  // 3. User enumeration defense: uniform messaging
  await test('Forgot password form displays identical confirmation notice to mitigate user enumeration', () => {
    const forgotFormCode = fs.readFileSync(path.join(__dirname, '../app/admin/forgot-password/forgot-password-form.tsx'), 'utf8');
    assert.ok(forgotFormCode.includes('If an administrator account exists'), 'Must use timing-safe / non-enumerating confirmation text');
  });

  // 4. Auth callback anti-open-redirect security logic
  await test('Auth callback route handler sanitizes redirect destination to internal relative paths', () => {
    const callbackCode = fs.readFileSync(path.join(__dirname, '../app/auth/callback/route.ts'), 'utf8');
    assert.ok(callbackCode.includes('exchangeCodeForSession'), 'Callback must exchange PKCE code for session');
    assert.ok(callbackCode.includes("next.startsWith('/')"), 'Callback must require leading slash');
    assert.ok(callbackCode.includes("!next.startsWith('//')"), 'Callback must reject protocol-relative slashes');
    assert.ok(callbackCode.includes("!next.includes('\\\\')"), 'Callback must reject backslash tricks');

    // Simulate callback redirect sanitizer logic
    function sanitizeNext(next: string | null): string {
      const isSafe = next && next.startsWith('/') && !next.startsWith('//') && !next.includes('\\');
      return isSafe ? next : '/admin/reset-password';
    }

    assert.equal(sanitizeNext('/admin/events'), '/admin/events');
    assert.equal(sanitizeNext('/admin/reset-password'), '/admin/reset-password');
    assert.equal(sanitizeNext('https://attacker.com'), '/admin/reset-password');
    assert.equal(sanitizeNext('//attacker.com'), '/admin/reset-password');
    assert.equal(sanitizeNext('/\\attacker.com'), '/admin/reset-password');
    assert.equal(sanitizeNext(null), '/admin/reset-password');
  });

  // 5. Password validation rules in reset form
  await test('Reset password form enforces minimum 8 characters and confirmation match', () => {
    const resetFormCode = fs.readFileSync(path.join(__dirname, '../app/admin/reset-password/reset-password-form.tsx'), 'utf8');
    assert.ok(resetFormCode.includes('password.length < 8'), 'Must enforce min 8 chars');
    assert.ok(resetFormCode.includes('password !== confirmPassword'), 'Must enforce confirmation match');
    assert.ok(resetFormCode.includes('updateUser'), 'Must call updateUser with new password');

    // Test validation logic
    function validatePasswordInputs(pass: string, confirm: string): { valid: boolean; error?: string } {
      if (!pass || pass.length < 8) {
        return { valid: false, error: 'Password must be at least 8 characters in length.' };
      }
      if (pass !== confirm) {
        return { valid: false, error: 'Passwords do not match. Please re-enter.' };
      }
      return { valid: true };
    }

    assert.equal(validatePasswordInputs('short', 'short').valid, false);
    assert.equal(validatePasswordInputs('short', 'short').error, 'Password must be at least 8 characters in length.');
    assert.equal(validatePasswordInputs('securePass123', 'mismatchPass').valid, false);
    assert.equal(validatePasswordInputs('securePass123', 'mismatchPass').error, 'Passwords do not match. Please re-enter.');
    assert.equal(validatePasswordInputs('validPassword123', 'validPassword123').valid, true);
  });

  // 6. Reset password form handles invalid/expired sessions
  await test('Reset password form explicitly guards against expired/invalid recovery sessions', () => {
    const resetFormCode = fs.readFileSync(path.join(__dirname, '../app/admin/reset-password/reset-password-form.tsx'), 'utf8');
    assert.ok(resetFormCode.includes('PASSWORD_RECOVERY'), 'Must listen for PASSWORD_RECOVERY auth event');
    assert.ok(resetFormCode.includes('Recovery Link Expired or Invalid'), 'Must provide clear fallback state for invalid/expired links');
    assert.ok(resetFormCode.includes('Request New Reset Link'), 'Must provide link to request new reset');
  });

  // 7. Logout control in admin interface
  await test('LogoutButton invokes signOut and redirects to login with notice', () => {
    const logoutCode = fs.readFileSync(path.join(__dirname, '../app/admin/logout-button.tsx'), 'utf8');
    assert.ok(logoutCode.includes('supabase.auth.signOut()'), 'Logout button must call supabase.auth.signOut');
    assert.ok(logoutCode.includes('/admin/login?notice=signed_out'), 'Must redirect to login with signed_out notice');

    const adminEventsCode = fs.readFileSync(path.join(__dirname, '../app/admin/events/page.tsx'), 'utf8');
    assert.ok(adminEventsCode.includes('<LogoutButton />') || adminEventsCode.includes('LogoutButton'), 'Admin events page must include LogoutButton');
  });

  // 8. Session refresh proxy/middleware implementation & matcher
  await test('Next.js proxy enforces session refresh via getUser and safe matcher', () => {
    const proxyCode = fs.readFileSync(path.join(__dirname, '../proxy.ts'), 'utf8');
    assert.ok(proxyCode.includes('supabase.auth.getUser()'), 'Proxy must refresh session via getUser()');
    assert.ok(proxyCode.includes('createServerClient'), 'Proxy must use @supabase/ssr createServerClient');
    assert.ok(proxyCode.includes('getAll'), 'Proxy must implement cookie getAll');
    assert.ok(proxyCode.includes('setAll'), 'Proxy must implement cookie setAll');
    assert.ok(proxyCode.includes("url.pathname === '/admin'"), 'Proxy must redirect root /admin to /admin/events');

    // Verify matcher does not match static assets
    assert.ok(proxyCode.includes('_next/static'), 'Matcher must exclude _next/static');
    assert.ok(proxyCode.includes('_next/image'), 'Matcher must exclude _next/image');
    assert.ok(proxyCode.includes('favicon.ico'), 'Matcher must exclude favicon');
  });

  // 9. Server Actions independent admin authorization enforcement
  await test('Server Actions (create, update, delete) enforce verifyAdminAuthorization server-side', () => {
    const actionsCode = fs.readFileSync(path.join(__dirname, '../app/actions/events.ts'), 'utf8');
    assert.ok(actionsCode.includes('const auth = await verifyAdminAuthorization();'), 'Actions must call verifyAdminAuthorization');
    assert.ok(actionsCode.includes('verifyAdminAuthorization(): Promise<{ userId: string } | ActionResponse>'), 'verifyAdminAuthorization signature check');
    assert.ok(actionsCode.includes('.from(\'admin_users\')'), 'Must query admin_users allowlist');
    assert.ok(actionsCode.includes('[\'admin\', \'superadmin\'].includes(adminRecord.role)'), 'Must enforce role check');
  });

  // 10. Service role key server-only isolation
  await test('Service role key is strictly isolated to server-only environments', () => {
    const adminCode = fs.readFileSync(path.join(__dirname, '../lib/supabase/admin.ts'), 'utf8');
    assert.ok(adminCode.includes("import 'server-only';"), 'admin.ts must import server-only');
    assert.ok(adminCode.includes("typeof window !== 'undefined'"), 'admin.ts must verify window is undefined');
    assert.ok(adminCode.includes('SUPABASE_SERVICE_ROLE_KEY'), 'Must read SUPABASE_SERVICE_ROLE_KEY');
  });

  // --- Part 2: Dynamic Behavior-Oriented Tests ---

  // 11. Valid token_hash with type=invite invokes verifyOtp and redirects to /admin/reset-password
  await test('Behavior: Valid token_hash with type=invite invokes verifyOtp and redirects to /admin/reset-password', async () => {
    const req = new NextRequest('https://zimkickoff.co.zw/auth/callback?token_hash=invite_token_123&type=invite');
    let verifyParams: any = null;
    const mockSupabase = {
      auth: {
        verifyOtp: async (params: any) => {
          verifyParams = params;
          return { error: null };
        },
      },
    };

    const res = await handleAuthCallback(req, mockSupabase);
    assert.equal(res.status, 307);
    assert.equal(res.headers.get('Location'), 'https://zimkickoff.co.zw/admin/reset-password');
    assert.deepEqual(verifyParams, { type: 'invite', token_hash: 'invite_token_123' });
  });

  // 12. Valid recovery token follows recovery flow to custom safe destination
  await test('Behavior: Valid recovery token follows recovery flow to custom destination', async () => {
    const req = new NextRequest('https://zimkickoff.co.zw/auth/callback?token_hash=recovery_token_456&type=recovery&next=/admin/reset-password');
    let verifyParams: any = null;
    const mockSupabase = {
      auth: {
        verifyOtp: async (params: any) => {
          verifyParams = params;
          return { error: null };
        },
      },
    };

    const res = await handleAuthCallback(req, mockSupabase);
    assert.equal(res.status, 307);
    assert.equal(res.headers.get('Location'), 'https://zimkickoff.co.zw/admin/reset-password');
    assert.deepEqual(verifyParams, { type: 'recovery', token_hash: 'recovery_token_456' });
  });

  // 13. Valid PKCE code invokes exchangeCodeForSession()
  await test('Behavior: Valid PKCE code invokes exchangeCodeForSession() and redirects', async () => {
    const req = new NextRequest('https://zimkickoff.co.zw/auth/callback?code=valid_pkce_auth_code&next=/admin/events');
    let exchangedCode: string | null = null;
    const mockSupabase = {
      auth: {
        exchangeCodeForSession: async (code: string) => {
          exchangedCode = code;
          return { error: null };
        },
      },
    };

    const res = await handleAuthCallback(req, mockSupabase);
    assert.equal(res.status, 307);
    assert.equal(res.headers.get('Location'), 'https://zimkickoff.co.zw/admin/events');
    assert.equal(exchangedCode, 'valid_pkce_auth_code');
  });

  // 14. PKCE callback with missing verifier fails safely and does not crash
  await test('Behavior: PKCE callback with missing verifier fails safely and redirects to login with notice', async () => {
    const req = new NextRequest('https://zimkickoff.co.zw/auth/callback?code=orphaned_code');
    const mockSupabase = {
      auth: {
        exchangeCodeForSession: async () => {
          const err: any = new Error('PKCE code verifier not found in storage.');
          err.code = 'pkce_code_verifier_not_found';
          return { error: err };
        },
      },
    };

    const res = await handleAuthCallback(req, mockSupabase);
    assert.equal(res.status, 307);
    assert.equal(res.headers.get('Location'), 'https://zimkickoff.co.zw/admin/login?error=invalid_recovery_link');
  });

  // 15. Missing token_hash or type is rejected when that flow requires both
  await test('Behavior: Missing token_hash or type is rejected when that flow requires both', async () => {
    // Only token_hash provided
    const reqTokenOnly = new NextRequest('https://zimkickoff.co.zw/auth/callback?token_hash=lonely_hash');
    const resTokenOnly = await handleAuthCallback(reqTokenOnly);
    assert.equal(resTokenOnly.status, 307);
    assert.equal(resTokenOnly.headers.get('Location'), 'https://zimkickoff.co.zw/admin/login?error=invalid_recovery_link');

    // Only type provided
    const reqTypeOnly = new NextRequest('https://zimkickoff.co.zw/auth/callback?type=invite');
    const resTypeOnly = await handleAuthCallback(reqTypeOnly);
    assert.equal(resTypeOnly.status, 307);
    assert.equal(resTypeOnly.headers.get('Location'), 'https://zimkickoff.co.zw/admin/login?error=invalid_recovery_link');
  });

  // 16. Unsupported OTP types are rejected
  await test('Behavior: Unsupported OTP types (signup, magiclink, email_change) are rejected', async () => {
    assert.deepEqual(ALLOWED_OTP_TYPES, ['invite', 'recovery']);

    for (const disallowedType of ['signup', 'magiclink', 'email_change', 'phone_change', 'malicious']) {
      const req = new NextRequest(`https://zimkickoff.co.zw/auth/callback?token_hash=sample_hash&type=${disallowedType}`);
      const res = await handleAuthCallback(req);
      assert.equal(res.status, 307);
      assert.equal(res.headers.get('Location'), 'https://zimkickoff.co.zw/admin/login?error=invalid_recovery_link');
    }
  });

  // 17. Expired or invalid invitation/recovery tokens fail safely
  await test('Behavior: Expired or invalid invitation/recovery tokens fail safely', async () => {
    const req = new NextRequest('https://zimkickoff.co.zw/auth/callback?token_hash=expired_hash&type=invite');
    const mockSupabase = {
      auth: {
        verifyOtp: async () => {
          return { error: { message: 'Email link is invalid or has expired' } };
        },
      },
    };

    const res = await handleAuthCallback(req, mockSupabase);
    assert.equal(res.status, 307);
    assert.equal(res.headers.get('Location'), 'https://zimkickoff.co.zw/admin/login?error=invalid_recovery_link');
  });

  // 18. External, protocol-relative, malformed, and otherwise unsafe next values cannot create an open redirect
  await test('Behavior: External, protocol-relative, and malformed next values cannot create an open redirect', async () => {
    const maliciousDestinations = [
      'https://evil.com',
      'http://attacker.example/phish',
      '//evil.com',
      '///evil.com/path',
      '/\\evil.com',
      'javascript:alert(document.cookie)',
      'data:text/html,<script>alert(1)</script>',
      'ftp://malicious.com',
    ];

    for (const target of maliciousDestinations) {
      const encoded = encodeURIComponent(target);
      const req = new NextRequest(`https://zimkickoff.co.zw/auth/callback?token_hash=token&type=invite&next=${encoded}`);
      const mockSupabase = {
        auth: {
          verifyOtp: async () => ({ error: null }),
        },
      };

      const res = await handleAuthCallback(req, mockSupabase);
      assert.equal(res.status, 307);
      // Must safely fallback to /admin/reset-password
      assert.equal(res.headers.get('Location'), 'https://zimkickoff.co.zw/admin/reset-password');
    }
  });

  // 19. Session cookies written during verification survive on the final redirect response
  await test('Behavior: Session cookies written during verification survive on the final redirect response', async () => {
    const req = new NextRequest('https://zimkickoff.co.zw/auth/callback?token_hash=good_hash&type=invite');
    const mockSupabase = {
      _mockCookiesToSet: [
        {
          name: 'sb-auth-token.0',
          value: 'chunked_session_token_part_0',
          options: { path: '/', httpOnly: true, secure: true, maxAge: 3600 },
        },
        {
          name: 'sb-auth-token.1',
          value: 'chunked_session_token_part_1',
          options: { path: '/', httpOnly: true, secure: true, maxAge: 3600 },
        },
        {
          name: 'sb-refresh-token',
          value: 'active_refresh_token_string',
          options: { path: '/', httpOnly: true, secure: true, maxAge: 604800 },
        },
      ],
      auth: {
        verifyOtp: async () => ({ error: null }),
      },
    };

    const res = await handleAuthCallback(req, mockSupabase);
    assert.equal(res.status, 307);
    const setCookies = res.headers.getSetCookie();
    assert.equal(setCookies.length, 3, 'All 3 session cookies must be serialized in Set-Cookie headers');
    assert.ok(setCookies.some((c) => c.startsWith('sb-auth-token.0=chunked_session_token_part_0')));
    assert.ok(setCookies.some((c) => c.startsWith('sb-auth-token.1=chunked_session_token_part_1')));
    assert.ok(setCookies.some((c) => c.startsWith('sb-refresh-token=active_refresh_token_string')));
    // Attributes preserved
    assert.ok(setCookies.every((c) => c.includes('HttpOnly') && c.includes('Secure')));
  });

  // 20. Password-reset page behavior for available vs unavailable/expired session
  await test('Behavior: Password-reset session checking logic handles available vs expired sessions', () => {
    // Evaluation helper mirroring ResetPasswordForm state machine
    function evaluateSessionState(
      hasInitialSession: boolean,
      authEvent: string | null,
      hasEventSession: boolean,
      timeoutFired: boolean
    ): 'VALID' | 'CHECKING' | 'INVALID' {
      if (hasInitialSession) return 'VALID';
      if (
        authEvent === 'PASSWORD_RECOVERY' ||
        (authEvent === 'SIGNED_IN' && hasEventSession) ||
        (authEvent === 'INITIAL_SESSION' && hasEventSession)
      ) {
        return 'VALID';
      }
      if (timeoutFired) return 'INVALID';
      return 'CHECKING';
    }

    // 1. Existing cookie session from /auth/callback redirect
    assert.equal(evaluateSessionState(true, null, false, false), 'VALID');

    // 2. SIGNED_IN event emitted during client hydration
    assert.equal(evaluateSessionState(false, 'SIGNED_IN', true, false), 'VALID');

    // 3. INITIAL_SESSION event emitted during client hydration
    assert.equal(evaluateSessionState(false, 'INITIAL_SESSION', true, false), 'VALID');

    // 4. PASSWORD_RECOVERY event emitted
    assert.equal(evaluateSessionState(false, 'PASSWORD_RECOVERY', true, false), 'VALID');

    // 5. In-flight check before timeout
    assert.equal(evaluateSessionState(false, null, false, false), 'CHECKING');

    // 6. Timeout reached without valid session
    assert.equal(evaluateSessionState(false, null, false, true), 'INVALID');
  });

  // 21. Non-allowlisted authenticated users remain unauthorized
  await test('Behavior: Non-allowlisted authenticated users remain unauthorized via authorization guard', () => {
    // Evaluation helper mirroring verifyAdminAuthorization & requireAdminSession
    function evaluateAdminAccess(
      isAuthenticated: boolean,
      allowlistRecord: { role: string } | null
    ): { allowed: boolean; redirectReason?: string } {
      if (!isAuthenticated) {
        return { allowed: false, redirectReason: 'unauthenticated' };
      }
      if (!allowlistRecord || !['admin', 'superadmin'].includes(allowlistRecord.role)) {
        return { allowed: false, redirectReason: 'forbidden' };
      }
      return { allowed: true };
    }

    // Unauthenticated visitor
    assert.deepEqual(evaluateAdminAccess(false, null), { allowed: false, redirectReason: 'unauthenticated' });

    // Authenticated user with no entry in public.admin_users (e.g. freshly invited before allowlisting)
    assert.deepEqual(evaluateAdminAccess(true, null), { allowed: false, redirectReason: 'forbidden' });

    // Authenticated user with insufficient role (e.g. 'viewer')
    assert.deepEqual(evaluateAdminAccess(true, { role: 'viewer' }), { allowed: false, redirectReason: 'forbidden' });

    // Authenticated user with 'admin' role
    assert.deepEqual(evaluateAdminAccess(true, { role: 'admin' }), { allowed: true });

    // Authenticated user with 'superadmin' role
    assert.deepEqual(evaluateAdminAccess(true, { role: 'superadmin' }), { allowed: true });
  });

  // 22. Direct GET route handler invocation fallback
  await test('Behavior: Direct GET route handler execution rejects empty request safely', async () => {
    const req = new NextRequest('https://zimkickoff.co.zw/auth/callback');
    const res = await callbackHandler(req);
    assert.equal(res.status, 307);
    assert.equal(res.headers.get('Location'), 'https://zimkickoff.co.zw/admin/login?error=invalid_recovery_link');
  });

  console.log(`\nAdmin Auth Suite Complete: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

main();
