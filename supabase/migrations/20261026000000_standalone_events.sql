-- =========================================================================
-- ZimKickOff — Standalone Events Master Remediation Migration (v2.1)
-- Target Environment: Supabase / PostgreSQL 15+
-- Schema: public
-- Baseline Commit: 8c47deb2ea7aa233189e0d9745198b971b91f9f6
-- =========================================================================

-- 1. EXTENSIONS & SCHEMA PRIVILEGES
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Revoke default CREATE from public schema to prevent object shadowing
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Revoke default execute on all newly created functions in public schema
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- 2. AUTOMATED UPDATED_AT TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- 3. SCHEMA ASSERTIONS & SAFE TABLE CREATION

-- Ensure no conflicting incompatible tables exist
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'events'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'version'
        ) THEN
            RAISE EXCEPTION 'MIGRATION_ASSERTION_FAILED: Pre-existing public.events table is incompatible with standalone events schema (missing version column).';
        END IF;
    END IF;
END $$;

-- Admin allowlist table (accessible exclusively to service_role and security definers)
CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'superadmin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Standalone live events table
CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL CHECK (length(trim(title)) >= 3 AND length(title) <= 200),
    slug TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL DEFAULT 'Special Event' CHECK (length(trim(category)) >= 2 AND length(category) <= 50),
    banner_url TEXT CHECK (banner_url IS NULL OR banner_url ~ '^https://.+'),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    publication_status TEXT NOT NULL DEFAULT 'draft' CHECK (publication_status IN ('draft', 'published', 'archived')),
    broadcast_status TEXT NOT NULL DEFAULT 'upcoming' CHECK (broadcast_status IN ('upcoming', 'live', 'concluded')),
    version INT NOT NULL DEFAULT 1 CHECK (version >= 1),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_events_slug UNIQUE (slug),
    CONSTRAINT chk_events_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) BETWEEN 3 AND 100),
    CONSTRAINT chk_events_time_order CHECK (end_time IS NULL OR end_time > start_time)
);

-- Stream sources table (stores clean normalized URLs)
CREATE TABLE IF NOT EXISTS public.event_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (length(trim(name)) >= 1 AND length(name) <= 100),
    stream_type TEXT NOT NULL CHECK (stream_type IN ('youtube', 'hls')),
    stream_url TEXT NOT NULL CHECK (stream_url ~ '^https://.+'),
    is_primary BOOLEAN NOT NULL DEFAULT false,
    display_order INT NOT NULL DEFAULT 0 CHECK (display_order >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_event_sources_order UNIQUE (event_id, display_order) DEFERRABLE INITIALLY DEFERRED
);

-- Automated updated_at triggers
DROP TRIGGER IF EXISTS tr_admin_users_updated_at ON public.admin_users;
CREATE TRIGGER tr_admin_users_updated_at
BEFORE UPDATE ON public.admin_users
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS tr_events_updated_at ON public.events;
CREATE TRIGGER tr_events_updated_at
BEFORE UPDATE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS tr_event_sources_updated_at ON public.event_sources;
CREATE TRIGGER tr_event_sources_updated_at
BEFORE UPDATE ON public.event_sources
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Partial unique index: at most one primary source per event
CREATE UNIQUE INDEX IF NOT EXISTS uq_event_sources_single_primary
ON public.event_sources (event_id) WHERE (is_primary = true);

-- Performance query indexes
CREATE INDEX IF NOT EXISTS idx_events_pub_start
ON public.events (publication_status, start_time DESC);

CREATE INDEX IF NOT EXISTS idx_event_sources_event_id_order
ON public.event_sources (event_id, display_order ASC);

-- 4. CONCURRENCY-SAFE INVARIANT TRIGGERS

-- Function 4A: Deterministically lock parent event rows BEFORE source modification to prevent foreign key deadlocks (40P01)
CREATE OR REPLACE FUNCTION public.lock_event_parent()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_event_id UUID;
BEGIN
    FOR v_event_id IN
        SELECT DISTINCT eid FROM (
            VALUES (CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN OLD.event_id ELSE NULL END),
                   (CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN NEW.event_id ELSE NULL END)
        ) AS t(eid) WHERE eid IS NOT NULL
        ORDER BY eid ASC
    LOOP
        PERFORM 1 FROM public.events WHERE id = v_event_id FOR UPDATE;
    END LOOP;
    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS tr_lock_parent_events ON public.event_sources;
