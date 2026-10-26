-- =========================================================================
-- ZimKickOff — Owner-Controlled Superadmin Provisioning Script
-- Target Environment: Supabase SQL Editor
-- Schema: auth & public
--
-- INSTRUCTIONS FOR REPOSITORY OWNER:
-- 1. Invite the intended administrator through the Supabase Dashboard
--    (Authentication -> Users -> Invite User) using email: nyashamadeko@gmail.com.
-- 2. Once the user accepts the invitation or exists in auth.users, execute this script
--    in the Supabase SQL Editor.
-- 3. This script will verify that the user exists in auth.users, insert/update
--    public.admin_users with role 'superadmin', and perform read-back verification.
-- =========================================================================

DO $$
DECLARE
    v_user_id UUID;
    v_target_email CONSTANT TEXT := 'nyashamadeko@gmail.com';
    v_verified_role TEXT;
BEGIN
    -- 1. Confirm the target identity exists in auth.users
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE lower(email) = lower(v_target_email);

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'PROVISIONING_FAILED: Target email "%" does not exist in auth.users. Please invite the administrator through Supabase Auth dashboard before running this provisioning script.',
            v_target_email
            USING ERRCODE = 'P0002'; -- no_data_found
    END IF;

    -- 2. Explicitly provision the user in public.admin_users with role 'superadmin'
    INSERT INTO public.admin_users (id, email, role, created_at, updated_at)
    VALUES (v_user_id, lower(v_target_email), 'superadmin', now(), now())
    ON CONFLICT (id) DO UPDATE
    SET role = 'superadmin',
        email = lower(v_target_email),
        updated_at = now();

    -- 3. Fail-explicit read-back verification check
    SELECT role INTO v_verified_role
    FROM public.admin_users
    WHERE id = v_user_id AND lower(email) = lower(v_target_email);

    IF v_verified_role <> 'superadmin' THEN
        RAISE EXCEPTION 'PROVISIONING_VERIFICATION_FAILED: Database state mismatch for superadmin "%". Expected role "superadmin", found "%"',
            v_target_email, v_verified_role;
    END IF;

    RAISE NOTICE 'PROVISIONING_SUCCESS: Successfully verified and provisioned % (UUID: %) as superadmin.',
        v_target_email, v_user_id;
END;
$$;
