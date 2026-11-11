import 'server-only';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { getHistogramBinIndex, createEmptyHistogram } from './types';

export interface RawApiEvent {
  apiKeyId: string;
  endpoint: '/api/v1/matches/live' | '/api/v1/matches/fixtures';
  statusCode: number;
  latencyMs: number;
  timestamp: number;
}

interface HourlyAggregateItem {
  apiKeyId: string;
  endpoint: string;
  statusGroup: '2xx' | '4xx' | '5xx' | '429';
  hourTimestamp: string;
  count: number;
  rateLimitCount: number;
  errorCount: number;
  buckets: number[];
}

const MAX_BUFFER_CAPACITY = 1000;
const FLUSH_THRESHOLD = 500;
const FLUSH_INTERVAL_MS = 10 * 1000; // 10 seconds
const SPOOL_FILE = path.join('/tmp', `zk_analytics_spool_${process.pid}.jsonl`);

let memoryBuffer: RawApiEvent[] = [];
let flushTimer: NodeJS.Timeout | null = null;
let isFlushing = false;

/**
 * Maps HTTP status code to status group string.
 */
function getStatusGroup(statusCode: number): '2xx' | '4xx' | '5xx' | '429' {
  if (statusCode === 429) return '429';
  if (statusCode >= 200 && statusCode < 300) return '2xx';
  if (statusCode >= 400 && statusCode < 500) return '4xx';
  return '5xx';
}

/**
 * Spools raw events to local disk when memory buffer capacity is exceeded
 * or during process termination.
 */
function spoolEventsToDisk(events: RawApiEvent[]): void {
  try {
    const lines = events.map((e) => JSON.stringify(e)).join('\n') + '\n';
    fs.appendFileSync(SPOOL_FILE, lines, 'utf8');
  } catch (err) {
    console.error('[Analytics] Failed to write to disk spool:', err);
  }
}

/**
 * Reads and clears spooled events from the local disk spool.
 */
function readAndClearDiskSpool(): RawApiEvent[] {
  if (!fs.existsSync(SPOOL_FILE)) return [];
  try {
    const content = fs.readFileSync(SPOOL_FILE, 'utf8');
    fs.unlinkSync(SPOOL_FILE);
    const lines = content.trim().split('\n');
    const recovered: RawApiEvent[] = [];
    for (const line of lines) {
      if (line.trim()) {
        try {
          recovered.push(JSON.parse(line));
        } catch {
          // ignore corrupted lines
        }
      }
    }
    return recovered;
  } catch (err) {
    console.warn('[Analytics] Error recovering disk spool:', err);
    return [];
  }
}

/**
 * Aggregates a list of raw events into hourly 18-bin histogram summaries.
 */
function aggregateEvents(events: RawApiEvent[]): {
  aggregates: HourlyAggregateItem[];
  activeKeyIds: string[];
} {
  const map = new Map<string, HourlyAggregateItem>();
  const activeKeysSet = new Set<string>();

  for (const ev of events) {
    if (!ev.apiKeyId) continue;
    activeKeysSet.add(ev.apiKeyId);

    const statusGroup = getStatusGroup(ev.statusCode);
    const hourTimestamp = new Date(Math.floor(ev.timestamp / 3600000) * 3600000).toISOString();
    const groupKey = `${ev.apiKeyId}::${ev.endpoint}::${statusGroup}::${hourTimestamp}`;

    let item = map.get(groupKey);
    if (!item) {
      item = {
        apiKeyId: ev.apiKeyId,
        endpoint: ev.endpoint,
        statusGroup,
        hourTimestamp,
        count: 0,
        rateLimitCount: 0,
        errorCount: 0,
        buckets: createEmptyHistogram(),
      };
      map.set(groupKey, item);
    }

    item.count += 1;
    if (statusGroup === '429') {
      item.rateLimitCount += 1;
    }
    if (statusGroup === '4xx' || statusGroup === '5xx') {
      item.errorCount += 1;
    }

    const bin = getHistogramBinIndex(ev.latencyMs);
    item.buckets[bin] += 1;
  }

  return {
    aggregates: Array.from(map.values()),
    activeKeyIds: Array.from(activeKeysSet),
  };
}

/**
 * Flushes all pending in-memory and spooled events into Supabase Cloud via idempotent batch ingestion.
 */
export async function flushAnalyticsBatch(): Promise<void> {
  if (isFlushing) return;
  isFlushing = true;

  try {
    // 1. Recover any events from disk spool
    const spooled = readAndClearDiskSpool();
    const currentMemory = memoryBuffer;
    memoryBuffer = [];

    const allEvents = [...spooled, ...currentMemory];
    if (allEvents.length === 0) {
      isFlushing = false;
      return;
    }

    const { aggregates, activeKeyIds } = aggregateEvents(allEvents);
    if (aggregates.length === 0) {
      isFlushing = false;
      return;
    }

    const batchId = crypto.randomUUID();
    const workerId = process.env.HOSTNAME || `pm2-worker-${process.pid}`;

    const adminClient = createAdminClient();
    const { error } = await adminClient.rpc('ingest_analytics_batch', {
      p_batch_id: batchId,
      p_worker_id: workerId,
      p_active_key_ids: activeKeyIds,
      p_aggregates: aggregates,
    });

    if (error) {
      console.error('[Analytics] Batch ingestion RPC failed:', error);
      // Re-spool failed batch to disk to prevent data loss on transient DB errors
      spoolEventsToDisk(allEvents);
    }
  } catch (err) {
    console.error('[Analytics] Unexpected error during batch flush:', err);
  } finally {
    isFlushing = false;
  }
}

/**
 * Records an API request execution event into the bounded buffer.
 * Non-blocking fast path (< 0.05ms overhead).
 */
export function recordApiEvent(event: RawApiEvent): void {
  // Never record secrets, headers, client IPs or stream manifests
  if (memoryBuffer.length >= MAX_BUFFER_CAPACITY) {
    // Spill over oldest chunk to disk spool to protect memory ceiling
    const spillover = memoryBuffer.splice(0, 500);
    spoolEventsToDisk(spillover);
  }

  memoryBuffer.push(event);

  if (memoryBuffer.length >= FLUSH_THRESHOLD) {
    flushAnalyticsBatch().catch((err) => {
      console.warn('[Analytics] Threshold flush error:', err);
    });
  }

  // Ensure periodic flush timer is active
  if (!flushTimer) {
    flushTimer = setInterval(() => {
      flushAnalyticsBatch().catch((err) => {
        console.warn('[Analytics] Interval flush error:', err);
      });
    }, FLUSH_INTERVAL_MS);
    if (typeof flushTimer.unref === 'function') {
      flushTimer.unref();
    }
  }
}

// Register PM2 graceful shutdown handlers to flush on SIGTERM/SIGINT
if (typeof process !== 'undefined') {
  const gracefulShutdown = async (signal: string) => {
    console.log(`[Analytics] Received ${signal}, flushing buffer...`);
    if (flushTimer) clearInterval(flushTimer);
    if (memoryBuffer.length > 0) {
      spoolEventsToDisk(memoryBuffer);
      memoryBuffer = [];
    }
  };

  process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.once('SIGINT', () => gracefulShutdown('SIGINT'));
}
