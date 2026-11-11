import 'server-only';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { ApiKeyRecord } from './types';

export interface GeneratedKeyResult {
  fullKey: string;
  keyPrefix: string;
  keyHash: string;
}

export interface AuthVerificationResult {
  valid: boolean;
  statusCode?: 401;
  errorCode?: 'MISSING_API_KEY' | 'MALFORMED_API_KEY' | 'INVALID_API_KEY' | 'REVOKED_API_KEY';
  errorMessage?: string;
  keyRecord?: ApiKeyRecord;
}

interface CachedVerification {
  keyRecord: ApiKeyRecord;
  cachedAt: number;
}

// In-memory verification cache (60 seconds TTL)
const verificationCache = new Map<string, CachedVerification>();
const CACHE_TTL_MS = 60 * 1000;

/**
 * Generates a cryptographically secure Developer API key in the approved format:
 * zk_live_<prefix>_<secret>
 * - Prefix: 8 hex chars (32 bits entropy, used for O(1) DB lookup)
 * - Secret: 32 random bytes in base64url (256 bits entropy)
 */
export function generateApiKey(): GeneratedKeyResult {
  const prefixHex = crypto.randomBytes(4).toString('hex');
  const keyPrefix = `zk_live_${prefixHex}`;
  const secret = crypto.randomBytes(32).toString('base64url');
  const fullKey = `${keyPrefix}_${secret}`;
  const keyHash = hashApiKey(fullKey);

  return {
    fullKey,
    keyPrefix,
    keyHash,
  };
}

/**
 * Computes SHA-256 hex hash of the full API key string.
 */
export function hashApiKey(fullKey: string): string {
  return crypto.createHash('sha256').update(fullKey).digest('hex');
}

const KEY_REGEX = /^zk_live_([a-f0-9]{8})_([A-Za-z0-9_-]{43})$/i;

/**
 * Validates the syntactic structure of an API key string.
 */
export function isValidKeyStructure(key: string): boolean {
  if (typeof key !== 'string') return false;
  return KEY_REGEX.test(key.trim());
}

/**
 * Extracts key prefix for fast indexed database lookup.
 */
export function extractKeyPrefix(fullKey: string): string | null {
  if (typeof fullKey !== 'string') return null;
  const match = fullKey.trim().match(KEY_REGEX);
  if (!match) return null;
  return `zk_live_${match[1].toLowerCase()}`;
}

/**
 * Constant-time comparison of two 64-character SHA-256 hex strings.
 */
export function constantTimeHashCompare(hashA: string, hashB: string): boolean {
  if (typeof hashA !== 'string' || typeof hashB !== 'string') return false;
  if (hashA.length !== 64 || hashB.length !== 64) return false;
  const bufA = Buffer.from(hashA, 'hex');
  const bufB = Buffer.from(hashB, 'hex');
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Invalidates the in-memory verification cache for a revoked key or prefix.
 */
export function invalidateApiKeyCache(keyPrefixOrId?: string): void {
  if (!keyPrefixOrId) {
    verificationCache.clear();
    return;
  }
  for (const [hash, entry] of verificationCache.entries()) {
    if (entry.keyRecord.id === keyPrefixOrId || entry.keyRecord.key_prefix === keyPrefixOrId) {
      verificationCache.delete(hash);
    }
  }
}

/**
 * Verifies incoming request authentication against public developer API requirements.
 * Extracts key from Authorization: Bearer <key> or X-API-Key header.
 */
export async function verifyDeveloperApiKey(
  authHeader: string | null | undefined,
  apiKeyHeader?: string | null | undefined
): Promise<AuthVerificationResult> {
  let rawKey: string | null = null;

  if (authHeader) {
    const trimmed = authHeader.trim();
    if (trimmed.toLowerCase().startsWith('bearer ')) {
      rawKey = trimmed.slice(7).trim();
    } else {
      rawKey = trimmed;
    }
  } else if (apiKeyHeader) {
    rawKey = apiKeyHeader.trim();
  }

  if (!rawKey) {
    return {
      valid: false,
      statusCode: 401,
      errorCode: 'MISSING_API_KEY',
      errorMessage: 'Missing API key. Provide your key via Authorization: Bearer <key> header.',
    };
  }

  if (!isValidKeyStructure(rawKey)) {
    return {
      valid: false,
      statusCode: 401,
      errorCode: 'MALFORMED_API_KEY',
      errorMessage: 'Malformed API key format. Expected format: zk_live_<prefix>_<secret>.',
    };
  }

  const prefix = extractKeyPrefix(rawKey);
  if (!prefix) {
    return {
      valid: false,
      statusCode: 401,
      errorCode: 'MALFORMED_API_KEY',
      errorMessage: 'Invalid API key prefix.',
    };
  }

  const candidateHash = hashApiKey(rawKey);

  // Check in-memory verification cache first
  const cached = verificationCache.get(candidateHash);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    if (cached.keyRecord.status !== 'active') {
      return {
        valid: false,
        statusCode: 401,
        errorCode: 'REVOKED_API_KEY',
        errorMessage: 'The provided API key has been revoked.',
      };
    }
    return {
      valid: true,
      keyRecord: cached.keyRecord,
    };
  }

  try {
    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from('api_keys')
      .select('*')
      .eq('key_prefix', prefix)
      .maybeSingle();

    if (error || !data) {
      return {
        valid: false,
        statusCode: 401,
        errorCode: 'INVALID_API_KEY',
        errorMessage: 'Invalid API key. The provided key was not recognized.',
      };
    }

    const keyRecord = data as ApiKeyRecord;

    // Constant-time hash verification
    const isMatch = constantTimeHashCompare(candidateHash, keyRecord.key_hash);
    if (!isMatch) {
      return {
        valid: false,
        statusCode: 401,
        errorCode: 'INVALID_API_KEY',
        errorMessage: 'Invalid API key. Key authentication failed.',
      };
    }

    if (keyRecord.status !== 'active') {
      return {
        valid: false,
        statusCode: 401,
        errorCode: 'REVOKED_API_KEY',
        errorMessage: 'The provided API key has been revoked.',
      };
    }

    // Populate verification cache
    verificationCache.set(candidateHash, {
      keyRecord,
      cachedAt: Date.now(),
    });

    return {
      valid: true,
      keyRecord,
    };
  } catch (err) {
    // Fail closed on database authentication errors
    console.error('[API Auth] Error during key verification:', err);
    return {
      valid: false,
      statusCode: 401,
      errorCode: 'INVALID_API_KEY',
      errorMessage: 'Unable to authenticate API key at this time.',
    };
  }
}
