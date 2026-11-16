# ZimKickOff Developer API — Technical Specification & Integration Guide
**Version:** 1.0.0 (Private Beta)  
**Classification:** Confidential — Manually Approved Developers Only  
**Canonical Base URL:** `https://zimkickoff.co.zw/api/v1`  
**Data Format:** JSON (`application/json`)  
**Character Encoding:** UTF-8  

---

## 1. Overview & Private Beta Architecture

The ZimKickOff Developer API delivers low-latency, high-throughput REST endpoints providing structured access to live football scores, active match clocks, and fixture schedules.

### 1.1 Private Beta Access Model
- **Manual Approval Required:** Access to the ZimKickOff Developer API is restricted to manually approved developers and partners.
- **No Self-Service Registration:** There is no public registration portal or automatic key generation. API keys are issued exclusively by ZimKickOff platform administrators.
- **Possession of Documentation:** Possessing this document does NOT grant API access. Every API request must supply a valid, active API key (`zk_live_...`) issued by an administrator.
- **Production Status:** The Developer API infrastructure is deployed and verified. Access is controlled via a master administrative kill switch (`api_settings.is_api_enabled`).

### 1.2 Endpoint Availability Matrix
| Endpoint Route | HTTP Method | Production Status | Rate Limit Bucket | Default Cache TTL |
| :--- | :---: | :---: | :---: | :---: |
| `/api/v1/matches/live` | `GET` | **Operational / Verified** *(Subject to Kill Switch)* | 60 req/min, 10k/day | 15s fresh, 60s stale |
| `/api/v1/matches/fixtures` | `GET` | **Operational / Verified** *(Subject to Kill Switch)* | 60 req/min, 10k/day | 60s fresh, 300s stale |
| `/api/v1/matches/{matchId}/streams` | `GET` | **Operational / Verified** *(Subject to Kill Switch; Deferred Hourly Telemetry)* | 60 req/min, 10k/day | 15s fresh, 60s stale |

---

## 2. Authentication & Authorization

All requests to the Developer API require cryptographic authentication using an authorized API key.

### 2.1 Key Structure
ZimKickOff API keys use the standardized prefix format:
```
zk_live_<8_hex_prefix>_<43_character_secret>
```
- **Key Prefix (8 hex characters):** Enables high-speed $O(1)$ database index lookups.
- **Cryptographic Secret (256-bit entropy):** Random base64url-encoded secret.
- **Storage:** Only the cryptographic SHA-256 hash of the complete key is stored in the database. Plaintext keys are never stored.

### 2.2 Supplying the Key
Developers can pass their API key using either of two standard HTTP headers:

#### Option A: Authorization Header (Recommended)
```http
Authorization: Bearer zk_live_a1b2c3d4_SAMPLE_SECRET_DO_NOT_USE_1234567890abcdef
```

#### Option B: X-API-Key Header
```http
X-API-Key: zk_live_a1b2c3d4_SAMPLE_SECRET_DO_NOT_USE_1234567890abcdef
```

> **IMPORTANT:** Replace the sample key above with the active key issued to you by the platform administrator. Never share or commit your actual API key.

---

## 3. Cloudflare Edge & User-Agent Requirement

The ZimKickOff platform domain (`https://zimkickoff.co.zw`) is fronted by Cloudflare Edge Security with automated Bot Fight Mode (BFM) enabled.

### 3.1 Mandatory Descriptive User-Agent
Cloudflare Bot Fight Mode automatically challenges or blocks default, unconfigured scraper signatures:
- Default `curl/8.x.x` $\to$ Blocked with Cloudflare JavaScript Challenge (HTTP 403)
- Default `python-requests/2.x.x` $\to$ Blocked with Cloudflare JavaScript Challenge (HTTP 403)
- Default `Go-http-client/1.1` $\to$ Blocked with Cloudflare JavaScript Challenge (HTTP 403)

To ensure your requests pass through the Cloudflare edge directly to the origin Next.js API, **your application must include a descriptive `User-Agent` header**:

