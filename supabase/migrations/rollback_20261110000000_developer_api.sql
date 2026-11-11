-- =========================================================================
-- ZimKickOff — Developer API Master Schema Rollback
-- Script: rollback_20261110000000_developer_api.sql
-- Target Schema: public
-- Reverts: 20261110000000_developer_api.sql
-- Status: PREPARED ROLLBACK ARTIFACT — EXECUTE ONLY UPON ROLLBACK INVOCATION
-- =========================================================================

BEGIN;

-- 1. DROP STORED FUNCTIONS IN REVERSE DEPENDENCY ORDER
DROP FUNCTION IF EXISTS public.cleanup_expired_api_analytics(INT, BOOLEAN);
DROP FUNCTION IF EXISTS public.preview_expired_api_analytics(INT);
DROP FUNCTION IF EXISTS public.ingest_analytics_batch(UUID, TEXT, UUID[], JSONB);
DROP FUNCTION IF EXISTS public.acquire_rate_limit_lease(UUID, BIGINT, BIGINT, INT, INT, INT, UUID, INT, INT);

-- 2. DROP TABLES IN REVERSE FOREIGN KEY DEPENDENCY ORDER
DROP TABLE IF EXISTS public.api_usage_hourly CASCADE;
DROP TABLE IF EXISTS public.api_analytics_batches CASCADE;
DROP TABLE IF EXISTS public.api_rate_limit_leases CASCADE;
DROP TABLE IF EXISTS public.api_rate_limits CASCADE;
DROP TABLE IF EXISTS public.api_keys CASCADE;
DROP TABLE IF EXISTS public.api_settings CASCADE;

-- 3. REMOVE MIGRATION RECORD IF TRACKED IN SUPABASE CLI MIGRATIONS
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'supabase_migrations' AND table_name = 'schema_migrations'
    ) THEN
        DELETE FROM supabase_migrations.schema_migrations 
        WHERE version = '20261110000000';
    END IF;
END $$;

COMMIT;
