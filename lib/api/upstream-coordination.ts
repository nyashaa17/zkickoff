import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

export interface BudgetReservationResult {
  allowed: boolean;
  reason: 'OK' | 'COOLDOWN' | 'BUDGET_EXCEEDED' | 'DATABASE_ERROR';
  retryAfter: number;
  currentCount: number;
}

export interface UpstreamStatus {
  inCooldown: boolean;
  cooldownRemainingSeconds: number;
  requestsInWindow: number;
  budgetCeiling: number;
  degraded?: boolean;
}

export interface L2CacheRecord<T = any> {
  payload: T;
  cachedAt: number;
  freshUntil: number;
  staleUntil: number;
  minTokenExpiryMs?: number | null;
  isFresh: boolean;
  isStale: boolean;
}

export interface LockAcquisitionResult {
  acquired: boolean;
  fencingToken?: number;
  error?: boolean;
}

export class CoordinationTimeoutError extends Error {
  statusCode: number;
  retryAfter: number;
  code: string;
  isUpstreamOutage: boolean;
  isCoordinationError: boolean;

  constructor(
    message = 'Another worker is currently fetching upstream; request timed out waiting for coordination',
    retryAfter = 2
  ) {
    super(message);
    this.name = 'CoordinationTimeoutError';
    this.statusCode = 503;
    this.retryAfter = retryAfter;
    this.code = 'ANOTHER_WORKER_FETCHING';
    this.isUpstreamOutage = false;
    this.isCoordinationError = true;
  }
}

export interface IUpstreamCoordinationStore {
  acquireBudgetLease(
    provider: string,
    maxRequests?: number,
    windowSeconds?: number
  ): Promise<BudgetReservationResult>;

  setCooldown(
    provider: string,
    cooldownSeconds?: number,
    reason?: string
  ): Promise<{ cooldownUntilMs: number }>;

  recordSuccess(provider: string): Promise<void>;

  getStatus(
    provider: string,
    maxRequests?: number,
    windowSeconds?: number
  ): Promise<UpstreamStatus>;

  acquireLock(
    lockKey: string,
    ownerId: string,
    ttlSeconds?: number
  ): Promise<LockAcquisitionResult>;

  releaseLock(lockKey: string, ownerId: string, fencingToken: number): Promise<boolean>;

  getL2Cache<T = any>(cacheKey: string): Promise<L2CacheRecord<T> | null>;

  setL2Cache<T = any>(
    cacheKey: string,
    payload: T,
    freshSeconds: number,
    staleSeconds: number,
    matchId: string | undefined,
    fixtureKey: string | undefined,
    minTokenExpiryMs: number | null | undefined,
    fencingToken: number,
    lockKey: string,
    ownerId: string
  ): Promise<boolean>;

  clearL2Cache(cacheKey?: string): Promise<void>;

  resetAll(provider?: string): Promise<void>;

  cleanupExpired(): Promise<{
    deletedReservations: number;
    deletedLocks: number;
    deletedCacheEntries: number;
  }>;
}

/**
 * In-Memory coordination store.
 * Fully reproduces the PostgreSQL stored procedures' atomic rolling-window,
 * cooldown, distributed lease, and L2 cache logic within Node.js memory.
 * Used for isolated testing, single-worker mock runs, or graceful fallback.
 */
export class InMemoryCoordinationStore implements IUpstreamCoordinationStore {
  private reservations = new Map<string, number[]>();
  private cooldowns = new Map<string, { until: number; reason?: string; failures: number }>();
  private locks = new Map<string, { ownerId: string; expiresAt: number; fencingToken: number }>();
  private l2Cache = new Map<string, {
    payload: any;
    cachedAt: number;
    freshUntil: number;
    staleUntil: number;
    minTokenExpiryMs?: number | null;
    matchId?: string;
    fixtureKey?: string;
    fencingToken: number;
  }>();
  private nextFencingToken = 1;

  async acquireBudgetLease(
    provider: string,
    maxRequests = 120,
    windowSeconds = 60
  ): Promise<BudgetReservationResult> {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;

    // 1. Check failure cooldown
    const cd = this.cooldowns.get(provider);
    if (cd && now < cd.until) {
      const retryAfter = Math.ceil((cd.until - now) / 1000);
      return {
        allowed: false,
        reason: 'COOLDOWN',
        retryAfter: Math.max(1, retryAfter),
        currentCount: 0,
      };
    }

    // 2. Count active reservations in rolling window
    const list = this.reservations.get(provider) || [];
    const cutoff = now - windowMs;
    const active = list.filter((t) => t > cutoff);

    // 3. Check budget ceiling
    if (active.length >= maxRequests) {
      const oldest = active[0];
      const retryAfter = Math.ceil((oldest + windowMs - now) / 1000);
      this.reservations.set(provider, active);
      return {
        allowed: false,
        reason: 'BUDGET_EXCEEDED',
        retryAfter: Math.max(1, retryAfter),
        currentCount: active.length,
      };
    }

    // 4. Reserve slot
    active.push(now);
    this.reservations.set(provider, active);

    return {
      allowed: true,
      reason: 'OK',
      retryAfter: 0,
      currentCount: active.length,
    };
  }

  async setCooldown(
    provider: string,
    cooldownSeconds = 30,
    reason?: string
  ): Promise<{ cooldownUntilMs: number }> {
    const now = Date.now();
    const newUntil = now + cooldownSeconds * 1000;
    const existing = this.cooldowns.get(provider);

    // Concurrency guarantee: never roll back a newer failure state
    const until = existing ? Math.max(existing.until, newUntil) : newUntil;
    const failures = (existing?.failures || 0) + 1;

    this.cooldowns.set(provider, { until, reason, failures });
    return { cooldownUntilMs: until };
  }

  async recordSuccess(provider: string): Promise<void> {
    const existing = this.cooldowns.get(provider);
    if (existing && Date.now() >= existing.until) {
      existing.failures = 0;
    }
  }