```http
User-Agent: ZimKickOff-SDK/1.0
```
*Or a custom descriptive application identifier:*
```http
User-Agent: MyApp/1.0 (contact@developer.com)
```

### 3.2 Security Distinction
The `User-Agent` header is purely an edge CDN pass-through requirement. It is **not** an authentication or authorization mechanism. Origin API authorization strictly verifies the cryptographic SHA-256 API key hash in constant time (`crypto.timingSafeEqual`).

---

## 4. Rate Limits & Quotas

ZimKickOff enforces rate limits using a distributed PostgreSQL Quota Lease Model with independent per-minute and per-day ceilings:

### 4.1 Quota Limits
- **Per-Minute Limit:** **60 requests / minute** (resets on a sliding 60-second window).
- **Daily Quota:** **10,000 requests / day** (resets at 00:00:00 UTC).

### 4.2 Standard Rate-Limit Response Headers
Every Developer API response includes headers detailing your current quota status:

| Header Name | Type | Description |
| :--- | :---: | :--- |
| `X-RateLimit-Limit` | Integer | Maximum request ceiling configured for the active window. |
| `X-RateLimit-Remaining` | Integer | Number of requests remaining in the active window. |
| `X-RateLimit-Reset` | Integer | Unix epoch timestamp (seconds) when the current window resets. |
| `Retry-After` | Integer | Seconds to wait before retrying when throttled (`429`) or degraded (`503`). |

---

## 5. Caching & SWR Architecture

The Developer API uses an in-process **Stale-While-Revalidate (SWR)** caching layer with single-flight request coalescing:

| Endpoint Profile | Fresh TTL | Stale Window | Semantics |
| :--- | :---: | :---: | :--- |
| **Live Matches** | 15 seconds | 60 seconds | Real-time score updates with background revalidation |
| **Today's Fixtures** | 60 seconds | 300 seconds | Kickoff times, lineups, and day schedule |
| **Future & Past Fixtures** | 30 minutes | 120 minutes | Historical results and upcoming calendar |
| **Broadcast Streams** | 15 seconds | 60 seconds | Real-time player embed feeds for active matches and live standalone events |

### 5.1 X-Cache Header
The `X-Cache` response header indicates cache status:
- `HIT`: Served instantly from fresh in-memory cache.
- `MISS`: Fetched synchronously from upstream providers and populated into cache.
- `STALE`: Served from stale cache while a background worker refreshes data.

---

## 6. Active Endpoint Reference

### 6.1 Endpoint 1: Live Scores & Matches

Returns all football matches currently in progress.

- **Route:** `GET /api/v1/matches/live`
- **Authentication:** Required (`Authorization: Bearer <key>`)
- **Edge Header:** Required (`User-Agent: ZimKickOff-SDK/1.0`)

#### Query Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :---: | :---: | :---: | :--- |
| `competition` | String | No | None | Case-insensitive filter by league name, code, or slug (e.g. `premier-league`). |

#### Example Request (cURL)
```bash
curl -X GET "https://zimkickoff.co.zw/api/v1/matches/live?competition=premier-league" \
  -H "Authorization: Bearer zk_live_a1b2c3d4_SAMPLE_SECRET_DO_NOT_USE_1234567890abcdef" \
  -H "User-Agent: ZimKickOff-SDK/1.0"
```

