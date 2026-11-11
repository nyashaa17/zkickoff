import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { 
  Code2, 
  Key, 
  Zap, 
  ShieldCheck, 
  Clock, 
  Layers, 
  Database, 
  Terminal, 
  AlertCircle,
  ExternalLink
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Developer API Documentation | ZimKickOff',
  description: 'Official REST API documentation for ZimKickOff live scores, match schedules, and football fixtures.',
};

export default function DeveloperDocumentationPage() {
  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-12">
      {/* Hero Header */}
      <div className="space-y-4 border-b border-neutral-200 pb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-50 text-zim-green border border-green-200 rounded-full text-xs font-bold font-mono">
          <Code2 className="w-4 h-4" />
          DEVELOPER API v1
        </div>
        <h1 className="font-display font-extrabold text-3xl sm:text-4xl text-neutral-900 tracking-tight">
          ZimKickOff Developer API
        </h1>
        <p className="text-sm sm:text-base text-neutral-600 max-w-3xl leading-relaxed">
          High-performance, low-latency REST endpoints for live scores, match fixtures, and historical football results. Designed for developers, sports media platforms, and data integration services.
        </p>

        <div className="pt-2 flex flex-wrap items-center gap-3 text-xs text-neutral-500 font-mono">
          <span className="px-2.5 py-1 bg-neutral-100 rounded-md border border-neutral-200 font-bold text-neutral-800">
            Base URL: https://zimkickoff.co.zw/api/v1
          </span>
          <span className="px-2.5 py-1 bg-neutral-100 rounded-md border border-neutral-200">
            Format: JSON
          </span>
          <span className="px-2.5 py-1 bg-neutral-100 rounded-md border border-neutral-200">
            Auth: Bearer Token
          </span>
        </div>
      </div>

      {/* Table of Contents */}
      <div className="p-5 bg-neutral-50 border border-neutral-200 rounded-2xl space-y-3">
        <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Quick Navigation</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-bold text-zim-green">
          <a href="#authentication" className="hover:underline">1. Authentication</a>
          <a href="#rate-limits" className="hover:underline">2. Rate Limits</a>
          <a href="#caching" className="hover:underline">3. Caching & SWR</a>
          <a href="#endpoint-live" className="hover:underline">4. Live Matches</a>
          <a href="#endpoint-fixtures" className="hover:underline">5. Fixtures & Results</a>
          <a href="#pagination" className="hover:underline">6. Pagination</a>
          <a href="#errors" className="hover:underline">7. Error Handling</a>
          <a href="#security" className="hover:underline">8. Security Guidelines</a>
        </div>
      </div>

      {/* Section 1: Authentication */}
      <section id="authentication" className="space-y-4 scroll-mt-20">
        <div className="flex items-center gap-2">
          <Key className="w-5 h-5 text-zim-green" />
          <h2 className="text-xl font-extrabold text-neutral-900">1. Authentication</h2>
        </div>
        <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
          All requests to the Developer API require authentication using an authorized API key. Keys use the standardized format:
        </p>

        <div className="p-4 bg-neutral-900 text-green-400 rounded-xl font-mono text-xs overflow-x-auto">
          <code>zk_live_&lt;prefix&gt;_&lt;secret&gt;</code>
        </div>

        <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
          Pass your API key in the standard <code className="px-1.5 py-0.5 bg-neutral-100 rounded text-neutral-800 font-mono text-xs">Authorization</code> header:
        </p>

        <div className="p-4 bg-neutral-900 text-neutral-100 rounded-xl font-mono text-xs overflow-x-auto space-y-1">
          <div className="text-neutral-400"># Header format:</div>
          <div><span className="text-amber-400">Authorization:</span> Bearer zk_live_a8f9c2d1_xK9bQ2jL5vW7zP3mN8rT4yU1vC0xE9sA7dF4gH2jK1</div>
        </div>
      </section>

      {/* Section 2: Rate Limits */}
      <section id="rate-limits" className="space-y-4 scroll-mt-20">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-zim-green" />
          <h2 className="text-xl font-extrabold text-neutral-900">2. Rate Limits & Quotas</h2>
        </div>
        <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
          ZimKickOff enforces rate limits using a distributed PostgreSQL Quota Lease Model with independent minute and daily limits:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 bg-white border border-neutral-200 rounded-xl space-y-1">
            <div className="text-xs font-bold text-neutral-500 uppercase">Minute Limit</div>
            <div className="text-2xl font-extrabold text-neutral-900">60 requests / minute</div>
            <p className="text-[11px] text-neutral-500">Short-term burst protection, resets every 60 seconds.</p>
          </div>
          <div className="p-4 bg-white border border-neutral-200 rounded-xl space-y-1">
            <div className="text-xs font-bold text-neutral-500 uppercase">Daily Limit</div>
            <div className="text-2xl font-extrabold text-neutral-900">10,000 requests / day</div>
            <p className="text-[11px] text-neutral-500">24-hour global quota ceiling, resets at 00:00 UTC.</p>
          </div>
        </div>

        <p className="text-xs sm:text-sm text-neutral-600">
          Every HTTP response includes standard rate-limit headers:
        </p>

        <div className="p-4 bg-neutral-900 text-neutral-100 rounded-xl font-mono text-xs overflow-x-auto space-y-1">
          <div><span className="text-amber-400">X-RateLimit-Limit:</span> 60</div>
          <div><span className="text-amber-400">X-RateLimit-Remaining:</span> 58</div>
          <div><span className="text-amber-400">X-RateLimit-Reset:</span> 1762761660</div>
          <div><span className="text-neutral-400"># On HTTP 429:</span></div>
          <div><span className="text-amber-400">Retry-After:</span> 42</div>
        </div>
      </section>

      {/* Section 3: Caching & Upstream Protection */}
      <section id="caching" className="space-y-4 scroll-mt-20">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-zim-green" />
          <h2 className="text-xl font-extrabold text-neutral-900">3. Caching & SWR Architecture</h2>
        </div>
        <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
          Responses use in-process single-flight request coalescing and Stale-While-Revalidate (SWR) caching to guarantee fast delivery (&lt; 2ms cache hits) and protect upstream providers:
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border border-neutral-200 rounded-xl overflow-hidden">
            <thead className="bg-neutral-100 text-neutral-600 font-bold">
              <tr>
                <th className="p-3">Data Category</th>
                <th className="p-3">Fresh TTL</th>
                <th className="p-3">Stale Window</th>
                <th className="p-3">Behavior</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 bg-white">
              <tr>
                <td className="p-3 font-bold text-neutral-900">Live Matches</td>
                <td className="p-3 font-mono">15 seconds</td>
                <td className="p-3 font-mono">60 seconds</td>
                <td className="p-3 text-neutral-500">Real-time score updates with background revalidation</td>
              </tr>
              <tr>
                <td className="p-3 font-bold text-neutral-900">Today&apos;s Fixtures</td>
                <td className="p-3 font-mono">60 seconds</td>
                <td className="p-3 font-mono">300 seconds</td>
                <td className="p-3 text-neutral-500">Kickoff times, lineups, and day schedule</td>
              </tr>
              <tr>
                <td className="p-3 font-bold text-neutral-900">Future & Past Fixtures</td>
                <td className="p-3 font-mono">30 minutes</td>
                <td className="p-3 font-mono">120 minutes</td>
                <td className="p-3 text-neutral-500">Historical results and upcoming schedule fixtures</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="text-xs sm:text-sm text-neutral-600">
          The <code className="px-1.5 py-0.5 bg-neutral-100 rounded text-neutral-800 font-mono text-xs">X-Cache</code> header indicates cache status (<code className="font-mono">HIT</code>, <code className="font-mono">MISS</code>, or <code className="font-mono">STALE</code>). During upstream provider degradations, ZimKickOff continues serving valid stale data with an active <code className="font-mono">Retry-After</code> advisory.
        </p>
      </section>

      {/* Section 4: Live Matches Endpoint */}
      <section id="endpoint-live" className="space-y-4 scroll-mt-20">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-zim-green" />
          <h2 className="text-xl font-extrabold text-neutral-900">4. Live Matches Endpoint</h2>
        </div>
        <p className="text-xs sm:text-sm text-neutral-600">
          Returns all football matches currently in progress.
        </p>

        <div className="p-3 bg-neutral-100 border border-neutral-200 rounded-xl font-mono text-xs font-bold text-neutral-900 flex items-center justify-between">
          <span>GET /api/v1/matches/live</span>
          <span className="text-xs text-zim-green font-bold">Public Endpoint</span>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-bold text-neutral-700">Query Parameters:</div>
          <div className="text-xs text-neutral-600 font-mono bg-white border border-neutral-200 rounded-xl p-3 space-y-1">
            <div><span className="font-bold text-neutral-900">competition</span> (optional, string): Filter by league name or slug (e.g. <code className="text-zim-green">&quot;premier-league&quot;</code>).</div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-bold text-neutral-700">Example Request:</div>
          <div className="p-4 bg-neutral-900 text-neutral-100 rounded-xl font-mono text-xs overflow-x-auto">
            <code>curl -X GET &quot;https://zimkickoff.co.zw/api/v1/matches/live?competition=premier-league&quot; \<br />
            &nbsp;&nbsp;-H &quot;Authorization: Bearer YOUR_API_KEY&quot;</code>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-bold text-neutral-700">Example Response:</div>
          <div className="p-4 bg-neutral-900 text-green-400 rounded-xl font-mono text-xs overflow-x-auto">
            <pre>{JSON.stringify({
              success: true,
              data: [
                {
                  id: "1428591",
                  slug: "arsenal-vs-chelsea-1428591",
                  status: "LIVE",
                  minute: 67,
                  eps: "67'",
                  score: { home: 2, away: 1 },
                  teams: {
                    home: { name: "Arsenal", code: "ARS", logoUrl: "https://sports.bzzoiro.com/img/team/18", logoColor: "#EF4444" },
                    away: { name: "Chelsea", code: "CHE", logoUrl: "https://sports.bzzoiro.com/img/team/13", logoColor: "#1D4ED8" }
                  },
                  competition: { id: "1", name: "Premier League", region: "England", slug: "premier-league", logoUrl: "https://sports.bzzoiro.com/img/league/1" },
                  kickoffTime: "15:00",
                  date: "2026-11-10",
                  timestamp: "2026-11-10T15:00:00Z",
                  venue: "Emirates Stadium",
                  category: "INTERNATIONAL"
                }
              ],
              meta: {
                timestamp: "2026-11-10T15:45:00.000Z",
                cached: true
              }
            }, null, 2)}</pre>
          </div>
        </div>
      </section>

      {/* Section 5: Fixtures Endpoint */}
      <section id="endpoint-fixtures" className="space-y-4 scroll-mt-20">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-zim-green" />
          <h2 className="text-xl font-extrabold text-neutral-900">5. Fixtures & Match History Endpoint</h2>
        </div>
        <p className="text-xs sm:text-sm text-neutral-600">
          Query scheduled upcoming matches, today&apos;s games, or historical match results with pagination and filtering.
        </p>

        <div className="p-3 bg-neutral-100 border border-neutral-200 rounded-xl font-mono text-xs font-bold text-neutral-900 flex items-center justify-between">
          <span>GET /api/v1/matches/fixtures</span>
          <span className="text-xs text-zim-green font-bold">Public Endpoint</span>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-bold text-neutral-700">Supported Query Parameters:</div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border border-neutral-200 rounded-xl overflow-hidden bg-white">
              <thead className="bg-neutral-100 text-neutral-600 font-bold">
                <tr>
                  <th className="p-2.5">Parameter</th>
                  <th className="p-2.5">Type</th>
                  <th className="p-2.5">Default</th>
                  <th className="p-2.5">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                <tr>
                  <td className="p-2.5 font-mono font-bold text-neutral-900">date</td>
                  <td className="p-2.5 font-mono text-neutral-500">string</td>
                  <td className="p-2.5 font-mono">&quot;today&quot;</td>
                  <td className="p-2.5 text-neutral-600">&quot;today&quot;, &quot;tomorrow&quot;, &quot;yesterday&quot;, or &quot;YYYY-MM-DD&quot; (-3 to +7 days).</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-mono font-bold text-neutral-900">competition</td>
                  <td className="p-2.5 font-mono text-neutral-500">string</td>
                  <td className="p-2.5 font-mono">none</td>
                  <td className="p-2.5 text-neutral-600">Filter by league name, slug, or ID (e.g. &quot;champions-league&quot;).</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-mono font-bold text-neutral-900">status</td>
                  <td className="p-2.5 font-mono text-neutral-500">string</td>
                  <td className="p-2.5 font-mono">&quot;ALL&quot;</td>
                  <td className="p-2.5 text-neutral-600">&quot;UPCOMING&quot;, &quot;FINISHED&quot;, &quot;LIVE&quot;, or &quot;ALL&quot;.</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-mono font-bold text-neutral-900">page</td>
                  <td className="p-2.5 font-mono text-neutral-500">integer</td>
                  <td className="p-2.5 font-mono">1</td>
                  <td className="p-2.5 text-neutral-600">Page number (&gt;= 1).</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-mono font-bold text-neutral-900">limit</td>
                  <td className="p-2.5 font-mono text-neutral-500">integer</td>
                  <td className="p-2.5 font-mono">50</td>
                  <td className="p-2.5 text-neutral-600">Results per page (1 to 100).</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-bold text-neutral-700">Example Request:</div>
          <div className="p-4 bg-neutral-900 text-neutral-100 rounded-xl font-mono text-xs overflow-x-auto">
            <code>curl -X GET &quot;https://zimkickoff.co.zw/api/v1/matches/fixtures?date=tomorrow&amp;status=UPCOMING&amp;limit=20&quot; \<br />
            &nbsp;&nbsp;-H &quot;Authorization: Bearer YOUR_API_KEY&quot;</code>
          </div>
        </div>
      </section>

      {/* Section 6: Standard Error Responses */}
      <section id="errors" className="space-y-4 scroll-mt-20">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-zim-green" />
          <h2 className="text-xl font-extrabold text-neutral-900">6. Standard Error Responses</h2>
        </div>
        <p className="text-xs sm:text-sm text-neutral-600">
          All errors return consistent JSON envelopes with machine-readable error codes:
        </p>

        <div className="p-4 bg-neutral-900 text-red-400 rounded-xl font-mono text-xs overflow-x-auto">
          <pre>{JSON.stringify({
            success: false,
            error: {
              code: "RATE_LIMIT_EXCEEDED",
              message: "Rate limit of 60 requests per minute exceeded. Window resets in 38 seconds.",
              retryAfter: 38
            }
          }, null, 2)}</pre>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border border-neutral-200 rounded-xl overflow-hidden bg-white">
            <thead className="bg-neutral-100 text-neutral-600 font-bold">
              <tr>
                <th className="p-2.5">HTTP Status</th>
                <th className="p-2.5">Error Code</th>
                <th className="p-2.5">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              <tr>
                <td className="p-2.5 font-bold text-neutral-900">400 Bad Request</td>
                <td className="p-2.5 font-mono text-neutral-600">INVALID_QUERY_PARAMETER</td>
                <td className="p-2.5 text-neutral-600">Invalid date format, out-of-range date, or invalid page/limit parameter.</td>
              </tr>
              <tr>
                <td className="p-2.5 font-bold text-neutral-900">401 Unauthorized</td>
                <td className="p-2.5 font-mono text-neutral-600">MISSING_API_KEY</td>
                <td className="p-2.5 text-neutral-600">No API key was provided in Authorization or X-API-Key header.</td>
              </tr>
              <tr>
                <td className="p-2.5 font-bold text-neutral-900">401 Unauthorized</td>
                <td className="p-2.5 font-mono text-neutral-600">INVALID_API_KEY</td>
                <td className="p-2.5 text-neutral-600">The provided API key is unrecognized or cryptographic signature failed.</td>
              </tr>
              <tr>
                <td className="p-2.5 font-bold text-neutral-900">401 Unauthorized</td>
                <td className="p-2.5 font-mono text-neutral-600">REVOKED_API_KEY</td>
                <td className="p-2.5 text-neutral-600">The provided API key has been revoked by an administrator.</td>
              </tr>
              <tr>
                <td className="p-2.5 font-bold text-neutral-900">429 Too Many Requests</td>
                <td className="p-2.5 font-mono text-neutral-600">RATE_LIMIT_EXCEEDED</td>
                <td className="p-2.5 text-neutral-600">Per-minute or daily quota ceiling reached. See Retry-After header.</td>
              </tr>
              <tr>
                <td className="p-2.5 font-bold text-neutral-900">503 Service Unavailable</td>
                <td className="p-2.5 font-mono text-neutral-600">API_DISABLED</td>
                <td className="p-2.5 text-neutral-600">Developer API is disabled by configuration or maintenance.</td>
              </tr>
              <tr>
                <td className="p-2.5 font-bold text-neutral-900">503 Service Unavailable</td>
                <td className="p-2.5 font-mono text-neutral-600">RATE_LIMIT_UNAVAILABLE</td>
                <td className="p-2.5 text-neutral-600">Centralized database rate-limiter unreachable; failed closed safely.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Section 7: Security Guidelines */}
      <section id="security" className="space-y-4 scroll-mt-20">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-zim-green" />
          <h2 className="text-xl font-extrabold text-neutral-900">7. Security Recommendations</h2>
        </div>
        <div className="p-5 bg-amber-50 border border-amber-200 rounded-2xl text-xs sm:text-sm text-amber-900 space-y-2">
          <div className="font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            Protect Your API Secrets
          </div>
          <ul className="list-disc list-inside space-y-1.5 text-xs text-amber-800 leading-relaxed">
            <li><strong>Never commit keys:</strong> Store keys exclusively in server-side environment variables (<code className="font-mono">.env.local</code>).</li>
            <li><strong>Never embed keys in client-side code:</strong> Never expose keys in React/Vue/Angular frontend bundles, browser JavaScript, or public GitHub repositories.</li>
            <li><strong>Proxy client requests:</strong> If building a mobile app or frontend website, route requests through your own backend proxy server to protect your key.</li>
            <li><strong>Immediate rotation:</strong> If you suspect a key has been compromised, notify administrators immediately to revoke and reissue your key.</li>
          </ul>
        </div>
      </section>

      {/* Footer Navigation */}
      <div className="pt-8 border-t border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-500">
        <div>&copy; {new Date().getFullYear()} ZimKickOff. All rights reserved.</div>
        <div className="flex items-center gap-4 font-bold text-zim-green">
          <Link href="/" className="hover:underline">Home</Link>
          <Link href="/live" className="hover:underline">Live Scores</Link>
          <Link href="/fixtures" className="hover:underline">Fixtures</Link>
          <Link href="/admin/login" className="hover:underline">Admin Login</Link>
        </div>
      </div>
    </div>
  );
}