  async getStatus(
    provider: string,
    maxRequests = 120,
    windowSeconds = 60
  ): Promise<UpstreamStatus> {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;

    const cd = this.cooldowns.get(provider);
    const inCooldown = !!(cd && now < cd.until);
    const cooldownRemainingSeconds = inCooldown ? Math.ceil((cd.until - now) / 1000) : 0;

    const list = this.reservations.get(provider) || [];
    const cutoff = now - windowMs;
    const active = list.filter((t) => t > cutoff);
    this.reservations.set(provider, active);

    return {
      inCooldown,
      cooldownRemainingSeconds,
      requestsInWindow: active.length,
      budgetCeiling: maxRequests,
      degraded: false,
    };
  }

  async acquireLock(
    lockKey: string,
    ownerId: string,
    ttlSeconds = 10
  ): Promise<LockAcquisitionResult> {
    const now = Date.now();
    const existing = this.locks.get(lockKey);

    if (existing && existing.expiresAt > now && existing.ownerId !== ownerId) {
      return { acquired: false, fencingToken: 0 }; // Active lock held by another owner
    }

    const fencingToken = this.nextFencingToken++;
    this.locks.set(lockKey, {
      ownerId,
      expiresAt: now + ttlSeconds * 1000,
      fencingToken,
    });
    return { acquired: true, fencingToken };
  }

  async releaseLock(lockKey: string, ownerId: string, fencingToken: number): Promise<boolean> {
    if (!fencingToken || fencingToken <= 0) return false;
    const existing = this.locks.get(lockKey);
    if (existing && existing.ownerId === ownerId && existing.fencingToken === fencingToken) {
      this.locks.delete(lockKey);
      return true;
    }
    return false;
  }

  async getL2Cache<T = any>(cacheKey: string): Promise<L2CacheRecord<T> | null> {
    const now = Date.now();
    const entry = this.l2Cache.get(cacheKey);
    if (!entry) return null;

    if (now > entry.staleUntil) {
      this.l2Cache.delete(cacheKey);
      return null;
    }

    return {
      payload: entry.payload,
      cachedAt: entry.cachedAt,
      freshUntil: entry.freshUntil,
      staleUntil: entry.staleUntil,
      minTokenExpiryMs: entry.minTokenExpiryMs,
      isFresh: now <= entry.freshUntil,
      isStale: now <= entry.staleUntil,
    };
  }

  async setL2Cache<T = any>(
    cacheKey: string,
    payload: T,
    freshSeconds: number,
    staleSeconds: number,
    matchId: string | undefined,
    fixtureKey: string | undefined,
    minTokenExpiryMs: number | null | undefined,
    fencingToken: number,
    lockKey: string,
    ownerId: string
  ): Promise<boolean> {
    const now = Date.now();

    // Strict distributed lease ownership validation (Phase 2.27 / Phase 2.29 / AUDIT-28-01)
    if (!lockKey || !ownerId || !fencingToken || fencingToken <= 0) {
      return false;
    }
    const existingLock = this.locks.get(lockKey);
    if (!existingLock) {
      return false; // Missing lock row (Property 1 & 6)
    }
    if (existingLock.fencingToken !== fencingToken) {
      return false; // Superseded token (Property 3 & 7)
    }
    if (existingLock.ownerId !== ownerId) {
      return false; // Mismatched owner (Property 4)
    }
    if (existingLock.expiresAt <= now) {
      return false; // Expired lease (Property 5)
    }

    const existing = this.l2Cache.get(cacheKey);

    // Concurrency protection: Atomically reject writes from obsolete fencing tokens (F-22-02 / Property 9)
    if (existing && existing.fencingToken > fencingToken) {
      return false; // Stale leader rejected
    }

    this.l2Cache.set(cacheKey, {
      payload,
      cachedAt: now,
      freshUntil: now + freshSeconds * 1000,
      staleUntil: now + (freshSeconds + staleSeconds) * 1000,
      minTokenExpiryMs,
      matchId,
      fixtureKey,
      fencingToken: Math.max(fencingToken, existing?.fencingToken ?? 0),
    });
    return true;
  }

  async clearL2Cache(cacheKey?: string): Promise<void> {
    if (cacheKey) {
      this.l2Cache.delete(cacheKey);
    } else {
      this.l2Cache.clear();
    }
  }

  async resetAll(provider?: string): Promise<void> {
    if (provider) {
      this.reservations.delete(provider);
      this.cooldowns.delete(provider);
    } else {
      this.reservations.clear();
      this.cooldowns.clear();
    }
    this.locks.clear();
    this.l2Cache.clear();
  }

  async cleanupExpired(): Promise<{
    deletedReservations: number;
    deletedLocks: number;
    deletedCacheEntries: number;
  }> {
    const now = Date.now();
    let deletedReservations = 0;
    let deletedLocks = 0;
    let deletedCacheEntries = 0;

    // 1. Prune reservations older than 1 hour (retains rolling window with extensive safety margin)
    const oneHourAgo = now - 3600 * 1000;
    for (const [provider, list] of this.reservations.entries()) {
      const active = list.filter((t) => t >= oneHourAgo);
      deletedReservations += list.length - active.length;
      this.reservations.set(provider, active);
    }

    // 2. Prune expired distributed locks
    for (const [key, lock] of this.locks.entries()) {
      if (lock.expiresAt < now) {
        this.locks.delete(key);
        deletedLocks++;
      }
    }

    // 3. Prune catalog cache entries older than their stale window
    for (const [key, entry] of this.l2Cache.entries()) {
      if (entry.staleUntil < now) {
        this.l2Cache.delete(key);
        deletedCacheEntries++;
      }
    }

    return { deletedReservations, deletedLocks, deletedCacheEntries };
  }
}

/**
 * PostgreSQL-Backed coordination store.
 * Calls atomic stored procedures via Supabase createAdminClient().
 * Operates across all PM2 workers and multi-server instances.
 */