#### Success Response (HTTP 200 OK)
```json
{
  "success": true,
  "data": [
    {
      "id": "1428591",
      "slug": "arsenal-vs-chelsea-1428591",
      "status": "LIVE",
      "minute": 67,
      "eps": "67'",
      "score": {
        "home": 2,
        "away": 1
      },
      "teams": {
        "home": {
          "name": "Arsenal",
          "code": "ARS",
          "logoUrl": "https://sports.bzzoiro.com/img/team/18",
          "logoColor": "#EF4444"
        },
        "away": {
          "name": "Chelsea",
          "code": "CHE",
          "logoUrl": "https://sports.bzzoiro.com/img/team/13",
          "logoColor": "#1D4ED8"
        }
      },
      "competition": {
        "id": "1",
        "name": "Premier League",
        "region": "England",
        "slug": "premier-league",
        "logoUrl": "https://sports.bzzoiro.com/img/league/1"
      },
      "kickoffTime": "15:00",
      "date": "2026-11-10",
      "timestamp": "2026-11-10T15:00:00Z",
      "venue": "Emirates Stadium",
      "category": "INTERNATIONAL",
      "hasStreams": true
    }
  ],
  "meta": {
    "timestamp": "2026-11-10T15:45:00.000Z",
    "cached": true
  }
}
```

---

### 6.2 Endpoint 2: Fixtures & Historical Results

Returns scheduled fixtures, today's games, or historical match results with pagination and filtering.

- **Route:** `GET /api/v1/matches/fixtures`
- **Authentication:** Required (`Authorization: Bearer <key>`)
- **Edge Header:** Required (`User-Agent: ZimKickOff-SDK/1.0`)

#### Query Parameters
| Parameter | Type | Required | Default | Validation & Description |
| :--- | :---: | :---: | :---: | :--- |
| `date` | String | No | Today | `YYYY-MM-DD`, `today`, `tomorrow`, or `yesterday`. Bounded to `[-3 past, +7 future]` days. |
| `competition` | String | No | None | Filter by competition name, slug, or ID. |
| `status` | String | No | `ALL` | Filter by match status: `LIVE`, `TODAY`, `UPCOMING`, `FINISHED`, or `ALL`. |
| `page` | Integer | No | `1` | Pagination page number ($\ge 1$). |
| `limit` | Integer | No | `50` | Number of results per page (min: 1, max: 100). |

#### Example Request (cURL)
```bash
curl -X GET "https://zimkickoff.co.zw/api/v1/matches/fixtures?date=tomorrow&status=UPCOMING&limit=2" \
  -H "Authorization: Bearer zk_live_a1b2c3d4_SAMPLE_SECRET_DO_NOT_USE_1234567890abcdef" \
  -H "User-Agent: ZimKickOff-SDK/1.0"
```

#### Success Response (HTTP 200 OK)
```json
{
  "success": true,
  "data": [
    {
      "id": "1428595",
      "slug": "liverpool-vs-manchester-city-1428595",
      "status": "UPCOMING",
      "minute": null,
      "eps": null,
      "score": null,
      "teams": {
        "home": {
          "name": "Liverpool",
          "code": "LIV",
          "logoUrl": "https://sports.bzzoiro.com/img/team/14",
          "logoColor": "#DC2626"
        },
        "away": {
          "name": "Manchester City",
          "code": "MCI",
          "logoUrl": "https://sports.bzzoiro.com/img/team/11",
          "logoColor": "#38BDF8"
        }
      },
      "competition": {
        "id": "1",
        "name": "Premier League",
        "region": "England",
        "slug": "premier-league",
        "logoUrl": "https://sports.bzzoiro.com/img/league/1"
      },
      "kickoffTime": "16:30",
      "date": "2026-11-13",
      "timestamp": "2026-11-13T16:30:00Z",
      "venue": "Anfield",
      "category": "INTERNATIONAL",
      "hasStreams": false
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 2,
    "total": 38,
    "hasMore": true
  },
  "meta": {
    "timestamp": "2026-11-12T07:30:00.000Z",
    "cached": true
  }
}
```

---

### 6.3 Endpoint 3: Match Broadcast Streams

Returns verified, direct playable HLS (`.m3u8`) manifest URLs for live football fixtures and standalone broadcast events. Developers can directly embed these URLs into their own video playback engines (e.g. Video.js, hls.js, JW Player, Shaka Player, AVPlayer, ExoPlayer) without requiring Vicecap player, ZimKickOff hosted players, or iframe embeds.

