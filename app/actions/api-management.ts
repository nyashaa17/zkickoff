'use server';

import { requireAdminSession } from '@/lib/supabase/auth-guard';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateApiKey, invalidateApiKeyCache } from '@/lib/api/auth';
import { invalidateApiSettingsCache } from '@/lib/api/kill-switch';
import { 
  ApiKeyRecord, 
  ApiSettingsRecord, 
  SafeApiKey, 
  interpolatePercentile, 
  createEmptyHistogram 
} from '@/lib/api/types';

export interface ActionResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface AnalyticsSummary {
  timeRange: '24h' | '7d';
  totalRequests: number;
  status2xx: number;
  status4xx: number;
  status5xx: number;
  status429: number;
  errorCount: number;
  rateLimitEvents: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  endpointBreakdown: Record<string, number>;
  hourlyTimeline: {
    hour: string;
    requests: number;
    errors: number;
    rateLimits: number;
  }[];
  keyUsageBreakdown: {
    keyId: string;
    keyName: string;
    developerName: string;
    requests: number;
    errors: number;
    rateLimits: number;
  }[];
}

// -------------------------------------------------------------------------
// 1. API SETTINGS ACTIONS
// -------------------------------------------------------------------------

export async function getApiSettingsAction(): Promise<ActionResponse<ApiSettingsRecord>> {
  await requireAdminSession();
  try {
    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from('api_settings')
      .select('*')
      .eq('id', 'master')
      .single();

    if (error || !data) {
      throw error || new Error('Failed to load master API settings.');
    }

    return { success: true, data: data as ApiSettingsRecord };
  } catch (err: any) {
    console.error('[Admin Action] getApiSettingsAction error:', err);
    return { success: false, error: err?.message || 'Failed to fetch API settings' };
  }
}

