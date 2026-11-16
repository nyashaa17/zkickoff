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
      };
    } catch {
      return {
        inCooldown: false,
        cooldownRemainingSeconds: 0,
        requestsInWindow: 0,
        budgetCeiling: maxRequests,
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
        return { acquired: false, fencingToken: 0 };
      }

      const row = Array.isArray(data) ? data[0] : data;
      if (!row) return { acquired: false, fencingToken: 0 };

      return {
        acquired: Boolean(row.acquired),
        fencingToken: Number(row.fencing_token) || 0,
      };
    } catch {
      return { acquired: false, fencingToken: 0 };
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
}

// Global store reference (defaults to InMemory in development/test unless Supabase is configured)
let activeCoordinationStore: IUpstreamCoordinationStore = new InMemoryCoordinationStore();

export function setGlobalCoordinationStore(store: IUpstreamCoordinationStore): void {
  activeCoordinationStore = store;
}

export function getGlobalCoordinationStore(): IUpstreamCoordinationStore {
  return activeCoordinationStore;
}

// -----------------------------------------------------------------------------
// High-Level Global Coordination Functions
// -----------------------------------------------------------------------------

export async function acquireGlobalUpstreamBudget(
  provider = 'vnres',
  maxRequests = 120,
  windowSeconds = 60
): Promise<BudgetReservationResult> {
  return activeCoordinationStore.acquireBudgetLease(provider, maxRequests, windowSeconds);
}

export async function triggerGlobalFailureCooldown(
  provider = 'vnres',
  cooldownSeconds = 30,
  reason?: string
): Promise<{ cooldownUntilMs: number }> {
  return activeCoordinationStore.setCooldown(provider, cooldownSeconds, reason);
}

export async function recordGlobalUpstreamSuccess(provider = 'vnres'): Promise<void> {
  return activeCoordinationStore.recordSuccess(provider);
}

export async function getGlobalUpstreamStatus(
  provider = 'vnres',
  maxRequests = 120,
  windowSeconds = 60
): Promise<UpstreamStatus> {
  return activeCoordinationStore.getStatus(provider, maxRequests, windowSeconds);
}

export async function resetGlobalUpstreamCoordination(provider = 'vnres'): Promise<void> {
  return activeCoordinationStore.resetAll(provider);
}

export async function cleanupGlobalCoordinationData(): Promise<{
  deletedReservations: number;
  deletedLocks: number;
  deletedCacheEntries: number;
}> {
  return activeCoordinationStore.cleanupExpired();
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
  const store = getGlobalCoordinationStore();
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

  // Step 2: Attempt distributed lock acquisition (returns { acquired, fencingToken })
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

  // Step 3: Current worker is a FOLLOWER.
  // Another worker is actively fetching upstream. Wait and poll L2 cache with bounded backoff.
  const startTime = Date.now();
  let currentPollIntervalMs = basePollIntervalMs;

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
