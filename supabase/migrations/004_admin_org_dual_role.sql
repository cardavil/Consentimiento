-- Allow admin users to also have an org_id (dual identity)
-- Move platform_role guard AFTER org_id fast-path

CREATE OR REPLACE FUNCTION get_org_id()
RETURNS UUID AS $$
DECLARE
    v_org_id UUID;
BEGIN
    -- Fast path: org_id from JWT (works for org users AND admin-with-org)
    v_org_id := (auth.jwt()->'app_metadata'->>'org_id')::UUID;
    IF v_org_id IS NOT NULL THEN
        RETURN v_org_id;
    END IF;

    -- Platform users without org_id get NULL (no email fallback for them)
    IF (auth.jwt()->'app_metadata'->>'platform_role') IS NOT NULL THEN
        RETURN NULL;
    END IF;

    -- Email fallback only for org users who don't have org_id set yet
    RETURN (
        SELECT id FROM organizations
        WHERE email = auth.jwt()->>'email'
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