- **Route:** `GET /api/v1/matches/{matchId}/streams`
- **Authentication:** Required (`Authorization: Bearer <key>`)
- **Edge Header:** Required (`User-Agent: ZimKickOff-SDK/1.0`)
- **Production Status:** **Operational / Verified** *(Subject to Kill Switch)*
- **Telemetry Notice:** Real-time request authorization and distributed rate-limiting are active. Hourly usage aggregation and histogram binning are deferred until a future database migration (Deferred Hourly Telemetry).

#### Path Parameters
| Parameter | Type | Required | Description |
| :--- | :---: | :---: | :--- |
| `matchId` | String | Yes | Numeric fixture ID (e.g. `1738342`), match slug (`highlanders-vs-dynamos-1738342`), standalone event UUID (`a1b2c3d4-e5f6-7890-abcd-ef1234567890`), or event slug (`zifa-presidential-cup-final-2026`). |

#### Integration Sources & Resolution Rules
1. **Centralized VNRES Catalog Integration:**
   - Resolves match streams centrally via the TotalSportsLive catalog (`https://appp.totalsportslive.xyz/fixtures`).
   - Maps numeric match IDs and slugs to catalog fixtures using strict normalized token matching on Home and Away teams.
   - Returns genuine direct HLS streams (`provider: "VNRES"`, `type: "hls"`) including HD (`m3u8_hd`) and SD (`m3u8_sd`) quality variants where available.
   - **Provider Authorization Gate:** Automated scraping and redistribution require formal provider licensing. The integration includes an isolated, disabled-by-default environment gate (`ENABLE_VNRES_CATALOG`).
2. **TotalSportsLive Football Matches & Legacy Buttons:**
   - Accepts numeric match IDs and supported ZimKickOff match slugs (extracts numeric ID).
   - Queries upstream button feeds from verified production host `https://app.totalsportslive.xyz` with a strict 5-second timeout.
   - **Vicecap Embed Decoupling:** TotalSportsLive upstream button feeds often provide hosted web player references (`?stream=1&fixture=...`) intended for Vicecap iframe embedding. ZimKickOff strictly refuses to fabricate manifests or misrepresent player embeds as HLS URLs. If an upstream button contains a verified `.m3u8` link, it is parsed and returned; if upstream provides only hosted player references without direct HLS manifests, the API returns `hasStreams: false` and `streams: []`.
3. **Standalone ZimKickOff Events:**
   - Resolves event UUIDs and event slugs against the platform database.
   - Queries only published events (`publication_status = 'published'`).
   - Retrieves event sources in display order strictly when `broadcast_status = 'live'`.
   - **Direct HLS Delivery:** Validates and returns original playable HLS manifests in the `url` property.
   - **YouTube Exclusion:** YouTube sources are strictly excluded from direct HLS delivery ("Do not return YouTube sources as HLS").
   - Returns no streams (`hasStreams: false`, `streams: []`) for upcoming or concluded events.
4. **Unpublished Event Protection:**
   - If an identifier is recognized as a standalone event whose status is `draft` or `archived`, the API strictly returns HTTP 404 `MATCH_NOT_FOUND`. It never falls through to TotalSportsLive and never exposes unpublished metadata.
5. **Non-Live / No-Feed Matches:**
   - Valid scheduled or concluded matches with no active video feeds return HTTP 200 with `hasStreams: false` and `streams: []`.

