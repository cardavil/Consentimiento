-- Platform internal users (admin/analyst) — completely separate from tenants
-- Admin has full access, analyst has granular permissions assigned by admin

-- ============================================================
--  TABLES
-- ============================================================

CREATE TABLE platform_users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_user_id    UUID NOT NULL UNIQUE,
    email           TEXT NOT NULL UNIQUE,
    first_name      TEXT NOT NULL DEFAULT '',
    last_name       TEXT NOT NULL DEFAULT '',
    doc_type        TEXT,
    doc_number      TEXT,
    phone           TEXT,
    role            TEXT NOT NULL CHECK (role IN ('admin', 'analyst')),
    active          BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE platform_permissions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES platform_users(id) ON DELETE CASCADE,
    permission      TEXT NOT NULL CHECK (permission IN (
        'read:tenants',
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
--  MODIFY get_tenant_id() — guard against platform users
-- ============================================================

CREATE OR REPLACE FUNCTION get_tenant_id()
RETURNS UUID AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    IF (auth.jwt()->'app_metadata'->>'platform_role') IS NOT NULL THEN
        RETURN NULL;
    END IF;

    v_tenant_id := (auth.jwt()->'app_metadata'->>'tenant_id')::UUID;
    IF v_tenant_id IS NOT NULL THEN
        RETURN v_tenant_id;
    END IF;
    RETURN (
        SELECT id FROM tenants
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
--  RLS — modify existing policies for admin cross-tenant access
-- ============================================================

-- tenants: admin can view all, update all
DROP POLICY "tenant_select_own" ON tenants;
CREATE POLICY "tenant_select_own_or_admin" ON tenants
    FOR SELECT USING (id = get_tenant_id() OR has_platform_permission('read:tenants'));

DROP POLICY "tenant_update_own" ON tenants;
CREATE POLICY "tenant_update_own_or_admin" ON tenants
    FOR UPDATE USING (id = get_tenant_id() OR is_platform_admin());

-- audit_log: admin/analyst can view all
DROP POLICY IF EXISTS "audit_select_own" ON audit_log;
CREATE POLICY "audit_select_own_or_admin" ON audit_log
    FOR SELECT USING (tenant_id = get_tenant_id() OR has_platform_permission('read:audit_log'));

-- signing_sessions_results: admin/analyst can view all (metadata only, no signer data)
DROP POLICY "results_select_own" ON signing_sessions_results;
CREATE POLICY "results_select_own_or_admin" ON signing_sessions_results
    FOR SELECT USING (
        tenant_id = get_tenant_id()
        OR access_token = current_setting('request.headers', true)::json->>'x-access-token'
        OR has_platform_permission('read:sessions')
    );

-- catalog_doc_types: admin/analyst with write:catalogs can manage
CREATE POLICY "catalog_doc_types_admin_manage" ON catalog_doc_types
    FOR ALL USING (has_platform_permission('write:catalogs'))
    WITH CHECK (has_platform_permission('write:catalogs'));
