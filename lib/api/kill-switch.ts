import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { ApiSettingsRecord } from './types';

export interface KillSwitchCheckResult {
  enabled: boolean;
  statusCode?: 503;
  errorCode?: 'API_DISABLED' | 'API_CONFIG_UNAVAILABLE';
  message: string;
  settings?: ApiSettingsRecord;
}

interface CachedSettingsEntry {
  settings: ApiSettingsRecord;
  cachedAt: number;
}

let cachedSettingsEntry: CachedSettingsEntry | null = null;
const SETTINGS_CACHE_TTL_MS = 30 * 1000; // 30 seconds fresh TTL
const SETTINGS_STALE_MAX_MS = 10 * 60 * 1000; // 10 minutes stale window

/**
 * Checks Developer API kill switch status according to the approved precedence:
 * 1. ENABLE_DEVELOPER_API=false -> Immediate hard disable.
 * 2. Database `is_api_enabled` is authoritative if unset or enabled in environment.
 * 3. Environment 'true' MUST NOT override an administrator's database disable.
 * 4. Database unavailable without valid cached configuration -> HTTP 503.
 * 5. Existing website football endpoints remain completely unaffected.
 */
export async function checkDeveloperApiKillSwitch(): Promise<KillSwitchCheckResult> {
  const envSetting = process.env.ENABLE_DEVELOPER_API;

  // Rule 1: Immediate hard disable from environment
  if (envSetting === 'false') {
    return {
      enabled: false,
      statusCode: 503,
      errorCode: 'API_DISABLED',
      message: 'Developer API is disabled by environment configuration.',
    };
  }

  const now = Date.now();

  // Fast path: use fresh cached settings
  if (cachedSettingsEntry && now - cachedSettingsEntry.cachedAt < SETTINGS_CACHE_TTL_MS) {
    const settings = cachedSettingsEntry.settings;
    if (!settings.is_api_enabled) {
      return {
        enabled: false,
        statusCode: 503,
        errorCode: 'API_DISABLED',
        message: settings.maintenance_message || 'Developer API is currently disabled for maintenance.',
        settings,
      };
    }
    return {
      enabled: true,
      message: 'Developer API is active.',
      settings,
    };
  }

  // Fetch or refresh from database
  try {
    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from('api_settings')
      .select('*')
      .eq('id', 'master')
      .maybeSingle();

    if (error || !data) {
      throw error || new Error('No master api_settings record found');
    }

    const settings = data as ApiSettingsRecord;
    cachedSettingsEntry = {
      settings,
      cachedAt: now,
    };

    // Rule 2 & 3: Database is_api_enabled is authoritative; env=true cannot override disable
    if (!settings.is_api_enabled) {
      return {
        enabled: false,
        statusCode: 503,
        errorCode: 'API_DISABLED',
        message: settings.maintenance_message || 'Developer API is currently disabled for maintenance.',
        settings,
      };
    }

    return {
      enabled: true,
      message: 'Developer API is active.',
      settings,
    };
  } catch (err) {
    console.warn('[API Kill-Switch] Database check failed, evaluating cached fallbacks:', err);

    // Rule 4: If database is down but stale cache exists within safety window, serve stale
    if (cachedSettingsEntry && now - cachedSettingsEntry.cachedAt < SETTINGS_STALE_MAX_MS) {
      const staleSettings = cachedSettingsEntry.settings;
      if (!staleSettings.is_api_enabled) {
        return {
          enabled: false,
          statusCode: 503,
          errorCode: 'API_DISABLED',
          message: staleSettings.maintenance_message || 'Developer API is currently disabled for maintenance.',
          settings: staleSettings,
        };
      }
      return {
        enabled: true,
        message: 'Developer API is active (stale configuration).',
        settings: staleSettings,
      };
    }

    // Fail closed: No valid cached configuration and database unreachable
    return {
      enabled: false,
      statusCode: 503,
      errorCode: 'API_CONFIG_UNAVAILABLE',
      message: 'Developer API configuration is temporarily unavailable. Please retry shortly.',
    };
  }
}

/**
 * Utility to clear the in-memory settings cache (used when admin toggles the switch).
 */
export function invalidateApiSettingsCache(): void {
  cachedSettingsEntry = null;
}