#### Stream Delivery, CORS Openness & Token Expiration
- **Direct Playable HLS URLs:** Returned URLs are direct playable `.m3u8` manifest endpoints suitable for custom player applications.
- **Vicecap Player Decoupling:** Vicecap player embeds and hosted iframe URLs are completely decoupled from Developer API responses and are never returned as HLS streams.
- **CORS Openness:** The upstream stream origins (`pull.niur.live`, `pull.niues.live`, `pull06.scstream.net`) explicitly serve the `Access-Control-Allow-Origin: *` response header on both `.m3u8` playlist manifests and `.ts` transport stream segments. This permits direct in-browser playback across any domain without requiring video proxying.
- **Zero Video Bandwidth Proxy:** ZimKickOff delivers direct CDN manifest URLs to developers without proxying video chunks, preserving origin server bandwidth and minimizing latency.
- **Signed URL Expiration & Refresh Strategy:** Stream URLs contain time-bound security tokens (e.g. `txSecret`, `txTime`, `auth_key`) with validity periods ranging from 2 to 6 hours. ZimKickOff filters out expired URLs at the cache boundary. If an active client playback session encounters an HTTP 403 Forbidden due to token expiration, the client application should immediately call `GET /api/v1/matches/{matchId}/streams` to obtain fresh signed URLs.
- **Centralized Upstream Traffic Protection:** Upstream catalog and button endpoints are protected by in-process single-flight request coalescing (preventing cache stampedes), a shared cache (15s fresh, 60s stale) across all API consumers, a global request budget ceiling (120 req/min), and a 30-second failure cooldown.
- **Strict Host Allowlist & Anti-SSRF:** Manifest URLs are restricted to verified CDN hostnames (`pull.niur.live`, `pull.niues.live`, `pull06.scstream.net`, `*.zimkickoff.co.zw`, `*.broadcast.co.zw`). All URLs are validated against private IP ranges (RFC 1918), loopback, link-local, and cloud metadata (`169.254.169.254`). Unsafe sources are rejected.

#### Example Request (cURL)
```bash
curl -X GET "https://zimkickoff.co.zw/api/v1/matches/1738342/streams" \
  -H "Authorization: Bearer zk_live_a1b2c3d4_SAMPLE_SECRET_DO_NOT_USE_1234567890abcdef" \
  -H "User-Agent: ZimKickOff-SDK/1.0"
```

#### Success Response — Streams Available (HTTP 200 OK)
```json
{
  "success": true,
  "data": {
    "matchId": "1738342",
    "hasStreams": true,
    "streams": [
      {
        "id": "stream-1",
        "name": "HD Stream",
        "provider": "VNRES",
        "type": "hls",
        "url": "https://pull.niur.live/live/feed_hd.m3u8?txSecret=abc123secret&txTime=6af5d694"
      },
      {
        "id": "stream-2",
        "name": "SD Stream",
        "provider": "VNRES",
        "type": "hls",
        "url": "https://pull.niur.live/live/feed_sd.m3u8?txSecret=abc123secret&txTime=6af5d694"
      }
    ]
  },
  "meta": {
    "timestamp": "2026-11-12T08:00:00.000Z",
    "cached": false
  }
}
```

#### Success Response — No Streams Available (HTTP 200 OK)
```json
{
  "success": true,
  "data": {
    "matchId": "1738342",
    "hasStreams": false,
    "streams": []
  },
  "meta": {
    "timestamp": "2026-11-12T08:00:00.000Z",
    "cached": true
  }
}
```

---

## 7. Telemetry & Analytics Architecture

The ZimKickOff platform includes an asynchronous, non-blocking telemetry buffer and aggregation pipeline.

### 7.1 Distributed Metering & Quotas
- Every API key request is metered through the PostgreSQL Quota Lease Model (`api_rate_limits` and `api_rate_limit_leases`).
- Ceilings of 60 req/min and 10,000 req/day apply uniformly across all endpoints.

### 7.2 Hourly Histograms & Deferred Telemetry Limitation
- **Supported Endpoints:** Hourly aggregated usage and 18-bin latency histograms are computed for `/api/v1/matches/live` and `/api/v1/matches/fixtures` in `api_usage_hourly`.
- **Streams Telemetry Limitation:** The database check constraint `chk_api_usage_hourly` and stored procedure `ingest_analytics_batch` only accept live scores and fixtures endpoints. Streams API requests are fully metered for rate limiting, but hourly aggregation for `/api/v1/matches/{matchId}/streams` is deferred safely until a separately approved database migration updates the constraint and procedure. Streams telemetry events are decoupled and will never cause request failures.

