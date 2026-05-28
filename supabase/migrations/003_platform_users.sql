-- Platform internal users (admin/analyst) — completely separate from organizations
-- Admin has full access, analyst has granular permissions assigned by admin

-- ============================================================
--  TABLES
-- ============================================================

CREATE TABLE platform_users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_user_id    UUID NOT NULL UNIQUE,
    email           TEXT NOT NULL UNIQUE,
    name            TEXT NOT NULL,
    role            TEXT NOT NULL CHECK (role IN ('admin', 'analyst')),
    active          BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE platform_permissions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES platform_users(id) ON DELETE CASCADE,
    permission      TEXT NOT NULL CHECK (permission IN (
        'read:orgs',
        'read:audit_log',
        'read:sessions',
        'read:catalogs',
        'write:catalogs',
        'read:metrics'
    )),
    granted_by      UUID REFERENCES platform_users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, permission)
);

CREATE INDEX idx_platform_users_auth ON platform_users(auth_user_id);
CREATE INDEX idx_platform_permissions_user ON platform_permissions(user_id);

CREATE TRIGGER trg_platform_users_updated
    BEFORE UPDATE ON platform_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
--  HELPER FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION is_platform_user()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (auth.jwt()->'app_metadata'->>'platform_role') IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (auth.jwt()->'app_metadata'->>'platform_role') = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION has_platform_permission(p_permission TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    IF is_platform_admin() THEN RETURN true; END IF;

    RETURN EXISTS (
        SELECT 1 FROM platform_permissions pp
        JOIN platform_users pu ON pu.id = pp.user_id
        WHERE pu.auth_user_id = auth.uid()
          AND pu.active = true
          AND pp.permission = p_permission
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================
--  MODIFY get_org_id() — guard against platform users
-- ============================================================

CREATE OR REPLACE FUNCTION get_org_id()
RETURNS UUID AS $$
DECLARE
    v_org_id UUID;
BEGIN
    IF (auth.jwt()->'app_metadata'->>'platform_role') IS NOT NULL THEN
        RETURN NULL;
    END IF;

    v_org_id := (auth.jwt()->'app_metadata'->>'org_id')::UUID;
    IF v_org_id IS NOT NULL THEN
        RETURN v_org_id;
    END IF;
    RETURN (
        SELECT id FROM organizations
        WHERE email = auth.jwt()->>'email'
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================
--  RLS — new tables
-- ============================================================

ALTER TABLE platform_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pu_select" ON platform_users
    FOR SELECT USING (auth_user_id = auth.uid() OR is_platform_admin());

CREATE POLICY "pu_insert" ON platform_users
    FOR INSERT WITH CHECK (is_platform_admin());

CREATE POLICY "pu_update" ON platform_users
    FOR UPDATE USING (is_platform_admin());

CREATE POLICY "pu_delete" ON platform_users
    FOR DELETE USING (is_platform_admin());

CREATE POLICY "pp_select" ON platform_permissions
    FOR SELECT USING (
        user_id IN (SELECT id FROM platform_users WHERE auth_user_id = auth.uid())
        OR is_platform_admin()
    );

CREATE POLICY "pp_insert" ON platform_permissions
    FOR INSERT WITH CHECK (is_platform_admin());

CREATE POLICY "pp_delete" ON platform_permissions
    FOR DELETE USING (is_platform_admin());

-- ============================================================
--  RLS — modify existing policies for admin cross-org access
-- ============================================================

-- organizations: admin can view all, update all
DROP POLICY "org_select_own" ON organizations;
CREATE POLICY "org_select_own_or_admin" ON organizations
    FOR SELECT USING (id = get_org_id() OR has_platform_permission('read:orgs'));

DROP POLICY "org_update_own" ON organizations;
CREATE POLICY "org_update_own_or_admin" ON organizations
    FOR UPDATE USING (id = get_org_id() OR is_platform_admin());

-- audit_log: admin/analyst can view all
DROP POLICY IF EXISTS "audit_select_own" ON audit_log;
CREATE POLICY "audit_select_own_or_admin" ON audit_log
    FOR SELECT USING (organization_id = get_org_id() OR has_platform_permission('read:audit_log'));

-- signing_sessions_results: admin/analyst can view all (metadata only, no signer data)
DROP POLICY "results_select_own" ON signing_sessions_results;
CREATE POLICY "results_select_own_or_admin" ON signing_sessions_results
    FOR SELECT USING (
        organization_id = get_org_id()
        OR access_token = current_setting('request.headers', true)::json->>'x-access-token'
        OR has_platform_permission('read:sessions')
    );

-- catalog_doc_types: admin/analyst with write:catalogs can manage
CREATE POLICY "catalog_doc_types_admin_manage" ON catalog_doc_types
    FOR ALL USING (has_platform_permission('write:catalogs'))
    WITH CHECK (has_platform_permission('write:catalogs'));