export class PostgreSqlCoordinationStore implements IUpstreamCoordinationStore {
  async acquireBudgetLease(
    provider: string,
    maxRequests = 120,
    windowSeconds = 60
  ): Promise<BudgetReservationResult> {
    try {
      const adminClient = createAdminClient();
      const { data, error } = await adminClient.rpc('acquire_upstream_budget_lease', {
        p_provider: provider,
        p_max_requests: maxRequests,
        p_window_seconds: windowSeconds,
      });

      if (error) {
        console.error('[UpstreamCoordination] RPC acquire_upstream_budget_lease error:', error.message);
        return {
          allowed: false,
          reason: 'DATABASE_ERROR',
          retryAfter: 30,
          currentCount: 0,
        };
      }

      const row = Array.isArray(data) ? data[0] : data;
      if (!row) {
        return {
          allowed: false,
          reason: 'DATABASE_ERROR',
          retryAfter: 30,
          currentCount: 0,
        };
      }

      return {
        allowed: Boolean(row.allowed),
        reason: (row.reason as any) || 'OK',
        retryAfter: Number(row.retry_after) || 0,
        currentCount: Number(row.current_count) || 0,
      };
    } catch (err: any) {
      console.error('[UpstreamCoordination] Fatal exception in acquireBudgetLease:', err?.message);
      return {
        allowed: false,
        reason: 'DATABASE_ERROR',
        retryAfter: 30,
        currentCount: 0,
      };
    }
  }

  async setCooldown(
    provider: string,
    cooldownSeconds = 30,
    reason?: string
  ): Promise<{ cooldownUntilMs: number }> {
    try {
      const adminClient = createAdminClient();
      const { data, error } = await adminClient.rpc('set_upstream_cooldown', {
        p_provider: provider,
        p_cooldown_seconds: cooldownSeconds,
        p_failure_reason: reason || null,
      });

      if (error) {
        console.warn('[UpstreamCoordination] set_upstream_cooldown RPC error:', error.message);
        return { cooldownUntilMs: Date.now() + cooldownSeconds * 1000 };
      }

      const cdDate = data ? new Date(data).getTime() : Date.now() + cooldownSeconds * 1000;
      return { cooldownUntilMs: cdDate };
    } catch (err: any) {
      console.warn('[UpstreamCoordination] Exception setting cooldown:', err?.message);
      return { cooldownUntilMs: Date.now() + cooldownSeconds * 1000 };
    }
  }

  async recordSuccess(provider: string): Promise<void> {
    try {
      const adminClient = createAdminClient();
      await adminClient.rpc('record_upstream_success', {
        p_provider: provider,
      });
    } catch (err: any) {
      console.warn('[UpstreamCoordination] record_upstream_success failed silently:', err?.message);
    }
  }

  async getStatus(
    provider: string,
    maxRequests = 120,
    windowSeconds = 60
  ): Promise<UpstreamStatus> {
    try {
      const adminClient = createAdminClient();
      const { data: statusRow } = await adminClient
        .from('api_upstream_status')
        .select('cooldown_until')
        .eq('provider', provider)
        .maybeSingle();

      const now = Date.now();
      let inCooldown = false;
      let cooldownRemainingSeconds = 0;

      if (statusRow?.cooldown_until) {
        const cdMs = new Date(statusRow.cooldown_until).getTime();
        if (cdMs > now) {
          inCooldown = true;
          cooldownRemainingSeconds = Math.ceil((cdMs - now) / 1000);
        }
      }

      const windowStart = new Date(now - windowSeconds * 1000).toISOString();
      const { count } = await adminClient
        .from('api_upstream_budget_reservations')
        .select('*', { count: 'exact', head: true })
        .eq('provider', provider)
        .gt('reserved_at', windowStart);

      return {
        inCooldown,
        cooldownRemainingSeconds,
        requestsInWindow: count || 0,
        budgetCeiling: maxRequests,
        degraded: false,
      };
    } catch {
      return {
        inCooldown: false,
        cooldownRemainingSeconds: 0,
        requestsInWindow: 0,
        budgetCeiling: maxRequests,
        degraded: true,
      };
    }
  }

  async acquireLock(
    lockKey: string,
    ownerId: string,
    ttlSeconds = 10
  ): Promise<LockAcquisitionResult> {
    try {
      const adminClient = createAdminClient();
      const { data, error } = await adminClient.rpc('acquire_distributed_lock', {
        p_lock_key: lockKey,
        p_owner_id: ownerId,
        p_ttl_seconds: ttlSeconds,
      });

      if (error) {
        console.warn('[UpstreamCoordination] acquire_distributed_lock RPC error:', error.message);
        markPostgreSqlRuntimeDegraded(
          `PostgreSQL distributed lock RPC failed for "${lockKey}": ${error.message}`
        );
        return { acquired: false, fencingToken: 0, error: true };
      }

      const row = Array.isArray(data) ? data[0] : data;
      if (!row) {
        markPostgreSqlRuntimeDegraded(
          `PostgreSQL distributed lock RPC returned empty row for "${lockKey}"`
        );
        return { acquired: false, fencingToken: 0, error: true };
      }

      return {
        acquired: Boolean(row.acquired),
        fencingToken: Number(row.fencing_token) || 0,
      };
    } catch (err: any) {
      markPostgreSqlRuntimeDegraded(
        `PostgreSQL distributed lock exception for "${lockKey}": ${err?.message || 'Unknown error'}`
      );
      return { acquired: false, fencingToken: 0, error: true };
    }
  }

  async releaseLock(lockKey: string, ownerId: string, fencingToken: number): Promise<boolean> {
    if (!fencingToken || fencingToken <= 0) return false;
    try {
      const adminClient = createAdminClient();
      const { data, error } = await adminClient.rpc('release_distributed_lock', {
        p_lock_key: lockKey,
        p_owner_id: ownerId,
        p_fencing_token: fencingToken,
      });

      if (error) {
        return false;
      }
      return Boolean(data);
    } catch {
      return false;
    }
  }

  async getL2Cache<T = any>(cacheKey: string): Promise<L2CacheRecord<T> | null> {
    try {
      const adminClient = createAdminClient();
      const { data, error } = await adminClient.rpc('get_catalog_cache_entry', {
        p_cache_key: cacheKey,
      });

      if (error || !data) return null;

      const row = Array.isArray(data) ? data[0] : data;
      if (!row) return null;

      const minExpiryMs = row.min_token_expiry ? new Date(row.min_token_expiry).getTime() : null;

      return {
        payload: row.payload,
        cachedAt: new Date(row.cached_at).getTime(),
        freshUntil: new Date(row.fresh_until).getTime(),
        staleUntil: new Date(row.stale_until).getTime(),
        minTokenExpiryMs: minExpiryMs,
        isFresh: Boolean(row.is_fresh),
        isStale: Boolean(row.is_stale),
      };
    } catch {
      return null;
    }
  }