export async function updateApiSettingsAction(input: {
  is_api_enabled: boolean;
  default_rate_limit_minute: number;
  default_rate_limit_day: number;
  maintenance_message: string;
}): Promise<ActionResponse<ApiSettingsRecord>> {
  const session = await requireAdminSession();

  if (input.default_rate_limit_minute <= 0 || input.default_rate_limit_day <= 0) {
    return { success: false, error: 'Rate limits must be positive integers.' };
  }

  const message = (input.maintenance_message || '').trim();
  if (message.length < 5 || message.length > 500) {
    return { success: false, error: 'Maintenance message must be between 5 and 500 characters.' };
  }

  try {
    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from('api_settings')
      .update({
        is_api_enabled: Boolean(input.is_api_enabled),
        default_rate_limit_minute: Math.floor(input.default_rate_limit_minute),
        default_rate_limit_day: Math.floor(input.default_rate_limit_day),
        maintenance_message: message,
        updated_by: session.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 'master')
      .select('*')
      .single();

    if (error || !data) {
      throw error || new Error('Failed to update API settings');
    }

    // Immediately bust in-memory worker settings cache
    invalidateApiSettingsCache();

    return { success: true, data: data as ApiSettingsRecord };
  } catch (err: any) {
    console.error('[Admin Action] updateApiSettingsAction error:', err);
    return { success: false, error: err?.message || 'Failed to update API settings' };
  }
}

// -------------------------------------------------------------------------
// 2. API KEY MANAGEMENT ACTIONS
// -------------------------------------------------------------------------

export async function createApiKeyAction(input: {
  name: string;
  developer_name: string;
  developer_email: string;
  rate_limit_minute?: number;
  rate_limit_day?: number;
}): Promise<ActionResponse<{ plaintextKey: string; keyRecord: SafeApiKey }>> {
  const session = await requireAdminSession();

  const name = (input.name || '').trim();
  const developerName = (input.developer_name || '').trim();
  const developerEmail = (input.developer_email || '').trim().toLowerCase();

  if (name.length < 2 || name.length > 100) {
    return { success: false, error: 'Key name must be between 2 and 100 characters.' };
  }
  if (developerName.length < 2 || developerName.length > 100) {
    return { success: false, error: 'Developer name must be between 2 and 100 characters.' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(developerEmail) || developerEmail.length > 255) {
    return { success: false, error: 'A valid developer email address is required.' };
  }

  const minuteLimit = Math.max(1, input.rate_limit_minute || 60);
  const dayLimit = Math.max(1, input.rate_limit_day || 10000);

  // Generate cryptographically secure random key
  const { fullKey, keyPrefix, keyHash } = generateApiKey();

  try {
    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from('api_keys')
      .insert({
        name,
        developer_name: developerName,
        developer_email: developerEmail,
        key_prefix: keyPrefix,
        key_hash: keyHash,
        status: 'active',
        rate_limit_minute: minuteLimit,
        rate_limit_day: dayLimit,
        created_by: session.id,
      })
      .select('id, name, developer_name, developer_email, key_prefix, status, rate_limit_minute, rate_limit_day, created_by, revoked_by, revoked_at, revocation_reason, last_used_at, created_at, updated_at')
      .single();

    if (error || !data) {
      throw error || new Error('Database insertion failed for API key.');
    }

    return {
      success: true,
      data: {
        plaintextKey: fullKey, // Returned exactly once upon creation
        keyRecord: data as SafeApiKey,
      },
    };
  } catch (err: any) {
    console.error('[Admin Action] createApiKeyAction error:', err);
    return { success: false, error: err?.message || 'Failed to create API key' };
  }
}

export async function listApiKeysAction(): Promise<ActionResponse<SafeApiKey[]>> {
  await requireAdminSession();
  try {
    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from('api_keys')
      .select('id, name, developer_name, developer_email, key_prefix, status, rate_limit_minute, rate_limit_day, created_by, revoked_by, revoked_at, revocation_reason, last_used_at, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return { success: true, data: (data || []) as SafeApiKey[] };
  } catch (err: any) {
    console.error('[Admin Action] listApiKeysAction error:', err);
    return { success: false, error: err?.message || 'Failed to list API keys' };
  }
}

export async function revokeApiKeyAction(
  keyId: string,
  reason: string
): Promise<ActionResponse<SafeApiKey>> {
  const session = await requireAdminSession();

  if (!keyId || typeof keyId !== 'string') {
    return { success: false, error: 'A valid API key ID is required.' };
  }
  const cleanReason = (reason || '').trim();
  if (cleanReason.length < 3 || cleanReason.length > 255) {
    return { success: false, error: 'Revocation reason must be between 3 and 255 characters.' };
  }

  try {
    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from('api_keys')
      .update({
        status: 'revoked',
        revoked_at: new Date().toISOString(),
        revoked_by: session.id,
        revocation_reason: cleanReason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', keyId)
      .select('id, name, developer_name, developer_email, key_prefix, status, rate_limit_minute, rate_limit_day, created_by, revoked_by, revoked_at, revocation_reason, last_used_at, created_at, updated_at')
      .single();

    if (error || !data) {
      throw error || new Error('Failed to revoke API key.');
    }

    // Invalidate local in-memory auth caches
    invalidateApiKeyCache(keyId);

    return { success: true, data: data as SafeApiKey };
  } catch (err: any) {
    console.error('[Admin Action] revokeApiKeyAction error:', err);
    return { success: false, error: err?.message || 'Failed to revoke API key' };
  }
}

export async function updateKeyLimitsAction(
  keyId: string,
  rateLimitMinute: number,
  rateLimitDay: number
): Promise<ActionResponse<SafeApiKey>> {
  await requireAdminSession();

  if (rateLimitMinute <= 0 || rateLimitDay <= 0) {
    return { success: false, error: 'Rate limits must be positive integers.' };
  }

  try {
    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from('api_keys')
      .update({
        rate_limit_minute: Math.floor(rateLimitMinute),
        rate_limit_day: Math.floor(rateLimitDay),
        updated_at: new Date().toISOString(),
      })
      .eq('id', keyId)
      .select('id, name, developer_name, developer_email, key_prefix, status, rate_limit_minute, rate_limit_day, created_by, revoked_by, revoked_at, revocation_reason, last_used_at, created_at, updated_at')
      .single();

    if (error || !data) {
      throw error || new Error('Failed to update key limits.');
    }

    invalidateApiKeyCache(keyId);
    return { success: true, data: data as SafeApiKey };
  } catch (err: any) {
    console.error('[Admin Action] updateKeyLimitsAction error:', err);
    return { success: false, error: err?.message || 'Failed to update key limits' };
  }
}

// -------------------------------------------------------------------------
// 3. ANALYTICS & RETENTION ACTIONS
// -------------------------------------------------------------------------

export async function getApiAnalyticsAction(
  timeRange: '24h' | '7d' = '24h'
): Promise<ActionResponse<AnalyticsSummary>> {
  await requireAdminSession();

  const now = new Date();
  const hoursAgo = timeRange === '7d' ? 7 * 24 : 24;
  const cutoffTime = new Date(now.getTime() - hoursAgo * 3600 * 1000).toISOString();

  try {
    const adminClient = createAdminClient();

    // Query hourly aggregated usage
    const { data: usageData, error: usageError } = await adminClient
      .from('api_usage_hourly')
      .select('*')
      .gte('hour_timestamp', cutoffTime)
      .order('hour_timestamp', { ascending: true });

    if (usageError) {
      throw usageError;
    }

    // Query keys for key mapping
    const { data: keysData } = await adminClient
      .from('api_keys')
      .select('id, name, developer_name');

    const keyMap = new Map<string, { name: string; developer_name: string }>();
    for (const k of (keysData || [])) {
      keyMap.set(k.id, { name: k.name, developer_name: k.developer_name });
    }

    let totalRequests = 0;
    let status2xx = 0;
    let status4xx = 0;
    let status5xx = 0;
    let status429 = 0;
    let errorCount = 0;
    let rateLimitEvents = 0;
    const combinedHistogram = createEmptyHistogram();
    const endpointBreakdown: Record<string, number> = {
      '/api/v1/matches/live': 0,
      '/api/v1/matches/fixtures': 0,
    };

    const hourlyMap = new Map<string, { requests: number; errors: number; rateLimits: number }>();
    const keyUsageMap = new Map<string, { requests: number; errors: number; rateLimits: number }>();

    for (const row of (usageData || [])) {
      const count = Number(row.total_requests) || 0;
      const rateLimits = Number(row.rate_limit_events) || 0;
      const errors = Number(row.error_count) || 0;

      totalRequests += count;
      rateLimitEvents += rateLimits;
      errorCount += errors;

      if (row.status_group === '2xx') status2xx += count;
      else if (row.status_group === '4xx') status4xx += count;
      else if (row.status_group === '5xx') status5xx += count;
      else if (row.status_group === '429') status429 += count;

      if (endpointBreakdown[row.endpoint] !== undefined) {
        endpointBreakdown[row.endpoint] += count;
      } else {
        endpointBreakdown[row.endpoint] = count;
      }

      // Add latency buckets
      if (Array.isArray(row.latency_buckets)) {
        for (let i = 0; i < 18; i++) {
          combinedHistogram[i] += Number(row.latency_buckets[i]) || 0;
        }
      }

      // Hourly timeline aggregation
      const hourKey = row.hour_timestamp;
      const hEntry = hourlyMap.get(hourKey) || { requests: 0, errors: 0, rateLimits: 0 };
      hEntry.requests += count;
      hEntry.errors += errors;
      hEntry.rateLimits += rateLimits;
      hourlyMap.set(hourKey, hEntry);

      // Per-key aggregation
      const kId = row.api_key_id;
      const kEntry = keyUsageMap.get(kId) || { requests: 0, errors: 0, rateLimits: 0 };
      kEntry.requests += count;
      kEntry.errors += errors;
      kEntry.rateLimits += rateLimits;
      keyUsageMap.set(kId, kEntry);
    }

    const p50LatencyMs = interpolatePercentile(combinedHistogram, 0.50);
    const p95LatencyMs = interpolatePercentile(combinedHistogram, 0.95);

    const hourlyTimeline = Array.from(hourlyMap.entries()).map(([hour, val]) => ({
      hour,
      requests: val.requests,
      errors: val.errors,
      rateLimits: val.rateLimits,
    }));

    const keyUsageBreakdown = Array.from(keyUsageMap.entries()).map(([kId, val]) => {
      const meta = keyMap.get(kId);
      return {
        keyId: kId,
        keyName: meta?.name || 'Unknown Key',
        developerName: meta?.developer_name || 'Unknown Developer',
        requests: val.requests,
        errors: val.errors,
        rateLimits: val.rateLimits,
      };
    });

    return {
      success: true,
      data: {
        timeRange,
        totalRequests,
        status2xx,
        status4xx,
        status5xx,
        status429,
        errorCount,
        rateLimitEvents,
        p50LatencyMs,
        p95LatencyMs,
        endpointBreakdown,
        hourlyTimeline,
        keyUsageBreakdown,
      },
    };
  } catch (err: any) {
    console.error('[Admin Action] getApiAnalyticsAction error:', err);
    return { success: false, error: err?.message || 'Failed to fetch API analytics.' };
  }
}

export async function previewRetentionCleanupAction(
  retentionDays: number = 90
): Promise<ActionResponse<any>> {
  await requireAdminSession();
  try {
    const adminClient = createAdminClient();
    const { data, error } = await adminClient.rpc('preview_expired_api_analytics', {
      p_retention_days: retentionDays,
    });

    if (error) {
      throw error;
    }

    return { success: true, data };
  } catch (err: any) {
    console.error('[Admin Action] previewRetentionCleanupAction error:', err);
    return { success: false, error: err?.message || 'Failed to preview retention cleanup.' };
  }
}

export async function executeRetentionCleanupAction(
  retentionDays: number = 90,
  allowShortRetention: boolean = false
): Promise<ActionResponse<{ message: string }>> {
  await requireAdminSession();
  try {
    const adminClient = createAdminClient();
    const { error } = await adminClient.rpc('cleanup_expired_api_analytics', {
      p_retention_days: retentionDays,
      p_allow_short_retention: allowShortRetention,
    });

    if (error) {
      throw error;
    }

    return {
      success: true,
      data: { message: `Successfully executed retention cleanup for data older than ${retentionDays} days.` },
    };
  } catch (err: any) {
    console.error('[Admin Action] executeRetentionCleanupAction error:', err);
    return { success: false, error: err?.message || 'Failed to execute retention cleanup.' };
  }
}
