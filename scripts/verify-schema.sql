-- =========================================================================
-- ZimKickOff — Independent Schema & Security Verification Queries
-- Target Environment: Supabase SQL Editor / PostgreSQL 15+
-- Schema: public
--
-- Instructions: Execute these queries in the Supabase Cloud SQL Editor
-- following the application of candidate_migration_v2.sql to verify that
-- tables, indexes, triggers, and permissions are configured with 100% precision.
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. Table Privileges Audit
-- Expected:
--   anon: SELECT on events, event_sources ONLY.
--   authenticated: SELECT on events, event_sources ONLY.
--   admin_users: ZERO privileges for anon, authenticated, PUBLIC.
--   service_role: ALL privileges on all tables.
-- -------------------------------------------------------------------------
SELECT
    grantee,
    table_name,
    string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privileges
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('events', 'event_sources', 'admin_users')
  AND grantee IN ('anon', 'authenticated', 'PUBLIC', 'service_role')
GROUP BY grantee, table_name
ORDER BY table_name, grantee;

-- -------------------------------------------------------------------------
-- 2. Function Execution Privileges Audit
-- Expected:
--   create_event_atomic: service_role ONLY
--   update_event_atomic: service_role ONLY
--   is_admin: authenticated, service_role
--   is_superadmin: authenticated, service_role
--   chk_event_primary_source: ZERO public/anon/authenticated execution
--   chk_event_publication_sources: ZERO public/anon/authenticated execution
--   lock_event_parent: ZERO public/anon/authenticated execution
-- -------------------------------------------------------------------------
SELECT
    p.proname AS function_name,
    pg_catalog.pg_get_function_identity_arguments(p.oid) AS arguments,
    r.rolname AS grantee,
    p.prosecdef AS is_security_definer
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
CROSS JOIN pg_roles r
WHERE n.nspname = 'public'
  AND p.proname IN ('create_event_atomic', 'update_event_atomic', 'is_admin', 'is_superadmin', 'chk_event_primary_source', 'chk_event_publication_sources', 'lock_event_parent')
  AND has_function_privilege(r.oid, p.oid, 'EXECUTE')
  AND r.rolname IN ('anon', 'authenticated', 'PUBLIC', 'service_role')
ORDER BY p.proname, r.rolname;

-- -------------------------------------------------------------------------
-- 3. Constraint & Row Locking Triggers Audit
-- Expected:
--   tr_lock_parent_events: BEFORE INSERT OR UPDATE OR DELETE ON event_sources (immediate)
--   tr_enforce_primary_source: AFTER INSERT OR UPDATE OR DELETE ON event_sources (DEFERRABLE INITIALLY DEFERRED)
--   tr_enforce_event_publication: AFTER INSERT OR UPDATE ON events (DEFERRABLE INITIALLY DEFERRED)
-- -------------------------------------------------------------------------
SELECT
    tgname AS trigger_name,
    relname AS table_name,
    tgdeferrable AS is_deferrable,
    tginitdeferred AS is_initially_deferred,
    proname AS function_name
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE tgname IN ('tr_lock_parent_events', 'tr_enforce_primary_source', 'tr_enforce_event_publication')
ORDER BY relname, tgname;

-- -------------------------------------------------------------------------
-- 4. Search Path & Security Definer Integrity
-- Expected:
--   All functions must have prosecdef = true and search_path = pg_catalog, public, pg_temp
-- -------------------------------------------------------------------------
SELECT
    proname AS function_name,
    prosecdef AS is_security_definer,
    proconfig AS configuration
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN (
    'create_event_atomic',
    'update_event_atomic',
    'is_admin',
    'is_superadmin',
    'chk_event_primary_source',
    'chk_event_publication_sources',
    'lock_event_parent',
    'handle_updated_at'
  )
ORDER BY proname;

-- -------------------------------------------------------------------------
-- 5. Row Level Security Verification
-- Expected:
--   rls_enabled = true on events, event_sources, and admin_users
-- -------------------------------------------------------------------------
SELECT
    relname AS table_name,
    relrowsecurity AS rls_enabled,
    relforcerowsecurity AS rls_forced
FROM pg_class
WHERE relnamespace = 'public'::regnamespace
  AND relname IN ('events', 'event_sources', 'admin_users')
ORDER BY relname;