---

## 8. Error Codes & HTTP Status Matrix

The API uses standard HTTP response codes and returns structured JSON error envelopes:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE_IDENTIFIER",
    "message": "Human-readable description of the error.",
    "retryAfter": 30
  }
}
```

### Complete Error Code Catalog

| HTTP Status | Error Code | Description / Recovery Action |
| :---: | :--- | :--- |
| **400** | `INVALID_MATCH_ID` | Match ID failed regex validation (must be alphanumeric, slug, or UUID). |
| **400** | `INVALID_DATE_FORMAT` | Date string could not be parsed. Use `YYYY-MM-DD` or recognized alias (`today`, `tomorrow`). |
| **400** | `DATE_OUT_OF_RANGE` | Date parameter exceeds allowed query window `[-3 days past, +7 days future]`. |
| **400** | `INVALID_PAGINATION` | `page` or `limit` is malformed or outside acceptable bounds (limit max: 100). |
| **401** | `MISSING_API_KEY` | Neither `Authorization: Bearer` nor `X-API-Key` header was provided. |
| **401** | `MALFORMED_API_KEY` | Provided key does not adhere to standard syntax `zk_live_<prefix>_<secret>`. |
| **401** | `INVALID_API_KEY` | Key unrecognized or cryptographic SHA-256 signature mismatch. |
| **401** | `REVOKED_API_KEY` | The provided key was revoked by an administrator. Contact platform owner. |
| **404** | `MATCH_NOT_FOUND` | Requested fixture does not correspond to an active or scheduled fixture. |
| **429** | `RATE_LIMIT_EXCEEDED` | Request ceiling reached (60/min or 10,000/day). Respect `Retry-After` header. |
| **503** | `API_DISABLED` | Master kill switch is active (`is_api_enabled = false`). Service temporarily paused. |
| **503** | `RATE_LIMIT_UNAVAILABLE` | Database quota broker unreachable. System safely fails closed. |
| **503** | `UPSTREAM_UNAVAILABLE` | Upstream data or streams provider unreachable and no stale cache available. Respect `Retry-After` header. |

---

## 9. SDK & Integration Code Examples

### 9.1 JavaScript / TypeScript (Node.js Fetch)

```ts
import fetch from 'node-fetch'; // If on Node < 18

interface LiveMatchesResponse {
  success: boolean;
  data: Array<{
    id: string;
    slug: string;
    status: 'LIVE' | 'TODAY' | 'UPCOMING' | 'FINISHED';
    minute?: number;
    score?: { home: number; away: number } | null;
    teams: {
      home: { name: string; code: string; logoUrl?: string };
      away: { name: string; code: string; logoUrl?: string };
    };
    competition: { name: string; slug?: string };
  }>;
}

async function fetchLiveScores(apiKey: string): Promise<void> {
  const url = 'https://zimkickoff.co.zw/api/v1/matches/live';

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'User-Agent': 'ZimKickOff-SDK/1.0',
      'Accept': 'application/json',
    },
  });

  if (!res.ok) {
    const errorBody = await res.json();
    console.error(`API Error [${res.status}]:`, errorBody);
    return;
  }

  const result = (await res.json()) as LiveMatchesResponse;
  console.log(`Retrieved ${result.data.length} live matches:`);
  
  for (const match of result.data) {
    const score = match.score ? `${match.score.home} - ${match.score.away}` : '0 - 0';
    console.log(`[${match.minute}'] ${match.teams.home.name} ${score} ${match.teams.away.name}`);
  }
}

// Usage:
// fetchLiveScores(process.env.ZIMKICKOFF_API_KEY!);
```

---

### 9.2 Python (3.x Requests)

```python
import os
import requests

API_KEY = os.getenv("ZIMKICKOFF_API_KEY", "zk_live_your_actual_key_here")
BASE_URL = "https://zimkickoff.co.zw/api/v1"

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "User-Agent": "ZimKickOff-SDK/1.0",
    "Accept": "application/json",
}

