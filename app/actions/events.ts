'use server';

import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { normalizeAndValidateStreamUrl } from '@/lib/validation/stream-url';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';

// Input constraints
const MAX_SOURCES_COUNT = 20;

export const SourceInputSchema = z.object({
  name: z.string().trim().min(1, 'Source name is required').max(100, 'Source name too long'),
  stream_type: z.enum(['youtube', 'hls']),
  stream_url: z.string().trim().min(1, 'Stream URL is required').max(1000, 'Stream URL too long'),
  is_primary: z.boolean().default(false),
  display_order: z.number().int().min(0).max(100).default(0),
});

export const EventCreateSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(200, 'Title cannot exceed 200 characters'),
  slug: z
    .string()
    .trim()
    .min(3, 'Slug must be at least 3 characters')
    .max(100, 'Slug cannot exceed 100 characters')
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with optional single hyphens between words'),
  description: z.string().trim().max(5000, 'Description too long').optional().nullable(),
  category: z.string().trim().min(2, 'Category must be at least 2 characters').max(50, 'Category cannot exceed 50 characters').default('Special Event'),
  banner_url: z
    .string()
    .trim()
    .regex(/^https:\/\/.+/, 'Banner URL must begin with https://')
    .optional()
    .nullable()
    .or(z.literal('')),
  start_time: z.string().datetime({ message: 'Start time must be a valid ISO datetime' }),
  end_time: z.string().datetime({ message: 'End time must be a valid ISO datetime' }).optional().nullable().or(z.literal('')),
  publication_status: z.enum(['draft', 'published', 'archived']).default('draft'),
  broadcast_status: z.enum(['upcoming', 'live', 'concluded']).default('upcoming'),
  sources: z.array(SourceInputSchema).max(MAX_SOURCES_COUNT, `Maximum ${MAX_SOURCES_COUNT} stream sources permitted`).default([]),
}).refine(
  (data) => {
    if (data.end_time && data.end_time !== '') {
      return new Date(data.end_time).getTime() > new Date(data.start_time).getTime();
    }
    return true;
  },
  {
    message: 'End time must be after start time',
    path: ['end_time'],
  }
);

export const EventUpdateSchema = EventCreateSchema.and(
  z.object({
    id: z.string().uuid('Invalid event UUID format'),
    expected_version: z.number().int().min(1, 'Expected version must be >= 1'),
  })
);

export type ActionResponse<T = unknown> = {
  success: boolean;
  status: number;
  error?: string;
  message?: string;
  details?: unknown;
  data?: T;
};

/**
 * Gatekeeper helper: authenticates user session and verifies admin allowlist.
 */
async function verifyAdminAuthorization(): Promise<{ userId: string } | ActionResponse> {
  let supabase;
  try {
    supabase = await createServerClient();
  } catch (err: any) {
    return {
      success: false,
      status: 500,
      error: 'CONFIG_ERROR',
      message: 'Server configuration error initializing authentication.',
    };
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      success: false,
      status: 401,
      error: 'UNAUTHENTICATED',
      message: 'Authentication required. Please log in to continue.',
    };
  }

  // Server-side admin verification using privileged client to prevent RLS recursion
  const adminClient = createAdminClient();
  const { data: adminRecord, error: adminError } = await adminClient
    .from('admin_users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (adminError || !adminRecord || !['admin', 'superadmin'].includes(adminRecord.role)) {
    return {
      success: false,
      status: 403,
      error: 'FORBIDDEN',
      message: 'Access denied: You do not possess administrator privileges.',
    };
  }

  return { userId: user.id };
}

/**
 * Maps database RPC errors cleanly to structured HTTP responses without misclassification.
 */
