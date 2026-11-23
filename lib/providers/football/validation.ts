import 'server-only';
import {
  AllowedPlayerStatGroup,
  FootballProviderError,
} from './types';

const NUMERIC_ID_REGEX = /^\d{1,12}$/;
const DATE_YYYYMMDD_REGEX = /^\d{8}$/;

export const ALLOWED_PLAYER_STAT_GROUPS: readonly AllowedPlayerStatGroup[] = [
  'goals',
  'shots',
  'saves',
  'fouls',
] as const;

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Strictly validates a numeric provider identifier (Eid, CompId, TeamId, Aid).
 * Prevents SSRF, path traversal, and arbitrary URL injection.
 */
export function assertValidNumericId(id: unknown, label: string): string {
  if (typeof id !== 'string' && typeof id !== 'number') {
    throw new FootballProviderError(
      'INVALID_INPUT',
      `Invalid ${label}: expected numeric string.`,
      { statusCode: 400, isTransient: false }
    );
  }
  const normalized = String(id).trim();
  if (!NUMERIC_ID_REGEX.test(normalized)) {
    throw new FootballProviderError(
      'INVALID_INPUT',
      `Invalid ${label} "${normalized.slice(0, 32)}": must match /^\\d{1,12}$/.`,
      { statusCode: 400, isTransient: false }
    );
  }
  return normalized;
}

/**
 * Strictly validates a YYYYMMDD date string and verifies calendar validity.
 */
export function assertValidDateYYYYMMDD(date: unknown): string {
  if (typeof date !== 'string') {
    throw new FootballProviderError(
      'INVALID_INPUT',
      'Invalid date: expected YYYYMMDD string.',
      { statusCode: 400, isTransient: false }
    );
  }
  const normalized = date.trim();
  if (!DATE_YYYYMMDD_REGEX.test(normalized)) {
    throw new FootballProviderError(
      'INVALID_INPUT',
      `Invalid date "${normalized.slice(0, 16)}": expected YYYYMMDD format.`,
      { statusCode: 400, isTransient: false }
    );
  }

  const yyyy = Number(normalized.slice(0, 4));
  const mm = Number(normalized.slice(4, 6));
  const dd = Number(normalized.slice(6, 8));
  const parsed = new Date(Date.UTC(yyyy, mm - 1, dd));
  if (
    isNaN(parsed.getTime()) ||
    parsed.getUTCFullYear() !== yyyy ||
    parsed.getUTCMonth() !== mm - 1 ||
    parsed.getUTCDate() !== dd
  ) {
    throw new FootballProviderError(
      'INVALID_INPUT',
      `Invalid calendar date "${normalized}".`,
      { statusCode: 400, isTransient: false }
    );
  }
  return normalized;
}

/**
 * Validates player stat group against the verified allowlist.
 * Explicitly blocks "assists" which returns Cloudflare 502 HTML upstream.
 */
export function assertValidStatGroup(group: unknown): AllowedPlayerStatGroup {
  if (typeof group !== 'string') {
    throw new FootballProviderError(
      'INVALID_INPUT',
      'Invalid player stat group: expected string.',
      { statusCode: 400, isTransient: false }
    );
  }
  const normalized = group.trim().toLowerCase();
  if (normalized === 'assists') {
    throw new FootballProviderError(
      'BLOCKED_ENDPOINT',
      'Player stat group "assists" is blocked: upstream returns HTTP 502 HTML.',
      { statusCode: 501, isTransient: false }
    );
  }
  if (!(ALLOWED_PLAYER_STAT_GROUPS as readonly string[]).includes(normalized)) {
    throw new FootballProviderError(
      'INVALID_INPUT',
      `Unsupported player stat group "${normalized.slice(0, 24)}". Allowed: ${ALLOWED_PLAYER_STAT_GROUPS.join(', ')}.`,
      { statusCode: 400, isTransient: false }
    );
  }
  return normalized as AllowedPlayerStatGroup;
}

export function looksLikeHtmlDocument(text: string): boolean {
  const sample = text.trimStart().slice(0, 200).toLowerCase();
  return (
    sample.startsWith('<!doctype html') ||
    sample.startsWith('<html') ||
    sample.startsWith('<head') ||
    sample.startsWith('<!--')
  );
}