def get_fixtures(date="today", status="ALL", limit=10):
    params = {
        "date": date,
        "status": status,
        "limit": limit
    }
    
    response = requests.get(f"{BASE_URL}/matches/fixtures", headers=headers, params=params)
    
    if response.status_code == 200:
        data = response.json()
        print(f"Total fixtures: {data['pagination']['total']}")
        for f in data["data"]:
            home = f["teams"]["home"]["name"]
            away = f["teams"]["away"]["name"]
            print(f"- {home} vs {away} [{f['status']}] at {f['kickoffTime']}")
    elif response.status_code == 429:
        retry_after = response.headers.get("Retry-After", 30)
        print(f"Rate limited! Retry after {retry_after} seconds.")
    else:
        print(f"Request failed ({response.status_code}):", response.text)

if __name__ == "__main__":
    get_fixtures()
```

---

### 9.3 cURL

```bash
# Fetch live matches
curl -X GET "https://zimkickoff.co.zw/api/v1/matches/live" \
  -H "Authorization: Bearer YOUR_ACTUAL_API_KEY" \
  -H "User-Agent: ZimKickOff-SDK/1.0" \
  -H "Accept: application/json"

# Fetch tomorrow's fixtures with pagination
curl -X GET "https://zimkickoff.co.zw/api/v1/matches/fixtures?date=tomorrow&limit=25" \
  -H "Authorization: Bearer YOUR_ACTUAL_API_KEY" \
  -H "User-Agent: ZimKickOff-SDK/1.0" \
  -H "Accept: application/json"

# Fetch match broadcast streams
curl -X GET "https://zimkickoff.co.zw/api/v1/matches/1738342/streams" \
  -H "Authorization: Bearer YOUR_ACTUAL_API_KEY" \
  -H "User-Agent: ZimKickOff-SDK/1.0" \
  -H "Accept: application/json"
```

---

### 9.4 Independent Video Player Integration Examples

Direct HLS (`.m3u8`) URLs retrieved from `/api/v1/matches/{matchId}/streams` can be integrated directly into any modern video playback engine. Stream origins return permissive CORS headers (`Access-Control-Allow-Origin: *`), eliminating the need for client-side CORS proxies.

#### 1. Web: hls.js (Vanilla JavaScript)

```html
<video id="video" controls autoplay muted style="width: 100%; max-width: 800px;"></video>
<script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
<script>
  const video = document.getElementById('video');
  const hlsUrl = 'https://pull.niur.live/live/feed.m3u8?txSecret=abc123secret&txTime=6af5d694';

  if (Hls.isSupported()) {
    const hls = new Hls({
      enableWorker: true,
      lowLatencyMode: true,
    });
    hls.loadSource(hlsUrl);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      video.play().catch(err => console.log('Autoplay deferred:', err));
    });
    hls.on(Hls.Events.ERROR, (event, data) => {
      if (data.fatal && data.response && data.response.code === 403) {
        console.warn('Stream token expired. Refreshing manifest from ZimKickOff API...');
        // Call your backend service to re-query GET /api/v1/matches/{matchId}/streams
      }
    });
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    // Native HLS support for Safari and iOS WebKit
    video.src = hlsUrl;
  }
</script>
```

#### 2. Web: Video.js

```html
<link href="https://vjs.zencdn.net/8.10.0/video-js.css" rel="stylesheet" />
<video id="zk-player" class="video-js vjs-default-skin" controls preload="auto" width="640" height="360">
  <source src="https://pull.niur.live/live/feed.m3u8?txSecret=abc123secret&txTime=6af5d694" type="application/x-mpegURL" />
</video>
<script src="https://vjs.zencdn.net/8.10.0/video.min.js"></script>
<script>
  const player = videojs('zk-player', {
    autoplay: 'muted',
    responsive: true,
    html5: {
      vhs: {
        overrideNative: !videojs.browser.IS_ANY_SAFARI,
      },
    },
  });