CREATE TRIGGER tr_lock_parent_events
BEFORE INSERT OR UPDATE OR DELETE ON public.event_sources
FOR EACH ROW EXECUTE FUNCTION public.lock_event_parent();

-- Function 4B: Check primary source invariant on event_sources mutations with deterministic parent row locking
CREATE OR REPLACE FUNCTION public.chk_event_primary_source()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_event_id UUID;
    v_total_sources INT;
    v_primary_sources INT;
    v_pub_status TEXT;
BEGIN
    -- Evaluate affected event IDs in deterministic ascending UUID order to prevent deadlocks
    FOR v_event_id IN
        SELECT DISTINCT eid FROM (
            VALUES (CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN OLD.event_id ELSE NULL END),
                   (CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN NEW.event_id ELSE NULL END)
        ) AS t(eid) WHERE eid IS NOT NULL
        ORDER BY eid ASC
    LOOP
        -- Acquire exclusive row lock on the parent event to serialize concurrent source modifications
        PERFORM 1 FROM public.events WHERE id = v_event_id FOR UPDATE;

        -- If parent event does not exist (e.g. cascade delete in progress), skip verification
        SELECT publication_status INTO v_pub_status
        FROM public.events
        WHERE id = v_event_id;

        IF FOUND THEN
            SELECT
                COUNT(*),
                COUNT(*) FILTER (WHERE is_primary = true)
            INTO v_total_sources, v_primary_sources
            FROM public.event_sources
            WHERE event_id = v_event_id;

            -- Invariant 1: If sources exist, exactly one must be primary
            IF v_total_sources > 0 AND v_primary_sources <> 1 THEN
                RAISE EXCEPTION 'ERR_PRIMARY_SOURCE_REQUIRED: Event % has % stream sources but % are marked primary. Exactly one primary source is required.',
                    v_event_id, v_total_sources, v_primary_sources
                    USING ERRCODE = '23514'; -- check_violation
            END IF;

            -- Invariant 2: If zero sources, zero primary
            IF v_total_sources = 0 AND v_primary_sources > 0 THEN
                RAISE EXCEPTION 'ERR_PRIMARY_SOURCE_REQUIRED: Event % has zero sources but % are marked primary.',
                    v_event_id, v_primary_sources
                    USING ERRCODE = '23514';
            END IF;

            -- Invariant 3: Published event cannot have zero sources
            IF v_pub_status = 'published' AND v_total_sources = 0 THEN
                RAISE EXCEPTION 'ERR_PUBLISHED_REQUIRES_SOURCE: Published event % must have at least one stream source.',
                    v_event_id
                    USING ERRCODE = '23514';
            END IF;
        END IF;
    END LOOP;

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS tr_enforce_primary_source ON public.event_sources;
CREATE CONSTRAINT TRIGGER tr_enforce_primary_source
AFTER INSERT OR UPDATE OR DELETE ON public.event_sources
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.chk_event_primary_source();

-- Function 4C: Check publication source invariant on events mutations
CREATE OR REPLACE FUNCTION public.chk_event_publication_sources()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_total_sources INT;
    v_primary_sources INT;
BEGIN
    IF NEW.publication_status = 'published' THEN
        SELECT
            COUNT(*),
            COUNT(*) FILTER (WHERE is_primary = true)
        INTO v_total_sources, v_primary_sources
        FROM public.event_sources
        WHERE event_id = NEW.id;

        IF v_total_sources = 0 OR v_primary_sources <> 1 THEN
            RAISE EXCEPTION 'ERR_PUBLISHED_REQUIRES_SOURCE: Cannot publish event % because it has % sources (% primary). At least one source with exactly one primary is required.',
                NEW.id, v_total_sources, v_primary_sources
                USING ERRCODE = '23514';
        END IF;
    END IF;

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS tr_enforce_event_publication ON public.events;
CREATE CONSTRAINT TRIGGER tr_enforce_event_publication
AFTER INSERT OR UPDATE OF publication_status ON public.events
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.chk_event_publication_sources();

-- 5. TABLE PERMISSIONS & ROW LEVEL SECURITY

-- Revoke mutation rights from browser roles completely
REVOKE ALL ON TABLE public.events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.event_sources FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.admin_users FROM PUBLIC, anon, authenticated;

-- Grant SELECT only to browser roles for public reading (filtered by RLS)
GRANT SELECT ON public.events TO anon, authenticated;
GRANT SELECT ON public.event_sources TO anon, authenticated;
-- Note: admin_users receives ZERO grants for browser roles (anon, authenticated).
-- All admin verification is executed server-side via service_role or security definers.

