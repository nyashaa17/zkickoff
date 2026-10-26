import { normalizeAndValidateStreamUrl, validateAndNormalizeYouTubeUrl, validateAndNormalizeHlsUrl } from '../lib/validation/stream-url';
import assert from 'node:assert/strict';

console.log('--- Running Stream URL Validation & Anti-SSRF Test Suite ---');

let passed = 0;
let failed = 0;

function test(description: string, fn: () => void) {
  try {
    fn();
    console.log(`✓ PASS: ${description}`);
    passed++;
  } catch (err: any) {
    console.error(`✗ FAIL: ${description}`);
    console.error(`  Error: ${err.message}`);
    failed++;
  }
}

// 1. YouTube Valid Formats
test('YouTube: 11-char video ID', () => {
  const result = normalizeAndValidateStreamUrl('dQw4w9WgXcQ', 'youtube');
  assert.equal(result, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
});

test('YouTube: standard watch URL', () => {
  const result = normalizeAndValidateStreamUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'youtube');
  assert.equal(result, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
});

test('YouTube: youtu.be short URL', () => {
  const result = normalizeAndValidateStreamUrl('https://youtu.be/dQw4w9WgXcQ', 'youtube');
  assert.equal(result, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
});

test('YouTube: live URL', () => {
  const result = normalizeAndValidateStreamUrl('https://youtube.com/live/dQw4w9WgXcQ?feature=share', 'youtube');
  assert.equal(result, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
});

test('YouTube: embed URL', () => {
  const result = normalizeAndValidateStreamUrl('https://www.youtube.com/embed/dQw4w9WgXcQ', 'youtube');
  assert.equal(result, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
});

test('YouTube: mobile URL (m.youtube.com)', () => {
  const result = normalizeAndValidateStreamUrl('https://m.youtube.com/watch?v=dQw4w9WgXcQ', 'youtube');
  assert.equal(result, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
});

// 2. YouTube Invalid Formats
test('YouTube: invalid video ID length', () => {
  assert.throws(() => normalizeAndValidateStreamUrl('dQw4w9WgX', 'youtube'));
});

test('YouTube: invalid characters in video ID', () => {
  assert.throws(() => normalizeAndValidateStreamUrl('dQw4w9WgX$#', 'youtube'));
});

test('YouTube: embedded credentials rejected', () => {
  assert.throws(() => normalizeAndValidateStreamUrl('https://admin:password@www.youtube.com/watch?v=dQw4w9WgXcQ', 'youtube'));
});

// 3. HLS Valid Public URLs
test('HLS: valid public HTTPS master manifest', () => {
  const url = 'https://stream.example.com/live/master.m3u8';
  const result = normalizeAndValidateStreamUrl(url, 'hls');
  assert.equal(result, url);
});

test('HLS: valid public CDN HTTPS manifest with query token', () => {
  const url = 'https://cdn.broadcaster.co.zw/events/derby/index.m3u8?token=abc123xyz';
  const result = normalizeAndValidateStreamUrl(url, 'hls');
  assert.equal(result, url);
});

// 4. HLS Protocol Security
test('HLS: HTTP protocol is strictly rejected', () => {
  assert.throws(() => normalizeAndValidateStreamUrl('http://cdn.broadcaster.co.zw/live.m3u8', 'hls'));
});

// 5. HLS SSRF Protection — Localhost & Named Hosts
test('HLS: localhost is rejected', () => {
  assert.throws(() => normalizeAndValidateStreamUrl('https://localhost/stream.m3u8', 'hls'));
});

test('HLS: localhost with trailing dot is rejected', () => {
  assert.throws(() => normalizeAndValidateStreamUrl('https://localhost./stream.m3u8', 'hls'));
});

test('HLS: subdomains of localhost rejected', () => {
  assert.throws(() => normalizeAndValidateStreamUrl('https://api.localhost/stream.m3u8', 'hls'));
});

test('HLS: cloud metadata hostname rejected', () => {
  assert.throws(() => normalizeAndValidateStreamUrl('https://metadata.google.internal/computeMetadata', 'hls'));
});

test('HLS: single-word internal hostname rejected', () => {
  assert.throws(() => normalizeAndValidateStreamUrl('https://internalserver/stream.m3u8', 'hls'));
});

// 6. HLS SSRF Protection — RFC 1918 & Loopback IPv4
test('HLS: 127.0.0.1 loopback rejected', () => {
  assert.throws(() => normalizeAndValidateStreamUrl('https://127.0.0.1/live.m3u8', 'hls'));
});

test('HLS: 10.0.0.1 Class A private rejected', () => {
  assert.throws(() => normalizeAndValidateStreamUrl('https://10.200.5.1/stream.m3u8', 'hls'));
});

test('HLS: 172.16.0.1 Class B private rejected', () => {
  assert.throws(() => normalizeAndValidateStreamUrl('https://172.16.50.1/stream.m3u8', 'hls'));
});

test('HLS: 192.168.1.1 Class C private rejected', () => {
  assert.throws(() => normalizeAndValidateStreamUrl('https://192.168.1.100/stream.m3u8', 'hls'));
});

test('HLS: 169.254.169.254 Link-Local / Cloud Metadata rejected', () => {
  assert.throws(() => normalizeAndValidateStreamUrl('https://169.254.169.254/latest/meta-data', 'hls'));
});

// 7. HLS SSRF Protection — Alternative IP encodings
test('HLS: integer decimal IP representation (2130706433 = 127.0.0.1) rejected', () => {
  assert.throws(() => normalizeAndValidateStreamUrl('https://2130706433/stream.m3u8', 'hls'));
});

test('HLS: hex IP representation (0x7f000001 = 127.0.0.1) rejected', () => {
  assert.throws(() => normalizeAndValidateStreamUrl('https://0x7f000001/stream.m3u8', 'hls'));
});

test('HLS: octal IP representation (0177.0.0.1 = 127.0.0.1) rejected', () => {
  assert.throws(() => normalizeAndValidateStreamUrl('https://0177.0.0.1/stream.m3u8', 'hls'));
});

test('HLS: 2-part dotted IP (127.1 = 127.0.0.1) rejected', () => {
  assert.throws(() => normalizeAndValidateStreamUrl('https://127.1/stream.m3u8', 'hls'));
});

// 8. HLS SSRF Protection — IPv6
test('HLS: IPv6 loopback [::1] rejected', () => {
  assert.throws(() => normalizeAndValidateStreamUrl('https://[::1]/stream.m3u8', 'hls'));
});

test('HLS: IPv6 link-local [fe80::1] rejected', () => {
  assert.throws(() => normalizeAndValidateStreamUrl('https://[fe80::1]/stream.m3u8', 'hls'));
});

test('HLS: IPv6 unique local [fd00::1] rejected', () => {
  assert.throws(() => normalizeAndValidateStreamUrl('https://[fd00::1]/stream.m3u8', 'hls'));
});

test('HLS: IPv4-mapped IPv6 [::ffff:127.0.0.1] rejected', () => {
  assert.throws(() => normalizeAndValidateStreamUrl('https://[::ffff:127.0.0.1]/stream.m3u8', 'hls'));
});

test('HLS: IPv4-mapped IPv6 [::ffff:169.254.169.254] rejected', () => {
  assert.throws(() => normalizeAndValidateStreamUrl('https://[::ffff:169.254.169.254]/meta', 'hls'));
});

// 9. Credentials & Malformed URLs
test('HLS: embedded credentials rejected', () => {
  assert.throws(() => normalizeAndValidateStreamUrl('https://user:pass@cdn.example.com/stream.m3u8', 'hls'));
});

test('HLS: malformed URL rejected', () => {
  assert.throws(() => normalizeAndValidateStreamUrl('not-a-url', 'hls'));
});

console.log(`\nResults: ${passed} passed, ${failed} failed.`);
if (failed > 0) {
  process.exit(1);
}
