-- ============================================================
--  CONSENTIA — SCHEMA
--  Multi-tenant · Single sign · Zero-knowledge
--  Tablas + índices + triggers + RLS. Usa las funciones de 001.
-- ============================================================

-- ============================================================
--  1. TENANTS (clientes inscritos: natural / jurídica)
-- ============================================================
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type TEXT NOT NULL CHECK (type IN ('natural', 'juridica')),
    first_name TEXT NOT NULL,
    last_name TEXT,
    doc_type TEXT NOT NULL CHECK (doc_type IN ('CC','CE','PA','PEP','PPT','TI','NIT')),
    doc_number TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT NOT NULL,
    position TEXT,
    company_name TEXT,
    company_nit TEXT,
    plan TEXT NOT NULL DEFAULT 'trial' CHECK (plan IN ('trial','basic','pro','enterprise')),
    active BOOLEAN NOT NULL DEFAULT true,
    folio_prefix TEXT NOT NULL DEFAULT 'FC',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
--  2. TENANT_OAUTH
-- ============================================================
CREATE TABLE tenant_oauth (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('google_workspace','microsoft_365')),
    access_token BYTEA,
    refresh_token BYTEA,
    token_expires_at TIMESTAMPTZ,
    last_refreshed_at TIMESTAMPTZ,
    drive_folder_id TEXT,
    history_sheet_id TEXT,
    history_sheets JSONB NOT NULL DEFAULT '{}',
    sender_email TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
--  3. TENANT_SMS_CONFIG
-- ============================================================
CREATE TABLE tenant_sms_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
    gateway_url TEXT,
    api_key BYTEA,
    hmac_secret BYTEA,
    enabled BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
--  4. TENANT_WHATSAPP_CONFIG (Fase 3)
-- ============================================================
CREATE TABLE tenant_whatsapp_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
    phone_number_id TEXT,
    waba_id TEXT,
    access_token BYTEA,        -- encrypted (pgp_sym_encrypt)
    display_phone TEXT,
    enabled BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
--  5. CONSENT_ITEMS
-- ============================================================
CREATE TABLE consent_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    required BOOLEAN NOT NULL DEFAULT false,
    sort_order INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, code)
);

-- ============================================================
--  6. SIGNING_TEMPLATES (Fase 2 — editor visual)
--     Antes de signing_sessions_results por el FK template_id.
-- ============================================================
CREATE TABLE signing_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    source_file_name TEXT,
    page_count INTEGER,
    fields JSONB NOT NULL DEFAULT '[]',
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
--  7. SIGNING_SESSIONS_RESULTS — registro permanente, zero-knowledge
-- ============================================================
CREATE TABLE signing_sessions_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    signer_type TEXT NOT NULL CHECK (signer_type IN ('natural','natural_represented','juridica')),
    session_type TEXT NOT NULL DEFAULT 'consent' CHECK (session_type IN ('consent','signature')),
    otp_channel TEXT NOT NULL DEFAULT 'email' CHECK (otp_channel IN ('email','sms','whatsapp')),
    template_id UUID REFERENCES signing_templates(id) ON DELETE SET NULL,
    access_token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
    token_expires_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending','opened','reviewing','awaiting_otp','completed','expired','cancelled'
    )),
    folio TEXT,
    pdf_hash TEXT,
    consent_hashes JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL
);

-- ============================================================
--  8. SIGNING_SESSIONS_TEMP — datos en tránsito, se borra al completar
-- ============================================================
CREATE TABLE signing_sessions_temp (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES signing_sessions_results(id) ON DELETE CASCADE,
    documents JSONB NOT NULL DEFAULT '[]',
    consents JSONB NOT NULL DEFAULT '[]',
    signer JSONB NOT NULL DEFAULT '{}',
    fields JSONB,
    context TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
--  9. OTP_TOKENS
-- ============================================================
CREATE TABLE otp_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    purpose TEXT NOT NULL CHECK (purpose IN ('login','register','sign')),
    attempts INTEGER NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ NOT NULL,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
--  10. FOLIO_SEQUENCE
-- ============================================================
CREATE TABLE folio_sequence (
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    code TEXT NOT NULL,
    year INTEGER NOT NULL,
    seq INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (tenant_id, code, year)
);

-- ============================================================
--  11. AUDIT_LOG
-- ============================================================
CREATE TABLE audit_log (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id),
    event_type TEXT NOT NULL,
    event_data JSONB DEFAULT '{}',
    ip INET,
    ua TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
--  12. PLATFORM_USERS / PLATFORM_PERMISSIONS (admin/analyst internos)
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
    position        TEXT,
    company_name    TEXT,
    company_nit     TEXT,
    role            TEXT NOT NULL CHECK (role IN ('admin', 'analyst')),
    active          BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE platform_permissions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES platform_users(id) ON DELETE CASCADE,
    permission      TEXT NOT NULL CHECK (permission IN (
        'read:tenants','read:audit_log','read:sessions','read:catalogs','write:catalogs','read:metrics'
    )),
    granted_by      UUID REFERENCES platform_users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, permission)
);