/**
 * Validates an upstream HTTP Response:
 * - Rejects non-2xx statuses (explicitly distinguishing Cloudflare HTML 502s).
 * - Enforces JSON Content-Type.
 * - Rejects HTML error bodies even if mislabeled as 200.
 * - Parses JSON safely and verifies root is a non-null JSON object.
 */
export async function parseAndValidateJsonResponse(
  res: Response,
  endpointLabel: string
): Promise<Record<string, unknown>> {
  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  const bodyText = await res.text();
  const isHtml = contentType.includes('text/html') || looksLikeHtmlDocument(bodyText);

  if (!res.ok) {
    if (res.status === 404) {
      throw new FootballProviderError(
        'NOT_FOUND',
        `Upstream resource not found for ${endpointLabel} (HTTP 404).`,
        { statusCode: 404, isTransient: false }
      );
    }

    if (res.status === 429) {
      const retryAfterRaw = res.headers.get('retry-after');
      const retryAfter = retryAfterRaw ? Math.max(1, parseInt(retryAfterRaw, 10) || 30) : 30;
      throw new FootballProviderError(
        'UPSTREAM_HTTP_ERROR',
        `Upstream rate limit exceeded for ${endpointLabel} (HTTP 429).`,
        { statusCode: 429, retryAfter, isTransient: true }
      );
    }

    if (isHtml || res.status === 502) {
      throw new FootballProviderError(
        'UPSTREAM_HTML_ERROR',
        `Upstream returned HTTP ${res.status} HTML error page for ${endpointLabel}.`,
        { statusCode: 502, retryAfter: 15, isTransient: res.status >= 500 }
      );
    }

    throw new FootballProviderError(
      'UPSTREAM_HTTP_ERROR',
      `Upstream returned HTTP ${res.status} for ${endpointLabel}.`,
      { statusCode: res.status >= 500 ? 503 : res.status, isTransient: res.status >= 500 }
    );
  }

  if (isHtml) {
    throw new FootballProviderError(
      'UPSTREAM_HTML_ERROR',
      `Upstream returned unexpected HTML body with HTTP ${res.status} for ${endpointLabel}.`,
      { statusCode: 502, isTransient: true }
    );
  }

  if (!contentType.includes('application/json') && !contentType.includes('+json')) {
    throw new FootballProviderError(
      'UPSTREAM_INVALID_CONTENT_TYPE',
      `Upstream returned unsupported Content-Type "${contentType || 'missing'}" for ${endpointLabel}.`,
      { statusCode: 502, isTransient: true }
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    throw new FootballProviderError(
      'UPSTREAM_MALFORMED_JSON',
      `Upstream returned malformed JSON for ${endpointLabel}.`,
      { statusCode: 502, isTransient: true }
    );
  }

  if (!isPlainObject(parsed)) {
    throw new FootballProviderError(
      'UPSTREAM_SCHEMA_INVALID',
      `Upstream JSON root must be an object for ${endpointLabel}.`,
      { statusCode: 502, isTransient: false }
    );
  }

  return parsed;
}

/**
 * Parses a required non-empty string field. Throws UPSTREAM_SCHEMA_INVALID if missing/blank.
 */
export function requireNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  throw new FootballProviderError(
    'UPSTREAM_SCHEMA_INVALID',
    `Missing or invalid required string field "${fieldName}".`,
    { statusCode: 502, isTransient: false }
  );
}

/**
 * Returns trimmed non-empty string or null. Never returns empty strings.
 */
export function optionalNonEmptyString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

/**
 * Parses an optional finite number. Preserves genuine 0; returns null for
 * undefined, null, empty strings, NaN, or Infinity.
 */
export function optionalFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Parses an optional non-negative integer (e.g. score, rank, attendance, height).
 * Preserves genuine 0; rejects negative or non-integer values as null.
 */
export function optionalNonNegativeInt(value: unknown): number | null {
  const num = optionalFiniteNumber(value);
  if (num === null || num < 0 || !Number.isInteger(num)) return null;
  return num;
}

/**
 * Parses an optional integer (can be negative, e.g. goalDifference).
 * Preserves genuine 0; rejects NaN or non-integer floats.
 */
export function optionalInt(value: unknown): number | null {
  const num = optionalFiniteNumber(value);
  if (num === null || !Number.isInteger(num)) return null;
  return num;
}