</script>
```

#### 3. Web: JW Player

```html
<div id="player"></div>
<script src="https://content.jwplatform.com/libraries/YOUR_KEY.js"></script>
<script>
  jwplayer("player").setup({
    file: "https://pull.niur.live/live/feed.m3u8?txSecret=abc123secret&txTime=6af5d694",
    width: "100%",
    aspectratio: "16:9",
    autostart: true,
    mute: true,
  });
</script>
```

#### 4. Web: Shaka Player

```html
<video id="video" width="640" height="360" controls autoplay muted></video>
<script src="https://ajax.googleapis.com/ajax/libs/shaka-player/4.3.5/shaka-player.compiled.js"></script>
<script>
  async function initPlayer() {
    shaka.polyfill.installAll();
    if (shaka.Player.isBrowserSupported()) {
      const video = document.getElementById('video');
      const player = new shaka.Player(video);
      try {
        await player.load('https://pull.niur.live/live/feed.m3u8?txSecret=abc123secret&txTime=6af5d694');
        console.log('Stream loaded successfully in Shaka Player');
      } catch (e) {
        console.error('Shaka Player error:', e);
      }
    }
  }
  document.addEventListener('DOMContentLoaded', initPlayer);
</script>
```

#### 5. iOS: AVPlayer (Swift)

```swift
import UIKit
import AVKit

class MatchPlayerViewController: UIViewController {
    var playerViewController: AVPlayerViewController!
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        let manifestUrlString = "https://pull.niur.live/live/feed.m3u8?txSecret=abc123secret&txTime=6af5d694"
        guard let url = URL(string: manifestUrlString) else { return }
        
        let player = AVPlayer(url: url)
        playerViewController = AVPlayerViewController()
        playerViewController.player = player
        
        addChild(playerViewController)
        view.addSubview(playerViewController.view)
        playerViewController.view.frame = view.bounds
        playerViewController.didMove(toParent: self)
        
        player.play()
    }
}
```

#### 6. Android: ExoPlayer / Media3 (Kotlin)

```kotlin
package com.example.sportsapp

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView

class StreamPlayerActivity : AppCompatActivity() {
    private var player: ExoPlayer? = null
    private lateinit var playerView: PlayerView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_player)
        playerView = findViewById(R.id.player_view)

        initializePlayer("https://pull.niur.live/live/feed.m3u8?txSecret=abc123secret&txTime=6af5d694")
    }

    private fun initializePlayer(streamUrl: String) {
        player = ExoPlayer.Builder(this).build().also { exoPlayer ->
            playerView.player = exoPlayer
            val mediaItem = MediaItem.Builder()
                .setUri(streamUrl)
                .setMimeType(MimeTypes.APPLICATION_M3U8)
                .build()
            exoPlayer.setMediaItem(mediaItem)
            exoPlayer.prepare()
            exoPlayer.playWhenReady = true
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        player?.release()
        player = null
    }
}
```

---

## 10. Security Recommendations & Best Practices

1. **Never Commit API Keys:**
   Store your API key in environment variables (e.g. `.env.local` or secret management vaults). Never hardcode keys in client-side repositories.
2. **Backend Proxying Only:**
   Never embed your `zk_live_...` key in frontend browser code, React/Vue applications, mobile app bundles, or public websites. Always route client requests through your own secure backend proxy.
3. **Respect Rate Limits & Headers:**
   Always inspect `X-RateLimit-Remaining` and `Retry-After`. Implement exponential backoff when handling HTTP `429 Too Many Requests`.
4. **Follow Cache Headers:**
   Respect `Cache-Control` directives. Polling live scores faster than once every 15 seconds will only return cached data and burn your per-minute quota.
5. **Key Rotation & Revocation:**
   If your API key is compromised, contact ZimKickOff administrators immediately to revoke the key and issue a replacement.