function mapDatabaseError(rpcError: any): ActionResponse {
  const msg = rpcError.message || '';
  const code = rpcError.code || '';

  // 1. Slug Conflict
  if (msg.includes('ERR_DUPLICATE_SLUG') || rpcError.details?.includes('uq_events_slug')) {
    return {
      success: false,
      status: 409,
      error: 'SLUG_CONFLICT',
      message: 'An event with this URL slug already exists. Please choose a different slug.',
    };
  }

  // 2. Duplicate Display Order
  if (msg.includes('ERR_DUPLICATE_DISPLAY_ORDER') || rpcError.details?.includes('uq_event_sources_order')) {
    return {
      success: false,
      status: 422,
      error: 'DUPLICATE_ORDER',
      message: 'Each stream source must have a unique display order number.',
    };
  }

  // 3. Primary Source Required
  if (msg.includes('ERR_PRIMARY_SOURCE_REQUIRED') || rpcError.details?.includes('uq_event_sources_single_primary')) {
    return {
      success: false,
      status: 422,
      error: 'PRIMARY_REQUIRED',
      message: 'When stream sources are configured, exactly one must be marked as the primary source.',
    };
  }

  // 4. Published Requires Source
  if (msg.includes('ERR_PUBLISHED_REQUIRES_SOURCE')) {
    return {
      success: false,
      status: 422,
      error: 'SOURCE_REQUIRED',
      message: 'A published event must have at least one stream source configured before publishing.',
    };
  }

  // 5. Concurrency / Stale Version
  if (code === 'P0004' || msg.includes('ERR_STALE_VERSION')) {
    return {
      success: false,
      status: 409,
      error: 'STALE_VERSION',
      message: 'This event was modified concurrently by another session. Please refresh and review latest changes.',
    };
  }

  // 6. Not Found
  if (code === 'P0002' || msg.includes('ERR_EVENT_NOT_FOUND')) {
    return {
      success: false,
      status: 404,
      error: 'NOT_FOUND',
      message: 'The requested event record was not found.',
    };
  }

  // 7. Time Order Violation
  if (msg.includes('chk_events_time_order')) {
    return {
      success: false,
      status: 422,
      error: 'TIME_ORDER_INVALID',
      message: 'Event end time must be after start time.',
    };
  }

  // 8. General check violation
  if (code === '23514') {
    return {
      success: false,
      status: 422,
      error: 'INVARIANT_VIOLATION',
      message: msg.replace(/ERROR:\s*/, '').split('\n')[0] || 'Database constraint violation.',
    };
  }

  // 9. Unauthorized in SQL
  if (code === '42501' || msg.includes('ERR_UNAUTHORIZED')) {
    return {
      success: false,
      status: 403,
      error: 'FORBIDDEN',
      message: 'Database authorization rejected.',
    };
  }

  // Default sanitization
  console.error('[EventAction Database Error]:', rpcError);
  return {
    success: false,
    status: 500,
    error: 'DATABASE_ERROR',
    message: 'An unexpected database error occurred. Details have been logged.',
  };
}

/**
 * Server Action: Create Standalone Event
 */
export async function createEventAction(payload: unknown): Promise<ActionResponse> {
  // 1. Authenticate & Authorize
  const auth = await verifyAdminAuthorization();
  if ('success' in auth && !auth.success) {
    return auth;
  }
  const { userId } = auth as { userId: string };

  // 2. Syntactic Zod Validation
  const parsed = EventCreateSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      success: false,
      status: 422,
      error: 'VALIDATION_ERROR',
      message: 'Form validation failed. Please check your inputs.',
      details: parsed.error.issues,
    };
  }

  const { data } = parsed;

  // 3. Normalize and Validate Stream URLs (Anti-SSRF)
  let normalizedSources;
  try {
    normalizedSources = data.sources.map((s, idx) => ({
      ...s,
      stream_url: normalizeAndValidateStreamUrl(s.stream_url, s.stream_type),
      display_order: s.display_order ?? idx,
    }));
  } catch (urlErr: any) {
    return {
      success: false,
      status: 400,
      error: 'INVALID_STREAM_URL',
      message: urlErr.message || 'Stream URL validation failed.',
    };
  }

  // 4. Execute Atomic Stored Procedure via Privileged Client
  try {
    const adminSupabase = createAdminClient();
    const { data: event, error: rpcError } = await adminSupabase.rpc('create_event_atomic', {
      p_title: data.title,
      p_slug: data.slug,
      p_description: data.description || null,
      p_category: data.category,
      p_banner_url: data.banner_url || null,
      p_start_time: data.start_time,
      p_end_time: data.end_time || null,
      p_publication_status: data.publication_status,
      p_broadcast_status: data.broadcast_status,
      p_created_by: userId, // Cryptographically verified identity
      p_sources: normalizedSources,
    });

    if (rpcError) {
      return mapDatabaseError(rpcError);
    }

    revalidatePath('/live');
    revalidatePath(`/event/${data.slug}`);
    revalidatePath('/admin/events');

    return {
      success: true,
      status: 201,
      message: 'Event successfully created.',
      data: event,
    };
  } catch (err: any) {
    console.error('[createEventAction Unexpected Error]:', err);
    return {
      success: false,
      status: 500,
      error: 'INTERNAL_ERROR',
      message: 'Internal server error while creating event.',
    };
  }
}