-- Service role retains full database permissions
GRANT ALL ON TABLE public.events TO service_role;
GRANT ALL ON TABLE public.event_sources TO service_role;
GRANT ALL ON TABLE public.admin_users TO service_role;

-- Enable RLS
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_sources ENABLE ROW LEVEL SECURITY;

-- Helper security definer functions for RLS checks (non-recursive, minimal disclosure)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.admin_users
        WHERE id = (SELECT auth.uid())
    );
$$;

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.admin_users
        WHERE id = (SELECT auth.uid()) AND role = 'superadmin'
    );
$$;

-- RLS Policies on events (SELECT only)
DROP POLICY IF EXISTS "Public can view published events" ON public.events;
CREATE POLICY "Public can view published events"
ON public.events FOR SELECT TO anon, authenticated
USING (publication_status = 'published');

DROP POLICY IF EXISTS "Admins can view all events" ON public.events;
CREATE POLICY "Admins can view all events"
ON public.events FOR SELECT TO authenticated
USING (public.is_admin());

-- RLS Policies on event_sources (SELECT only)
DROP POLICY IF EXISTS "Public can view sources for published events" ON public.event_sources;
CREATE POLICY "Public can view sources for published events"
ON public.event_sources FOR SELECT TO anon, authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.id = event_sources.event_id AND e.publication_status = 'published'
    )
);

DROP POLICY IF EXISTS "Admins can view all sources" ON public.event_sources;
CREATE POLICY "Admins can view all sources"
ON public.event_sources FOR SELECT TO authenticated
USING (public.is_admin());

-- 6. ATOMIC MUTATION STORED PROCEDURES (SERVICE-ROLE ONLY)

-- Procedure 6A: Create Event Atomic
CREATE OR REPLACE FUNCTION public.create_event_atomic(
    p_title TEXT,
    p_slug TEXT,
    p_description TEXT,
    p_category TEXT,
    p_banner_url TEXT,
    p_start_time TIMESTAMPTZ,
    p_end_time TIMESTAMPTZ,
    p_publication_status TEXT,
    p_broadcast_status TEXT,
    p_created_by UUID,
    p_sources JSONB
)
RETURNS public.events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_event public.events;
    v_source RECORD;
    v_source_count INT := 0;
    v_primary_count INT := 0;
    v_distinct_orders INT := 0;