-- ============================================================
--  INDEXES
-- ============================================================
CREATE INDEX idx_consent_items_tenant ON consent_items(tenant_id);
CREATE INDEX idx_signing_templates_tenant ON signing_templates(tenant_id);
CREATE INDEX idx_sessions_temp_session ON signing_sessions_temp(session_id);
CREATE INDEX idx_sessions_results_tenant ON signing_sessions_results(tenant_id);
CREATE INDEX idx_sessions_results_token ON signing_sessions_results(access_token);
CREATE INDEX idx_sessions_results_status ON signing_sessions_results(status);
CREATE INDEX idx_sessions_results_folio ON signing_sessions_results(folio);
CREATE INDEX idx_results_session_type ON signing_sessions_results(session_type);
CREATE INDEX idx_otp_email ON otp_tokens(email);
CREATE INDEX idx_otp_purpose ON otp_tokens(email, purpose);
CREATE INDEX idx_audit_tenant ON audit_log(tenant_id);
CREATE INDEX idx_audit_type ON audit_log(event_type);
CREATE INDEX idx_audit_created ON audit_log(created_at);
CREATE INDEX idx_platform_users_auth ON platform_users(auth_user_id);
CREATE INDEX idx_platform_permissions_user ON platform_permissions(user_id);

-- ============================================================
--  TRIGGERS (update_updated_at + auth token defaults; ver 001)
-- ============================================================
CREATE TRIGGER trg_tenants_updated BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_tenant_oauth_updated BEFORE UPDATE ON tenant_oauth
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_tenant_sms_config_updated BEFORE UPDATE ON tenant_sms_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_tenant_whatsapp_config_updated BEFORE UPDATE ON tenant_whatsapp_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_consent_items_updated BEFORE UPDATE ON consent_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_signing_templates_updated BEFORE UPDATE ON signing_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_platform_users_updated BEFORE UPDATE ON platform_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_fix_auth_token_defaults BEFORE INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION fix_auth_user_token_defaults();

-- ============================================================
--  ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_oauth ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_sms_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_whatsapp_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE signing_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE signing_sessions_temp ENABLE ROW LEVEL SECURITY;
ALTER TABLE signing_sessions_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE folio_sequence ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_permissions ENABLE ROW LEVEL SECURITY;

-- tenants: el inscrito ve/edita el suyo; admin con permiso ve/edita todos. INSERT solo service_role.
CREATE POLICY "tenant_select_own_or_admin" ON tenants
    FOR SELECT USING (id = get_tenant_id() OR has_platform_permission('read:tenants'));
CREATE POLICY "tenant_update_own_or_admin" ON tenants
    FOR UPDATE USING (id = get_tenant_id() OR is_platform_admin());

-- tenant_oauth / tenant_sms_config / tenant_whatsapp_config: solo su config.
CREATE POLICY "oauth_select_own" ON tenant_oauth FOR SELECT USING (tenant_id = get_tenant_id());
CREATE POLICY "oauth_insert_own" ON tenant_oauth FOR INSERT WITH CHECK (tenant_id = get_tenant_id());
CREATE POLICY "oauth_update_own" ON tenant_oauth FOR UPDATE USING (tenant_id = get_tenant_id());

CREATE POLICY "sms_select_own" ON tenant_sms_config FOR SELECT USING (tenant_id = get_tenant_id());
CREATE POLICY "sms_insert_own" ON tenant_sms_config FOR INSERT WITH CHECK (tenant_id = get_tenant_id());
CREATE POLICY "sms_update_own" ON tenant_sms_config FOR UPDATE USING (tenant_id = get_tenant_id());

CREATE POLICY "whatsapp_select_own" ON tenant_whatsapp_config FOR SELECT USING (tenant_id = get_tenant_id());
CREATE POLICY "whatsapp_insert_own" ON tenant_whatsapp_config FOR INSERT WITH CHECK (tenant_id = get_tenant_id());
CREATE POLICY "whatsapp_update_own" ON tenant_whatsapp_config FOR UPDATE USING (tenant_id = get_tenant_id());

-- consent_items: CRUD completo filtrado por tenant.
CREATE POLICY "consent_select_own" ON consent_items FOR SELECT USING (tenant_id = get_tenant_id());
CREATE POLICY "consent_insert_own" ON consent_items FOR INSERT WITH CHECK (tenant_id = get_tenant_id());
CREATE POLICY "consent_update_own" ON consent_items FOR UPDATE USING (tenant_id = get_tenant_id());
CREATE POLICY "consent_delete_own" ON consent_items FOR DELETE USING (tenant_id = get_tenant_id());

-- signing_templates: CRUD filtrado por tenant.
CREATE POLICY "templates_select_own" ON signing_templates FOR SELECT USING (tenant_id = get_tenant_id());
CREATE POLICY "templates_insert_own" ON signing_templates FOR INSERT WITH CHECK (tenant_id = get_tenant_id());
CREATE POLICY "templates_update_own" ON signing_templates FOR UPDATE USING (tenant_id = get_tenant_id());
CREATE POLICY "templates_delete_own" ON signing_templates FOR DELETE USING (tenant_id = get_tenant_id());