/**
 * Server Action: Update Standalone Event
 */
export async function updateEventAction(payload: unknown): Promise<ActionResponse> {
  // 1. Authenticate & Authorize
  const auth = await verifyAdminAuthorization();
  if ('success' in auth && !auth.success) {
    return auth;
  }

  // 2. Syntactic Zod Validation
  const parsed = EventUpdateSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      success: false,
      status: 422,
      error: 'VALIDATION_ERROR',
      message: 'Form validation failed. Please check your inputs.',
      details: parsed.error.issues,
    };
  }

  const { data } = parsed;

  // 3. Normalize and Validate Stream URLs (Anti-SSRF)
  let normalizedSources;
  try {
    normalizedSources = data.sources.map((s, idx) => ({
      ...s,
      stream_url: normalizeAndValidateStreamUrl(s.stream_url, s.stream_type),
      display_order: s.display_order ?? idx,
    }));
  } catch (urlErr: any) {
    return {
      success: false,
      status: 400,
      error: 'INVALID_STREAM_URL',
      message: urlErr.message || 'Stream URL validation failed.',
    };
  }

  // 4. Execute Atomic Stored Procedure via Privileged Client
  try {
    const adminSupabase = createAdminClient();
    const { data: event, error: rpcError } = await adminSupabase.rpc('update_event_atomic', {
      p_event_id: data.id,
      p_expected_version: data.expected_version,
      p_title: data.title,
      p_slug: data.slug,
      p_description: data.description || null,
      p_category: data.category,
      p_banner_url: data.banner_url || null,
      p_start_time: data.start_time,
      p_end_time: data.end_time || null,
      p_publication_status: data.publication_status,
      p_broadcast_status: data.broadcast_status,
      p_sources: normalizedSources,
    });

    if (rpcError) {
      return mapDatabaseError(rpcError);
    }

    revalidatePath('/live');
    revalidatePath(`/event/${data.slug}`);
    revalidatePath('/admin/events');

    return {
      success: true,
      status: 200,
      message: 'Event successfully updated.',
      data: event,
    };
  } catch (err: any) {
    console.error('[updateEventAction Unexpected Error]:', err);
    return {
      success: false,
      status: 500,
      error: 'INTERNAL_ERROR',
      message: 'Internal server error while updating event.',
    };
  }
}

/**
 * Server Action: Delete Standalone Event
 */
export async function deleteEventAction(eventId: string): Promise<ActionResponse> {
  const auth = await verifyAdminAuthorization();
  if ('success' in auth && !auth.success) {
    return auth;
  }

  if (!z.string().uuid().safeParse(eventId).success) {
    return {
      success: false,
      status: 400,
      error: 'INVALID_ID',
      message: 'Invalid event identifier format.',
    };
  }

  try {
    const adminSupabase = createAdminClient();
    const { data: event, error: fetchError } = await adminSupabase
      .from('events')
      .select('slug')
      .eq('id', eventId)
      .single();

    if (fetchError || !event) {
      return {
        success: false,
        status: 404,
        error: 'NOT_FOUND',
        message: 'Event to delete does not exist.',
      };
    }

    const { error: deleteError } = await adminSupabase
      .from('events')
      .delete()
      .eq('id', eventId);

    if (deleteError) {
      return mapDatabaseError(deleteError);
    }

    revalidatePath('/live');
    revalidatePath(`/event/${event.slug}`);
    revalidatePath('/admin/events');

    return {
      success: true,
      status: 200,
      message: 'Event successfully deleted.',
    };
  } catch (err: any) {
    console.error('[deleteEventAction Unexpected Error]:', err);
    return {
      success: false,
      status: 500,
      error: 'INTERNAL_ERROR',
      message: 'Internal error deleting event.',
    };
  }
}