BEGIN
    -- 1. Validate creator exists in admin_users allowlist if specified
    IF p_created_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.admin_users WHERE id = p_created_by) THEN
        RAISE EXCEPTION 'ERR_UNAUTHORIZED: Creator % is not in admin_users allowlist', p_created_by
            USING ERRCODE = '42501'; -- insufficient_privilege
    END IF;

    -- 2. Explicit slug uniqueness check to prevent ambiguity with display order violations
    IF EXISTS (SELECT 1 FROM public.events WHERE slug = p_slug) THEN
        RAISE EXCEPTION 'ERR_DUPLICATE_SLUG: An event with slug "%" already exists.', p_slug
            USING ERRCODE = '23505'; -- unique_violation
    END IF;

    -- 3. Validate JSONB sources structure
    IF p_sources IS NOT NULL AND jsonb_typeof(p_sources) <> 'null' THEN
        IF jsonb_typeof(p_sources) <> 'array' THEN
            RAISE EXCEPTION 'ERR_INVALID_SOURCES_PAYLOAD: Sources payload must be a JSON array'
                USING ERRCODE = '22023'; -- invalid_parameter_value
        END IF;
        v_source_count := jsonb_array_length(p_sources);
    ELSE
        v_source_count := 0;
    END IF;

    -- 4. Invariant: Published event requires at least one source
    IF p_publication_status = 'published' AND v_source_count = 0 THEN
        RAISE EXCEPTION 'ERR_PUBLISHED_REQUIRES_SOURCE: Cannot publish an event without at least one stream source.'
            USING ERRCODE = '23514'; -- check_violation
    END IF;

    -- 5. Invariant: Non-empty source list requires exactly one primary and unique display orders
    IF v_source_count > 0 THEN
        SELECT
            COUNT(*) FILTER (WHERE COALESCE((elem->>'is_primary')::boolean, false) = true),
            COUNT(DISTINCT COALESCE((elem->>'display_order')::int, 0))
        INTO v_primary_count, v_distinct_orders
        FROM jsonb_array_elements(p_sources) AS elem;

        IF v_primary_count <> 1 THEN
            RAISE EXCEPTION 'ERR_PRIMARY_SOURCE_REQUIRED: Exactly one stream source must be marked primary (found %)', v_primary_count
                USING ERRCODE = '23514';
        END IF;

        IF v_distinct_orders <> v_source_count THEN
            RAISE EXCEPTION 'ERR_DUPLICATE_DISPLAY_ORDER: Duplicate display_order detected in sources list'
                USING ERRCODE = '23505'; -- unique_violation
        END IF;
    END IF;

    -- 6. Insert event core row
    INSERT INTO public.events (
        title,
        slug,
        description,
        category,
        banner_url,
        start_time,
        end_time,
        publication_status,
        broadcast_status,
        created_by
    ) VALUES (
        p_title,
        p_slug,
        p_description,
        COALESCE(p_category, 'Special Event'),
        p_banner_url,
        p_start_time,
        p_end_time,
        COALESCE(p_publication_status, 'draft'),
        COALESCE(p_broadcast_status, 'upcoming'),
        p_created_by
    ) RETURNING * INTO v_event;

    -- 7. Insert sources
    IF v_source_count > 0 THEN
        FOR v_source IN SELECT * FROM jsonb_to_recordset(p_sources) AS x(
            name TEXT,
            stream_type TEXT,
            stream_url TEXT,
            is_primary BOOLEAN,
            display_order INT
        ) LOOP
            IF v_source.name IS NULL OR length(trim(v_source.name)) = 0 THEN
                RAISE EXCEPTION 'ERR_INVALID_SOURCE_NAME: Stream source name cannot be empty' USING ERRCODE = '22023';
            END IF;
            IF v_source.stream_type NOT IN ('youtube', 'hls') THEN
                RAISE EXCEPTION 'ERR_INVALID_STREAM_TYPE: Stream type must be youtube or hls' USING ERRCODE = '22023';
            END IF;
            IF v_source.stream_url IS NULL OR v_source.stream_url !~ '^https://.+' THEN
                RAISE EXCEPTION 'ERR_INVALID_STREAM_URL: Stream URL must begin with https://' USING ERRCODE = '22023';
            END IF;

            INSERT INTO public.event_sources (
                event_id,
                name,
                stream_type,
                stream_url,
                is_primary,
                display_order
            ) VALUES (
                v_event.id,
                trim(v_source.name),
                v_source.stream_type,
                trim(v_source.stream_url),
                COALESCE(v_source.is_primary, false),
                COALESCE(v_source.display_order, 0)
            );
        END LOOP;
    END IF;

    RETURN v_event;
END;
$$;

-- Procedure 6B: Update Event Atomic with Concurrency Version Check
CREATE OR REPLACE FUNCTION public.update_event_atomic(
    p_event_id UUID,
    p_expected_version INT,
    p_title TEXT,
    p_slug TEXT,
    p_description TEXT,
    p_category TEXT,
    p_banner_url TEXT,
    p_start_time TIMESTAMPTZ,
    p_end_time TIMESTAMPTZ,
    p_publication_status TEXT,
    p_broadcast_status TEXT,
    p_sources JSONB
)
RETURNS public.events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_event public.events;
    v_source RECORD;
    v_source_count INT := 0;
    v_primary_count INT := 0;
    v_distinct_orders INT := 0;
