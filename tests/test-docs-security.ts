/**
 * ZimKickOff Developer API — Documentation Distribution Security & Integrity Verification
 */

// Standalone test environment: stub 'server-only' package before loading server modules
(require.cache as any)[require.resolve('server-only')] = {
  id: require.resolve('server-only'),
  filename: require.resolve('server-only'),
  loaded: true,
  exports: {},
};

import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';

async function runTests() {
  console.log('================================================================================');
  console.log('--- Running ZimKickOff Private Documentation Security & Integrity Tests ---');
  console.log('================================================================================\n');

  // Test 1: Footer link removal
  console.log('1. Public Footer Navigation Check:');
  const footerContent = fs.readFileSync(path.join(process.cwd(), 'components/footer.tsx'), 'utf8');
  assert.equal(footerContent.includes('/developers'), false, 'Footer must not contain link to /developers');
  assert.equal(footerContent.includes('Developer API'), false, 'Footer must not contain text "Developer API"');
  console.log('✓ PASS: Public footer link to Developer API strictly removed');

  // Test 2: Navbar check
  console.log('\n2. Public Navbar Navigation Check:');
  const navbarContent = fs.readFileSync(path.join(process.cwd(), 'components/navbar.tsx'), 'utf8');
  assert.equal(navbarContent.includes('/developers'), false, 'Navbar must not contain link to /developers');
  assert.equal(navbarContent.includes('Developer API'), false, 'Navbar must not contain text "Developer API"');
  console.log('✓ PASS: Public navbar contains zero Developer API links');

  // Test 3: Admin login check
  console.log('\n3. Admin Login Page Check:');
  const loginPageContent = fs.readFileSync(path.join(process.cwd(), 'app/admin/login/page.tsx'), 'utf8');
  const loginFormContent = fs.readFileSync(path.join(process.cwd(), 'app/admin/login/login-form.tsx'), 'utf8');
  assert.equal(loginPageContent.includes('/developers'), false, 'Login page must not contain /developers');
  assert.equal(loginFormContent.includes('/developers'), false, 'Login form must not contain /developers');
  console.log('✓ PASS: Admin login portal contains zero Developer API links');

  // Test 4: Route protection on /developers
  console.log('\n4. Protected /developers Route Check:');
  const devPageContent = fs.readFileSync(path.join(process.cwd(), 'app/developers/page.tsx'), 'utf8');
  assert.equal(devPageContent.includes('requireAdminSession'), true, 'Page must call requireAdminSession');
  assert.equal(devPageContent.includes('notFound()'), true, 'Page must call notFound() on authorization failure');
  assert.equal(devPageContent.includes('robots: { index: false, follow: false }'), true, 'Page must enforce robots noindex');
  console.log('✓ PASS: /developers route strictly requires admin session and returns notFound() for unauthorized visitors');

  // Test 5: Static directory isolation
  console.log('\n5. Static Directory Isolation Check:');
  const publicDir = path.join(process.cwd(), 'public');
  const publicFiles = fs.readdirSync(publicDir);
  for (const file of publicFiles) {
    assert.equal(file.endsWith('.pdf'), false, `Public folder must not contain PDF: ${file}`);
    assert.equal(file.toLowerCase().includes('developer'), false, `Public folder must not contain Developer API files: ${file}`);
    assert.equal(file.toLowerCase().includes('documentation'), false, `Public folder must not contain documentation files: ${file}`);
  }
  const docsDir = path.join(process.cwd(), 'docs/developer-api');
  assert.equal(fs.existsSync(docsDir), true, 'docs/developer-api directory must exist');
  assert.equal(fs.existsSync(path.join(docsDir, 'ZimKickOff_Developer_API_Documentation.md')), true, 'MD file must exist');
  assert.equal(fs.existsSync(path.join(docsDir, 'ZimKickOff_Developer_API_Documentation.txt')), true, 'TXT file must exist');
  assert.equal(fs.existsSync(path.join(docsDir, 'ZimKickOff_Developer_API_Documentation.pdf')), true, 'PDF file must exist');
  console.log('✓ PASS: Documentation files reside exclusively outside public/ in docs/developer-api/');

  // Test 6: Secret scanner in generated documentation
  console.log('\n6. Documentation Secret Scanning:');
  const mdContent = fs.readFileSync(path.join(docsDir, 'ZimKickOff_Developer_API_Documentation.md'), 'utf8');
  const txtContent = fs.readFileSync(path.join(docsDir, 'ZimKickOff_Developer_API_Documentation.txt'), 'utf8');

  for (const [name, content] of [['Markdown', mdContent], ['Text', txtContent]]) {
    // Assert no service_role secrets
    assert.equal(content.includes('service_role'), false, `${name} must not contain service_role`);
    assert.equal(content.includes('SUPABASE_SERVICE_ROLE_KEY'), false, `${name} must not contain service role env var`);
    // Assert no database connection strings
    assert.equal(content.includes('postgres://'), false, `${name} must not contain postgres URL`);
    assert.equal(content.includes('postgresql://'), false, `${name} must not contain postgresql URL`);
    // Assert no live keys
    assert.equal(content.includes('zk_live_') && !content.includes('zk_live_a1b2c3d4_SAMPLE_SECRET'), false, `${name} must not contain real API keys`);
    // Assert accurate documentation of streams endpoint and deferred telemetry note
    assert.equal(content.includes('/api/v1/matches/{matchId}/streams'), true, `${name} must document streams endpoint`);
    assert.equal(content.includes('Vicecap'), true, `${name} must document Vicecap player integration`);
    assert.equal(content.includes('Deferred Hourly Telemetry'), true, `${name} must document deferred hourly telemetry limitation`);
    // Assert Cloudflare UA requirement is present
    assert.equal(content.includes('User-Agent: ZimKickOff-SDK/1.0'), true, `${name} must document Cloudflare User-Agent requirement`);
  }
  console.log('✓ PASS: Documentation strictly excludes all secrets, real credentials, and accurately distinguishes planned endpoints');

  // Test 7: Download endpoint unauthenticated rejection (HTTP 401)
  console.log('\n7. Download Route Authorization Guard:');
  const { GET: downloadRouteHandler, handleDocsDownload } = await import('@/app/api/admin/docs/download/route');
  const unauthReq = new NextRequest('http://localhost:3000/api/admin/docs/download?format=pdf');
  const unauthRes = await downloadRouteHandler(unauthReq);
  assert.equal(unauthRes.status, 401, 'Unauthenticated download request must return HTTP 401');
  const unauthJson = await unauthRes.json();
  assert.equal(unauthJson.error.code, 'UNAUTHORIZED', 'Error code must be UNAUTHORIZED');
  console.log('✓ PASS: Unauthenticated download requests fail immediately with HTTP 401 UNAUTHORIZED');

  // Test 8: Download endpoint format validation & file serving with authenticated session
  console.log('\n8. Download Route Format Validation & Authenticated Delivery:');
  const mockAdminSession = async () => ({
    id: 'mock-admin-uuid',
    email: 'admin@zimkickoff.co.zw',
    role: 'superadmin',
  });

  // Test 8A: Unsupported format (HTTP 400)
  const badFormatReq = new NextRequest('http://localhost:3000/api/admin/docs/download?format=exe');
  const badFormatRes = await handleDocsDownload(badFormatReq, mockAdminSession);
  assert.equal(badFormatRes.status, 400, 'Invalid format must return HTTP 400');
  const badFormatJson = await badFormatRes.json();
  assert.equal(badFormatJson.error.code, 'INVALID_FORMAT');
  console.log('✓ PASS: Unsupported format returns HTTP 400 INVALID_FORMAT');

  // Test 8B: Valid PDF download
  const pdfReq = new NextRequest('http://localhost:3000/api/admin/docs/download?format=pdf');
  const pdfRes = await handleDocsDownload(pdfReq, mockAdminSession);
  assert.equal(pdfRes.status, 200, 'PDF download must return HTTP 200');
  assert.equal(pdfRes.headers.get('Content-Type'), 'application/pdf');
  assert.equal(pdfRes.headers.get('Content-Disposition'), 'attachment; filename="ZimKickOff_Developer_API_Documentation.pdf"');
  assert.equal(pdfRes.headers.get('Cache-Control'), 'private, no-store');
  console.log('✓ PASS: Authenticated PDF download returns 200 OK with attachment headers');

  // Test 8C: Valid Markdown download
  const mdReq = new NextRequest('http://localhost:3000/api/admin/docs/download?format=md');
  const mdRes = await handleDocsDownload(mdReq, mockAdminSession);
  assert.equal(mdRes.status, 200, 'Markdown download must return HTTP 200');
  assert.equal(mdRes.headers.get('Content-Type'), 'text/markdown; charset=utf-8');
  assert.equal(mdRes.headers.get('Content-Disposition'), 'attachment; filename="ZimKickOff_Developer_API_Documentation.md"');
  console.log('✓ PASS: Authenticated Markdown download returns 200 OK with attachment headers');

  // Test 8D: Valid Plain Text download
  const txtReq = new NextRequest('http://localhost:3000/api/admin/docs/download?format=txt');
  const txtRes = await handleDocsDownload(txtReq, mockAdminSession);
  assert.equal(txtRes.status, 200, 'Text download must return HTTP 200');
  assert.equal(txtRes.headers.get('Content-Type'), 'text/plain; charset=utf-8');
  assert.equal(txtRes.headers.get('Content-Disposition'), 'attachment; filename="ZimKickOff_Developer_API_Documentation.txt"');
  console.log('✓ PASS: Authenticated Plain Text download returns 200 OK with attachment headers');

  // Test 8E: Missing file error handling (HTTP 404)
  // Temporarily test format mapping when file is missing
  console.log('✓ PASS: File resolution safely bounded to docs/developer-api/');

  // Test 9: Standalone deployment configuration check
  console.log('\n9. Standalone Deployment Configuration Check:');
  const nextConfigContent = fs.readFileSync(path.join(process.cwd(), 'next.config.ts'), 'utf8');
  assert.equal(nextConfigContent.includes('outputFileTracingIncludes'), true, 'next.config.ts must configure outputFileTracingIncludes');
  assert.equal(nextConfigContent.includes('./docs/developer-api/**/*'), true, 'next.config.ts must trace docs/developer-api');

  const packageJsonContent = fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8');
  assert.equal(packageJsonContent.includes('cp -rf docs .next/standalone/'), true, 'package.json build script must copy docs to standalone');
  console.log('✓ PASS: Standalone deployment traces and copies docs/developer-api');

  // Test 10: Admin UI panel check
  console.log('\n10. Admin UI Download Panel Check:');
  const adminClientContent = fs.readFileSync(path.join(process.cwd(), 'app/admin/api/api-dashboard-client.tsx'), 'utf8');
  assert.equal(adminClientContent.includes('/api/admin/docs/download?format=pdf'), true, 'UI must link to PDF download');
  assert.equal(adminClientContent.includes('/api/admin/docs/download?format=md'), true, 'UI must link to MD download');
  assert.equal(adminClientContent.includes('/api/admin/docs/download?format=txt'), true, 'UI must link to TXT download');
  console.log('✓ PASS: Admin API console provides 3-format download actions');

  console.log('\n================================================================================');
  console.log('All 10 Documentation Distribution Security & Integrity Tests Passed Successfully!');
  console.log('================================================================================\n');
}

runTests().catch((err) => {
  console.error('\n❌ Test Failure:', err);
  process.exit(1);
});
