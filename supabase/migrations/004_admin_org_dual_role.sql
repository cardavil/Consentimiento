-- Allow admin users to also have a tenant_id (dual identity)
-- Move platform_role guard AFTER tenant_id fast-path

CREATE OR REPLACE FUNCTION get_tenant_id()
RETURNS UUID AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    -- Fast path: tenant_id from JWT (works for tenant users AND admin-with-tenant)
    v_tenant_id := (auth.jwt()->'app_metadata'->>'tenant_id')::UUID;
    IF v_tenant_id IS NOT NULL THEN
        RETURN v_tenant_id;
    END IF;

    -- Platform users without tenant_id get NULL (no email fallback for them)
    IF (auth.jwt()->'app_metadata'->>'platform_role') IS NOT NULL THEN
        RETURN NULL;
    END IF;

    -- Email fallback only for tenant users who don't have tenant_id set yet
    RETURN (
        SELECT id FROM tenants
        WHERE email = auth.jwt()->>'email'
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