BEGIN
    -- 1. Acquire row lock on target event
    SELECT * INTO v_event FROM public.events WHERE id = p_event_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ERR_EVENT_NOT_FOUND: Event % not found', p_event_id
            USING ERRCODE = 'P0002'; -- no_data_found
    END IF;

    -- 2. Concurrency version check
    IF v_event.version <> p_expected_version THEN
        RAISE EXCEPTION 'ERR_STALE_VERSION: Expected version %, but current version is %',
            p_expected_version, v_event.version
            USING ERRCODE = 'P0004'; -- assert_failure / conflict
    END IF;

    -- 3. Explicit slug uniqueness check for other events
    IF EXISTS (SELECT 1 FROM public.events WHERE slug = p_slug AND id <> p_event_id) THEN
        RAISE EXCEPTION 'ERR_DUPLICATE_SLUG: An event with slug "%" already exists.', p_slug
            USING ERRCODE = '23505'; -- unique_violation
    END IF;

    -- 4. Validate JSONB sources structure
    IF p_sources IS NOT NULL AND jsonb_typeof(p_sources) <> 'null' THEN
        IF jsonb_typeof(p_sources) <> 'array' THEN
            RAISE EXCEPTION 'ERR_INVALID_SOURCES_PAYLOAD: Sources payload must be a JSON array'
                USING ERRCODE = '22023';
        END IF;
        v_source_count := jsonb_array_length(p_sources);
    ELSE
        v_source_count := 0;
    END IF;

    -- 5. Invariant: Published event requires at least one source
    IF p_publication_status = 'published' AND v_source_count = 0 THEN
        RAISE EXCEPTION 'ERR_PUBLISHED_REQUIRES_SOURCE: Cannot publish an event without at least one stream source.'
            USING ERRCODE = '23514';
    END IF;

    -- 6. Invariant: Non-empty source list requires exactly one primary and unique display orders
    IF v_source_count > 0 THEN
        SELECT
            COUNT(*) FILTER (WHERE COALESCE((elem->>'is_primary')::boolean, false) = true),
            COUNT(DISTINCT COALESCE((elem->>'display_order')::int, 0))
        INTO v_primary_count, v_distinct_orders
        FROM jsonb_array_elements(p_sources) AS elem;

        IF v_primary_count <> 1 THEN
            RAISE EXCEPTION 'ERR_PRIMARY_SOURCE_REQUIRED: Exactly one stream source must be marked primary (found %)', v_primary_count
                USING ERRCODE = '23514';
        END IF;

        IF v_distinct_orders <> v_source_count THEN
            RAISE EXCEPTION 'ERR_DUPLICATE_DISPLAY_ORDER: Duplicate display_order detected in sources list'
                USING ERRCODE = '23505';
        END IF;
    END IF;

    -- 7. Update event metadata & increment version
    UPDATE public.events
    SET
        title = p_title,
        slug = p_slug,
        description = p_description,
        category = COALESCE(p_category, 'Special Event'),
        banner_url = p_banner_url,
        start_time = p_start_time,
        end_time = p_end_time,
        publication_status = p_publication_status,
        broadcast_status = p_broadcast_status,
        version = version + 1
    WHERE id = p_event_id
    RETURNING * INTO v_event;

    -- 8. Replace sources atomically
    DELETE FROM public.event_sources WHERE event_id = p_event_id;

    IF v_source_count > 0 THEN
        FOR v_source IN SELECT * FROM jsonb_to_recordset(p_sources) AS x(
            name TEXT,
            stream_type TEXT,
            stream_url TEXT,
            is_primary BOOLEAN,
            display_order INT
        ) LOOP
            IF v_source.name IS NULL OR length(trim(v_source.name)) = 0 THEN
                RAISE EXCEPTION 'ERR_INVALID_SOURCE_NAME: Stream source name cannot be empty' USING ERRCODE = '22023';
            END IF;
            IF v_source.stream_type NOT IN ('youtube', 'hls') THEN
                RAISE EXCEPTION 'ERR_INVALID_STREAM_TYPE: Stream type must be youtube or hls' USING ERRCODE = '22023';
            END IF;
            IF v_source.stream_url IS NULL OR v_source.stream_url !~ '^https://.+' THEN
                RAISE EXCEPTION 'ERR_INVALID_STREAM_URL: Stream URL must begin with https://' USING ERRCODE = '22023';
            END IF;

            INSERT INTO public.event_sources (
                event_id,
                name,
                stream_type,
                stream_url,
                is_primary,
                display_order
            ) VALUES (
                p_event_id,
                trim(v_source.name),
                v_source.stream_type,
                trim(v_source.stream_url),
                COALESCE(v_source.is_primary, false),
                COALESCE(v_source.display_order, 0)
            );
        END LOOP;
    END IF;

    RETURN v_event;
END;
$$;

-- 7. FUNCTION EXECUTION PRIVILEGES (EXACT SIGNATURES)

-- Revoke default public execution
REVOKE ALL ON FUNCTION public.handle_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.lock_event_parent() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.chk_event_primary_source() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.chk_event_publication_sources() FROM PUBLIC, anon, authenticated;

-- Helper functions for RLS
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_superadmin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_superadmin() TO authenticated, service_role;

-- Mutation functions (service_role ONLY)
REVOKE ALL ON FUNCTION public.create_event_atomic(TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, UUID, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_event_atomic(TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, UUID, JSONB) TO service_role;

REVOKE ALL ON FUNCTION public.update_event_atomic(UUID, INT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_event_atomic(UUID, INT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, JSONB) TO service_role;