  async setL2Cache<T = any>(
    cacheKey: string,
    payload: T,
    freshSeconds: number,
    staleSeconds: number,
    matchId: string | undefined,
    fixtureKey: string | undefined,
    minTokenExpiryMs: number | null | undefined,
    fencingToken: number,
    lockKey: string,
    ownerId: string
  ): Promise<boolean> {
    if (!lockKey || !ownerId || !fencingToken || fencingToken <= 0) {
      return false;
    }
    try {
      const adminClient = createAdminClient();
      const minExpiryDate = minTokenExpiryMs ? new Date(minTokenExpiryMs).toISOString() : null;

      const { data, error } = await adminClient.rpc('set_catalog_cache_entry', {
        p_cache_key: cacheKey,
        p_match_id: matchId || null,
        p_fixture_key: fixtureKey || null,
        p_payload: payload,
        p_fresh_seconds: freshSeconds,
        p_stale_seconds: staleSeconds,
        p_min_token_expiry: minExpiryDate,
        p_fencing_token: fencingToken,
        p_lock_key: lockKey,
        p_owner_id: ownerId,
      });

      if (error) {
        console.warn('[UpstreamCoordination] Failed to write L2 cache:', error.message);
        return false;
      }
      return Boolean(data);
    } catch (err: any) {
      console.warn('[UpstreamCoordination] Failed to write L2 cache:', err?.message);
      return false;
    }
  }

  async clearL2Cache(cacheKey?: string): Promise<void> {
    try {
      const adminClient = createAdminClient();
      if (cacheKey) {
        await adminClient.from('api_catalog_cache').delete().eq('cache_key', cacheKey);
      } else {
        await adminClient.from('api_catalog_cache').delete().neq('cache_key', '');
      }
    } catch {
      // ignore
    }
  }

  async resetAll(provider = 'vnres'): Promise<void> {
    try {
      const adminClient = createAdminClient();
      await adminClient.from('api_upstream_budget_reservations').delete().eq('provider', provider);
      await adminClient.from('api_upstream_status').delete().eq('provider', provider);
      await adminClient.from('api_distributed_locks').delete().neq('lock_key', '');
      await adminClient.from('api_catalog_cache').delete().neq('cache_key', '');
    } catch {
      // ignore
    }
  }

  async cleanupExpired(): Promise<{
    deletedReservations: number;
    deletedLocks: number;
    deletedCacheEntries: number;
  }> {
    try {
      const adminClient = createAdminClient();
      const { data, error } = await adminClient.rpc('cleanup_expired_coordination_data');
      if (error || !data) {
        return { deletedReservations: 0, deletedLocks: 0, deletedCacheEntries: 0 };
      }
      const row = Array.isArray(data) ? data[0] : data;
      return {
        deletedReservations: Number(row?.deleted_reservations) || 0,
        deletedLocks: Number(row?.deleted_locks) || 0,
        deletedCacheEntries: Number(row?.deleted_cache_entries) || 0,
      };
    } catch {
      return { deletedReservations: 0, deletedLocks: 0, deletedCacheEntries: 0 };
    }
  }