-- signing_sessions_temp: el tenant accede por session_id; firmante por x-access-token. INSERT/DELETE solo service_role.
CREATE POLICY "temp_select_own" ON signing_sessions_temp
    FOR SELECT USING (
        session_id IN (SELECT id FROM signing_sessions_results WHERE tenant_id = get_tenant_id())
    );
CREATE POLICY "temp_select_by_token" ON signing_sessions_temp
    FOR SELECT USING (
        session_id IN (
            SELECT id FROM signing_sessions_results
            WHERE access_token = current_setting('request.headers', true)::json->>'x-access-token'
        )
    );
CREATE POLICY "temp_delete_own" ON signing_sessions_temp
    FOR DELETE USING (
        session_id IN (SELECT id FROM signing_sessions_results WHERE tenant_id = get_tenant_id())
    );

-- signing_sessions_results: el tenant ve las suyas y actualiza status; admin/analyst con read:sessions ve todas (metadatos);
-- firmante accede por access_token. INSERT solo service_role.
CREATE POLICY "results_select_own_or_admin" ON signing_sessions_results
    FOR SELECT USING (
        tenant_id = get_tenant_id()
        OR access_token = current_setting('request.headers', true)::json->>'x-access-token'
        OR has_platform_permission('read:sessions')
    );
CREATE POLICY "results_select_by_token" ON signing_sessions_results
    FOR SELECT USING (
        access_token = current_setting('request.headers', true)::json->>'x-access-token'
    );
CREATE POLICY "results_update_own" ON signing_sessions_results
    FOR UPDATE USING (tenant_id = get_tenant_id());

-- otp_tokens: RLS sin policies = bloqueado. Solo service_role.

-- folio_sequence: bloqueado para todos. Solo service_role.
CREATE POLICY "folio_deny_all" ON folio_sequence FOR ALL USING (false);

-- audit_log: el tenant ve los suyos; admin/analyst con read:audit_log ve todos. INSERT solo service_role. Sin UPDATE/DELETE.
CREATE POLICY "audit_select_own_or_admin" ON audit_log
    FOR SELECT USING (tenant_id = get_tenant_id() OR has_platform_permission('read:audit_log'));

-- platform_users: admin ve/CRUD todos; el propio usuario se ve.
CREATE POLICY "pu_select" ON platform_users
    FOR SELECT USING (auth_user_id = auth.uid() OR is_platform_admin());
CREATE POLICY "pu_insert" ON platform_users FOR INSERT WITH CHECK (is_platform_admin());
CREATE POLICY "pu_update" ON platform_users FOR UPDATE USING (is_platform_admin());
CREATE POLICY "pu_delete" ON platform_users FOR DELETE USING (is_platform_admin());

-- platform_permissions: admin CRUD; el analyst ve los suyos.
CREATE POLICY "pp_select" ON platform_permissions
    FOR SELECT USING (
        user_id IN (SELECT id FROM platform_users WHERE auth_user_id = auth.uid())
        OR is_platform_admin()
    );
CREATE POLICY "pp_insert" ON platform_permissions FOR INSERT WITH CHECK (is_platform_admin());
CREATE POLICY "pp_delete" ON platform_permissions FOR DELETE USING (is_platform_admin());

-- ============================================================
--  TABLE COMMENTS
-- ============================================================
COMMENT ON TABLE tenants IS 'Clientes inscritos de la plataforma. INSERT solo via service_role (registro validado por Edge Function con OTP).';
COMMENT ON TABLE tenant_oauth IS 'Tokens OAuth encriptados (pgcrypto). history_sheets mapea año→sheet_id.';
COMMENT ON TABLE tenant_sms_config IS 'Configuración SMS gateway encriptada (pgcrypto). Solo accesible por el tenant dueño.';
COMMENT ON TABLE tenant_whatsapp_config IS 'Config WhatsApp Business API (Fase 3), cuenta propia de cada cliente. access_token encriptado.';
COMMENT ON TABLE consent_items IS 'Consentimientos configurados por cada cliente.';
COMMENT ON TABLE signing_templates IS 'Plantillas reutilizables del editor visual (modo firma). Límites por plan validados en signing-service.';
COMMENT ON TABLE signing_sessions_temp IS 'Datos en tránsito. INSERT via service_role. SELECT por tenant o firmante (access_token). FK a signing_sessions_results.';
COMMENT ON TABLE signing_sessions_results IS 'Registro permanente zero-knowledge. INSERT via service_role. SELECT/UPDATE por tenant. SELECT por firmante (access_token).';
COMMENT ON TABLE otp_tokens IS 'Códigos OTP temporales. Solo accesible via service_role (Edge Functions). RLS sin policies = bloqueado.';
COMMENT ON TABLE folio_sequence IS 'Secuencial atómico para folios. Solo accesible por service_role.';
COMMENT ON TABLE audit_log IS 'Registro inmutable. INSERT solo via service_role. SELECT filtrado por tenant_id. Sin UPDATE ni DELETE.';
COMMENT ON TABLE platform_users IS 'Usuarios internos de la plataforma (admin/analyst). Separados de los inscritos. Un admin no es un inscrito.';