  /**
   * Executes a bounded, strictly read-only readiness probe against the deployed
   * `public.get_catalog_cache_entry(p_cache_key TEXT)` RPC.
   *
   * Safety guarantees:
   * - Performs zero writes, consumes zero upstream request budget, and creates no locks.
   * - Verifies actual Supabase/PostgreSQL connectivity, service_role auth, RPC existence,
   *   and expected array response shape (`Array.isArray(data)`).
   */
  async verifyReadiness(timeoutMs = 3000): Promise<{ ok: boolean; reason?: string }> {
    if (customReadinessProbe) {
      try {
        const probeResult = await customReadinessProbe();
        if (!probeResult || typeof probeResult.ok !== 'boolean') {
          return {
            ok: false,
            reason: 'PostgreSQL readiness probe returned malformed result.',
          };
        }
        return probeResult;
      } catch (err: any) {
        return {
          ok: false,
          reason: `PostgreSQL readiness probe rejected: ${err?.message || 'Unknown error'}`,
        };
      }
    }

    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
      const adminClient = createAdminClient();
      const rpcPromise = Promise.resolve(
        adminClient.rpc('get_catalog_cache_entry', {
          p_cache_key: '__coordination_readiness_probe__',
        })
      ).catch((err: any) => ({
        data: null,
        error: { message: err?.message || 'RPC promise rejected' },
      }));

      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`PostgreSQL readiness probe timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      });

      const response = await Promise.race([rpcPromise, timeoutPromise]);
      return validateReadinessRpcResponse(response);
    } catch (err: any) {
      return {
        ok: false,
        reason: `PostgreSQL readiness probe failed: ${err?.message || 'Unknown error'}`,
      };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

/**
 * Validates the raw Supabase RPC response returned by `get_catalog_cache_entry`.
 * `get_catalog_cache_entry` is declared `RETURNS TABLE (...)`, so PostgREST must
 * return an array (`[]` when empty). Any non-array or malformed payload is rejected.
 */
export function validateReadinessRpcResponse(
  response: unknown
): { ok: boolean; reason?: string } {
  if (!response || typeof response !== 'object') {
    return {
      ok: false,
      reason: 'PostgreSQL readiness RPC returned malformed response.',
    };
  }

  const { data, error } = response as {
    data?: unknown;
    error?: { message?: string } | null;
  };

  if (error) {
    return {
      ok: false,
      reason: `PostgreSQL readiness RPC failed: ${error.message || 'Unknown RPC error'}`,
    };
  }

  if (!Array.isArray(data)) {
    return {
      ok: false,
      reason: 'PostgreSQL readiness RPC returned unexpected non-array data shape.',
    };
  }

  return { ok: true };
}

// -----------------------------------------------------------------------------
// Coordination Health & Fail-Closed Degraded Store (Phase 3 Stage 3.2 / 3.2.1)
// -----------------------------------------------------------------------------

export type CoordinationMode = 'postgresql' | 'in_memory' | 'degraded';

export interface CoordinationHealthStatus {
  mode: CoordinationMode;
  initialized: boolean;
  ready: boolean;
  degraded: boolean;
  reason: string | null;
  lastErrorAt: number | null;
}

export type CoordinationReadinessProbe = () => Promise<{ ok: boolean; reason?: string }>;

/**
 * Fail-closed store used ONLY when production is configured for PostgreSQL
 * coordination but initialization, credentials, or readiness probe fail.
 *
 * Security / Operational Guarantees:
 * - Never silently falls back to process-local InMemoryCoordinationStore in production.
 * - Blocks all upstream budget leases and distributed lock acquisitions so global
 *   upstream rate limits cannot be bypassed.
 * - Returns null on L2 cache reads so callers may still serve valid existing L1
 *   cached/stale data without crashing the application.
 */
export class DegradedFailClosedCoordinationStore implements IUpstreamCoordinationStore {
  private readonly reason: string;

  constructor(reason: string) {
    this.reason = reason;
  }

  getReason(): string {
    return this.reason;
  }

  async acquireBudgetLease(): Promise<BudgetReservationResult> {
    return {
      allowed: false,
      reason: 'DATABASE_ERROR',
      retryAfter: 30,
      currentCount: 0,
    };
  }

  async setCooldown(
    _provider: string,
    cooldownSeconds = 30
  ): Promise<{ cooldownUntilMs: number }> {
    return { cooldownUntilMs: Date.now() + cooldownSeconds * 1000 };
  }

  async recordSuccess(): Promise<void> {
    // No-op in degraded mode
  }

  async getStatus(
    _provider: string,
    maxRequests = 120
  ): Promise<UpstreamStatus> {
    return {
      inCooldown: true,
      cooldownRemainingSeconds: 30,
      requestsInWindow: maxRequests,
      budgetCeiling: maxRequests,
      degraded: true,
    };
  }

  async acquireLock(): Promise<LockAcquisitionResult> {
    return { acquired: false, fencingToken: 0, error: true };
  }

  async releaseLock(): Promise<boolean> {
    return false;
  }

  async getL2Cache<T = any>(): Promise<L2CacheRecord<T> | null> {
    return null;
  }

  async setL2Cache(): Promise<boolean> {
    return false;
  }

  async clearL2Cache(): Promise<void> {
    // No-op in degraded mode
  }

  async resetAll(): Promise<void> {
    // No-op in degraded mode
  }

  async cleanupExpired(): Promise<{
    deletedReservations: number;
    deletedLocks: number;
    deletedCacheEntries: number;
  }> {
    return { deletedReservations: 0, deletedLocks: 0, deletedCacheEntries: 0 };
  }
}

// Singleton coordination store state
const DEFAULT_RECOVERY_PROBE_THROTTLE_MS = 2000;

let activeCoordinationStore: IUpstreamCoordinationStore | null = null;
let hasExplicitStoreOverride = false;
let initializationPromise: Promise<IUpstreamCoordinationStore> | null = null;
let customReadinessProbe: CoordinationReadinessProbe | null = null;
// Strictly monotonic epoch counter; NEVER reset or reused (prevents stale probe overwrites)
let storeEpoch = 0;
let recoveryProbeThrottleMs = DEFAULT_RECOVERY_PROBE_THROTTLE_MS;
let lastProbeFailureMonotonicMs: number | null = null;
let coordinationHealth: CoordinationHealthStatus = {
  mode: 'in_memory',
  initialized: false,
  ready: false,
  degraded: false,
  reason: null,
  lastErrorAt: null,
};

function hasSupabaseAdminEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function shouldRequirePostgreSqlCoordination(): boolean {
  if (process.env.NODE_ENV === 'production') {
    return true;
  }
  // In non-production (development), use PostgreSQL only if explicitly opted in
  // via COORDINATION_STORE=postgresql. Default local/test environments use in-memory.
  return process.env.COORDINATION_STORE === 'postgresql';
}

function markPostgreSqlRuntimeDegraded(reason: string): void {
  if (coordinationHealth.mode === 'postgresql') {
    coordinationHealth = {
      ...coordinationHealth,
      ready: false,
      degraded: true,
      reason,
      lastErrorAt: Date.now(),
    };
  }
}

function markPostgreSqlRuntimeHealthy(): void {
  if (coordinationHealth.mode === 'postgresql' && (!coordinationHealth.ready || coordinationHealth.degraded)) {
    coordinationHealth = {
      ...coordinationHealth,
      ready: true,
      degraded: false,
      reason: null,
    };
  }
}

/**
 * Synchronously resolves the coordination store when called from synchronous entrypoints.
 *
 * Important (F-32-04):
 * - Synchronous `createAdminClient()` construction does NOT prove PostgreSQL/RPC readiness.
 *   Therefore `ready` remains `false` until `initializeGlobalCoordinationStore()` completes
 *   its read-only RPC readiness probe or a live PostgreSQL coordination RPC succeeds.
 * - Never silently falls back to `InMemoryCoordinationStore` in production.
 */
function ensureCoordinationStoreInitialized(): IUpstreamCoordinationStore {
  if (activeCoordinationStore !== null) {
    return activeCoordinationStore;
  }

  if (shouldRequirePostgreSqlCoordination()) {
    if (!hasSupabaseAdminEnv()) {
      const reason =
        'PostgreSQL coordination required in production, but NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.';
      console.error(`[UpstreamCoordination] ${reason}`);
      activeCoordinationStore = new DegradedFailClosedCoordinationStore(reason);
      coordinationHealth = {
        mode: 'degraded',
        initialized: true,
        ready: false,
        degraded: true,
        reason,
        lastErrorAt: Date.now(),
      };
      return activeCoordinationStore;
    }

    try {
      createAdminClient();
      activeCoordinationStore = new PostgreSqlCoordinationStore();
      coordinationHealth = {
        mode: 'postgresql',
        initialized: true,
        ready: false,
        degraded: false,
        reason: null,
        lastErrorAt: null,
      };
      return activeCoordinationStore;
    } catch (err: any) {
      const reason = `PostgreSQL coordination initialization failed: ${err?.message || 'Unknown error'}`;
      console.error(`[UpstreamCoordination] ${reason}`);
      activeCoordinationStore = new DegradedFailClosedCoordinationStore(reason);
      coordinationHealth = {
        mode: 'degraded',
        initialized: true,
        ready: false,
        degraded: true,
        reason,
        lastErrorAt: Date.now(),
      };
      return activeCoordinationStore;
    }
  }

  // Supported local/test environment: in-memory coordination store
  activeCoordinationStore = new InMemoryCoordinationStore();
  coordinationHealth = {
    mode: 'in_memory',
    initialized: true,
    ready: true,
    degraded: false,
    reason: null,
    lastErrorAt: null,
  };
  return activeCoordinationStore;
}

/**
 * Concurrency-safe async singleton initializer and recovery coordinator (F-32-01, F-32-04).
 *
 * Guarantees:
 * - Multiple concurrent callers share ONE initialization or recovery attempt.
 * - Preserves explicit test overrides installed via `setGlobalCoordinationStore()`.
 * - In production, verifies actual PostgreSQL RPC readiness via read-only
 *   `get_catalog_cache_entry` before marking the store ready/healthy.
 * - If initialization failed earlier (`DegradedFailClosedCoordinationStore`) or a
 *   transient runtime `DATABASE_ERROR` marked health degraded, subsequent calls retry
 *   through this single-flight promise and recover ONLY upon a successful PostgreSQL
 *   readiness probe (never via a timer-only reset).
 */
export async function initializeGlobalCoordinationStore(): Promise<IUpstreamCoordinationStore> {
  // 1. Respect explicit test-store injection unconditionally
  if (hasExplicitStoreOverride && activeCoordinationStore !== null) {
    return activeCoordinationStore;
  }

  // 2. O(1) Fast path: already initialized, ready, and healthy (zero readiness probes)
  if (
    activeCoordinationStore !== null &&
    !(activeCoordinationStore instanceof DegradedFailClosedCoordinationStore) &&
    coordinationHealth.ready &&
    !coordinationHealth.degraded
  ) {
    return activeCoordinationStore;
  }

  // 3. Share any in-flight initialization or recovery probe across concurrent callers
  if (initializationPromise) {
    return initializationPromise;
  }

  // 4. Bounded probe-failure throttle (monotonic elapsed time; NEVER declares DB healthy on timer)
  if (
    activeCoordinationStore instanceof DegradedFailClosedCoordinationStore &&
    lastProbeFailureMonotonicMs !== null &&
    recoveryProbeThrottleMs > 0 &&
    performance.now() - lastProbeFailureMonotonicMs < recoveryProbeThrottleMs
  ) {
    return activeCoordinationStore;
  }

  // 5. Single-flight initialization / recovery attempt guarded by monotonic storeEpoch
  const capturedEpoch = storeEpoch;
  const currentPromise = (async (): Promise<IUpstreamCoordinationStore> => {
    if (!shouldRequirePostgreSqlCoordination()) {
      if (hasExplicitStoreOverride || storeEpoch !== capturedEpoch) {
        return activeCoordinationStore ?? new InMemoryCoordinationStore();
      }
      if (!activeCoordinationStore) {
        activeCoordinationStore = new InMemoryCoordinationStore();
      }
      lastProbeFailureMonotonicMs = null;
      coordinationHealth = {
        mode: 'in_memory',
        initialized: true,
        ready: true,
        degraded: false,
        reason: null,
        lastErrorAt: null,
      };
      return activeCoordinationStore;
    }

    if (!hasSupabaseAdminEnv()) {
      const reason =
        'PostgreSQL coordination required in production, but NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.';
      console.error(`[UpstreamCoordination] ${reason}`);
      if (hasExplicitStoreOverride || storeEpoch !== capturedEpoch) {
        return activeCoordinationStore ?? new DegradedFailClosedCoordinationStore(reason);
      }
      lastProbeFailureMonotonicMs = performance.now();
      activeCoordinationStore = new DegradedFailClosedCoordinationStore(reason);
      coordinationHealth = {
        mode: 'degraded',
        initialized: true,
        ready: false,
        degraded: true,
        reason,
        lastErrorAt: Date.now(),
      };
      return activeCoordinationStore;
    }

    let candidate: PostgreSqlCoordinationStore;
    try {
      createAdminClient();
      candidate =
        activeCoordinationStore instanceof PostgreSqlCoordinationStore
          ? activeCoordinationStore
          : new PostgreSqlCoordinationStore();
    } catch (err: any) {
      const reason = `PostgreSQL coordination initialization failed: ${err?.message || 'Unknown error'}`;
      console.error(`[UpstreamCoordination] ${reason}`);
      if (hasExplicitStoreOverride || storeEpoch !== capturedEpoch) {
        return activeCoordinationStore ?? new DegradedFailClosedCoordinationStore(reason);
      }
      lastProbeFailureMonotonicMs = performance.now();
      activeCoordinationStore = new DegradedFailClosedCoordinationStore(reason);
      coordinationHealth = {
        mode: 'degraded',
        initialized: true,
        ready: false,
        degraded: true,
        reason,
        lastErrorAt: Date.now(),
      };
      return activeCoordinationStore;
    }

    // Verify actual PostgreSQL/RPC readiness using read-only get_catalog_cache_entry
    const probe = await candidate.verifyReadiness();

    // Epoch guard: reject stale probe result if store was explicitly replaced or reset during await
    if (hasExplicitStoreOverride || storeEpoch !== capturedEpoch) {
      return activeCoordinationStore ?? candidate;
    }

    if (!probe.ok) {
      const reason = probe.reason || 'PostgreSQL coordination readiness probe failed.';
      console.error(`[UpstreamCoordination] ${reason}`);
      lastProbeFailureMonotonicMs = performance.now();
      activeCoordinationStore = new DegradedFailClosedCoordinationStore(reason);
      coordinationHealth = {
        mode: 'degraded',
        initialized: true,
        ready: false,
        degraded: true,
        reason,
        lastErrorAt: Date.now(),
      };
      return activeCoordinationStore;
    }

    lastProbeFailureMonotonicMs = null;
    activeCoordinationStore = candidate;
    coordinationHealth = {
      mode: 'postgresql',
      initialized: true,
      ready: true,
      degraded: false,
      reason: null,
      lastErrorAt: null,
    };
    return activeCoordinationStore;
  })().finally(() => {
    if (initializationPromise === currentPromise) {
      initializationPromise = null;
    }
  });

  initializationPromise = currentPromise;
  return currentPromise;
}

export function setCoordinationReadinessProbe(probe: CoordinationReadinessProbe | null): void {
  customReadinessProbe = probe;
}

export function setRecoveryProbeThrottleMs(throttleMs: number): void {
  if (Number.isFinite(throttleMs) && throttleMs >= 0) {
    recoveryProbeThrottleMs = Math.floor(throttleMs);
  }
}

export function setGlobalCoordinationStore(store: IUpstreamCoordinationStore): void {
  storeEpoch++;
  activeCoordinationStore = store;
  hasExplicitStoreOverride = true;
  initializationPromise = null;
  lastProbeFailureMonotonicMs = null;
  const isDegraded = store instanceof DegradedFailClosedCoordinationStore;
  const isPostgres = store instanceof PostgreSqlCoordinationStore;
  coordinationHealth = {
    mode: isDegraded ? 'degraded' : isPostgres ? 'postgresql' : 'in_memory',
    initialized: true,
    ready: !isDegraded,
    degraded: isDegraded,
    reason: isDegraded ? store.getReason() : null,
    lastErrorAt: isDegraded ? Date.now() : null,
  };
}

/**
 * Resets singleton coordination initialization state (for isolated test suites).
 * Note: `storeEpoch` is incremented and NEVER reset to zero so in-flight probes
 * from prior epochs cannot overwrite newer state.
 */
export function resetGlobalCoordinationInitialization(): void {
  storeEpoch++;
  activeCoordinationStore = null;
  hasExplicitStoreOverride = false;
  initializationPromise = null;
  customReadinessProbe = null;
  recoveryProbeThrottleMs = DEFAULT_RECOVERY_PROBE_THROTTLE_MS;
  lastProbeFailureMonotonicMs = null;
  coordinationHealth = {
    mode: 'in_memory',
    initialized: false,
    ready: false,
    degraded: false,
    reason: null,
    lastErrorAt: null,
  };
}

export function getGlobalCoordinationStore(): IUpstreamCoordinationStore {
  return ensureCoordinationStoreInitialized();
}

export function getCoordinationHealth(): CoordinationHealthStatus {
  ensureCoordinationStoreInitialized();
  return { ...coordinationHealth };
}

export function isExplicitCoordinationOverride(): boolean {
  return hasExplicitStoreOverride;
}

// -----------------------------------------------------------------------------
// High-Level Global Coordination Functions
// -----------------------------------------------------------------------------

export async function acquireGlobalUpstreamBudget(
  provider = 'vnres',
  maxRequests = 120,
  windowSeconds = 60
): Promise<BudgetReservationResult> {
  const store = await initializeGlobalCoordinationStore();
  const result = await store.acquireBudgetLease(provider, maxRequests, windowSeconds);
  if (result.reason === 'DATABASE_ERROR') {
    markPostgreSqlRuntimeDegraded(
      `PostgreSQL budget lease RPC failed for provider "${provider}"`
    );
  } else if (result.allowed || result.reason === 'COOLDOWN' || result.reason === 'BUDGET_EXCEEDED') {
    // Any valid non-error response from PostgreSQL confirms live RPC health
    markPostgreSqlRuntimeHealthy();
  }
  return result;
}

export async function triggerGlobalFailureCooldown(
  provider = 'vnres',
  cooldownSeconds = 30,
  reason?: string
): Promise<{ cooldownUntilMs: number }> {
  const store = await initializeGlobalCoordinationStore();
  return store.setCooldown(provider, cooldownSeconds, reason);
}

export async function recordGlobalUpstreamSuccess(provider = 'vnres'): Promise<void> {
  const store = await initializeGlobalCoordinationStore();
  return store.recordSuccess(provider);
}

export async function getGlobalUpstreamStatus(
  provider = 'vnres',
  maxRequests = 120,
  windowSeconds = 60
): Promise<UpstreamStatus> {
  const store = await initializeGlobalCoordinationStore();
  return store.getStatus(provider, maxRequests, windowSeconds);
}

export async function resetGlobalUpstreamCoordination(provider = 'vnres'): Promise<void> {
  return getGlobalCoordinationStore().resetAll(provider);
}

export async function cleanupGlobalCoordinationData(): Promise<{
  deletedReservations: number;
  deletedLocks: number;
  deletedCacheEntries: number;
}> {
  const store = await initializeGlobalCoordinationStore();
  return store.cleanupExpired();
}

export interface LeaderContext {
  fencingToken: number;
  lockKey: string;
  ownerId: string;
}

export interface SingleFlightOptions<T> {
  l2CacheKey?: string;
  ttlSeconds?: number;
  waitTimeoutMs?: number;
  pollIntervalMs?: number;
  maxPollIntervalMs?: number;
  useBackoff?: boolean;
  onL2Hit?: (entry: L2CacheRecord<T>) => void;
  onLeaderSuccess?: (data: T, context: LeaderContext) => Promise<void> | void;
}

/**
 * Cross-Worker Single-Flight Coordination Wrapper.
 * Ensures concurrent requests across PM2 workers do NOT dispatch duplicate
 * upstream HTTP queries for the same fixture.
 *
 * Strict Concurrency & Crash Invariants (Hardened in Phase 2.21 & 2.23):
 * 1. Database transactions are NEVER held open during the upstream HTTP request.
 * 2. Uses bounded lease locks with a 10-second default TTL (safe margin over 5s HTTP timeout).
 * 3. Default waiter timeout is 6,500ms (exceeds 5,000ms HTTP timeout + L2 publication latency).
 * 4. Waiting workers poll L2 cache and lock state with bounded exponential backoff & jitter (F-22-06).
 * 5. Monotonic fencing tokens prevent delayed leaders from overwriting fresh cache entries (F-22-02).
 * 6. Crashed or abandoned locks expire automatically without manual intervention.
 * 7. Followers reacquiring an expired/released lock verify L2 cache prior to dispatching upstream.
 * 8. If waiter timeout elapses without lock acquisition or cache hit, request fails closed
 *    with an explicit CoordinationTimeoutError (HTTP 503 ANOTHER_WORKER_FETCHING, Retry-After: 2) (F-22-01).
 * 9. Fixture-specific lock keys ensure unrelated matches proceed in parallel.
 */
export async function withDistributedSingleFlight<T>(
  lockKey: string,
  workerId: string,
  fetchFn: () => Promise<T>,
  options?: SingleFlightOptions<T>
): Promise<T> {
  const store = await initializeGlobalCoordinationStore();
  const ttlSeconds = options?.ttlSeconds ?? 10;
  const waitTimeoutMs = options?.waitTimeoutMs ?? 6500;
  const basePollIntervalMs = options?.pollIntervalMs ?? 50;
  const maxPollIntervalMs = options?.maxPollIntervalMs ?? 300;
  // Enable backoff by default in production; keep fixed interval if explicitly passed in tests unless useBackoff is true
  const useBackoff = options?.useBackoff ?? (options?.pollIntervalMs === undefined);

  // Step 1: Pre-flight check L2 cache
  if (options?.l2CacheKey) {
    const l2 = await store.getL2Cache<T>(options.l2CacheKey);
    if (l2 && l2.isFresh) {
      if (options.onL2Hit) options.onL2Hit(l2);
      return l2.payload;
    }
  }

  // Step 2: Attempt distributed lock acquisition (returns { acquired, fencingToken, error? })
  const lockAcq = await store.acquireLock(lockKey, workerId, ttlSeconds);

  if (lockAcq.acquired) {
    // Current worker is the elected LEADER.
    // Dispatches upstream HTTP request. (NO DB transaction held open!)
    try {
      const data = await fetchFn();
      if (options?.onLeaderSuccess) {
        await options.onLeaderSuccess(data, {
          fencingToken: lockAcq.fencingToken || 0,
          lockKey,
          ownerId: workerId,
        });
      }
      return data;
    } finally {
      // Release lock so waiting workers and future requests proceed immediately
      await store.releaseLock(lockKey, workerId, lockAcq.fencingToken || 0).catch(() => {});
    }
  }

  // F-32-06: Fail fast on coordination backend error instead of spinning for 6.5s
  if (lockAcq.error) {
    throw new CoordinationTimeoutError(
      'Coordination backend unavailable while acquiring distributed lock',
      30
    );
  }

  // Step 3: Current worker is a FOLLOWER.
  // Another worker is actively fetching upstream. Wait and poll L2 cache with bounded backoff.
  const startTime = Date.now();
  let currentPollIntervalMs = basePollIntervalMs;
  let consecutiveLockErrors = 0;

  while (Date.now() - startTime < waitTimeoutMs) {
    let sleepMs = currentPollIntervalMs;
    if (useBackoff) {
      const jitterFactor = 0.9 + Math.random() * 0.2; // +/- 10% jitter
      sleepMs = Math.max(10, Math.round(currentPollIntervalMs * jitterFactor));
    }

    const remainingBudgetMs = waitTimeoutMs - (Date.now() - startTime);
    if (remainingBudgetMs <= 0) break;
    await new Promise((resolve) => setTimeout(resolve, Math.min(sleepMs, remainingBudgetMs)));

    // Check if the leader populated L2 cache with the freshly resolved data
    if (options?.l2CacheKey) {
      const l2 = await store.getL2Cache<T>(options.l2CacheKey);
      if (l2 && (l2.isFresh || l2.isStale)) {
        if (options.onL2Hit) options.onL2Hit(l2);
        return l2.payload;
      }
    }

    // Check if the previous leader crashed, failed, or finished and released lock
    const reacquired = await store.acquireLock(lockKey, workerId, ttlSeconds);
    if (reacquired.error) {
      consecutiveLockErrors++;
      if (consecutiveLockErrors >= 2) {
        throw new CoordinationTimeoutError(
          'Coordination backend unavailable while polling distributed lock',
          30
        );
      }
    } else {
      consecutiveLockErrors = 0;
    }

    if (reacquired.acquired) {
      // Lock acquired by follower.
      // Re-check L2 cache one last time before dispatching upstream:
      // The previous leader might have written to L2 right before releasing its lock.
      if (options?.l2CacheKey) {
        const l2 = await store.getL2Cache<T>(options.l2CacheKey);
        if (l2 && (l2.isFresh || l2.isStale)) {
          await store.releaseLock(lockKey, workerId, reacquired.fencingToken || 0).catch(() => {});
          if (options.onL2Hit) options.onL2Hit(l2);
          return l2.payload;
        }
      }

      // Leader either failed without writing to cache, or crashed.
      // This follower is now the new elected LEADER.
      try {
        const data = await fetchFn();
        if (options?.onLeaderSuccess) {
          await options.onLeaderSuccess(data, {
            fencingToken: reacquired.fencingToken || 0,
            lockKey,
            ownerId: workerId,
          });
        }
        return data;
      } finally {
        await store.releaseLock(lockKey, workerId, reacquired.fencingToken || 0).catch(() => {});
      }
    }

    // Ramping backoff schedule: 50ms -> 75ms -> 112ms -> 168ms -> 252ms -> 300ms cap (F-22-06)
    if (useBackoff) {
      currentPollIntervalMs = Math.min(maxPollIntervalMs, Math.round(currentPollIntervalMs * 1.5));
    }
  }

  // Step 4: Waiter timed out (exceeded waitTimeoutMs) without leader completing or releasing lock.
  // Final check of L2 cache in case leader just finished:
  if (options?.l2CacheKey) {
    const l2 = await store.getL2Cache<T>(options.l2CacheKey);
    if (l2 && (l2.isFresh || l2.isStale)) {
      if (options.onL2Hit) options.onL2Hit(l2);
      return l2.payload;
    }
  }

  // Final attempt to safely acquire the lock:
  const lastAttempt = await store.acquireLock(lockKey, workerId, ttlSeconds);
  if (lastAttempt.error) {
    throw new CoordinationTimeoutError(
      'Coordination backend unavailable while acquiring distributed lock',
      30
    );
  }
  if (lastAttempt.acquired) {
    try {
      const data = await fetchFn();
      if (options?.onLeaderSuccess) {
        await options.onLeaderSuccess(data, {
          fencingToken: lastAttempt.fencingToken || 0,
          lockKey,
          ownerId: workerId,
        });
      }
      return data;
    } finally {
      await store.releaseLock(lockKey, workerId, lastAttempt.fencingToken || 0).catch(() => {});
    }
  }

  // The lock is still actively held by another worker and no cache was published.
  // Fail-safe: Rather than blindly dispatching duplicate upstream traffic,
  // return an explicit CoordinationTimeoutError (HTTP 503 ANOTHER_WORKER_FETCHING, Retry-After: 2)
  throw new CoordinationTimeoutError();
}
