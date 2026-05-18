-- ============================================================
--  FIRMACONSENT — SCHEMA CONSOLIDADO
--  Multi-tenant · Single sign · Zero-knowledge
--  Refleja el estado real de Supabase (pgouzutwvronvsxgdizk)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
--  1. ORGANIZATIONS
-- ============================================================

CREATE TABLE organizations (
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
--  2. ORG_OAUTH
-- ============================================================

CREATE TABLE org_oauth (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
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
--  3. ORG_SMS_CONFIG
-- ============================================================

CREATE TABLE org_sms_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
    gateway_url TEXT,
    api_key BYTEA,
    hmac_secret BYTEA,
    enabled BOOLEAN NOT NULL DEFAULT false,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
--  4. CONSENT_ITEMS
-- ============================================================

CREATE TABLE consent_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    required BOOLEAN NOT NULL DEFAULT false,
    sort_order INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT true,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE(organization_id, code)
);

-- ============================================================
--  5. SIGNING_SESSIONS_RESULTS
--     Registro permanente. Zero-knowledge.
-- ============================================================

CREATE TABLE signing_sessions_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    mode TEXT NOT NULL CHECK (mode IN ('natural_personal','natural_tutor','juridica')),
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
--  6. SIGNING_SESSIONS_TEMP
--     Datos operativos en tránsito. Se borra al completar.
-- ============================================================

CREATE TABLE signing_sessions_temp (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES signing_sessions_results(id) ON DELETE CASCADE,
    documents JSONB NOT NULL DEFAULT '[]',
    consents JSONB NOT NULL DEFAULT '[]',
    signer JSONB NOT NULL DEFAULT '{}',
    context TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
--  7. OTP_TOKENS
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
--  8. FOLIO_SEQUENCE
-- ============================================================

CREATE TABLE folio_sequence (
    organization_id UUID NOT NULL REFERENCES organizations(id),
    code TEXT NOT NULL,
    year INTEGER NOT NULL,
    seq INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (organization_id, code, year)
);

-- ============================================================
--  9. AUDIT_LOG
-- ============================================================

CREATE TABLE audit_log (
    id BIGSERIAL PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id),
    event_type TEXT NOT NULL,
    event_data JSONB DEFAULT '{}',
    ip INET,
    ua TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
--  INDEXES
-- ============================================================

CREATE INDEX idx_consent_items_org ON consent_items(organization_id);
CREATE INDEX idx_sessions_temp_session ON signing_sessions_temp(session_id);
CREATE INDEX idx_sessions_results_org ON signing_sessions_results(organization_id);
CREATE INDEX idx_sessions_results_token ON signing_sessions_results(access_token);
CREATE INDEX idx_sessions_results_status ON signing_sessions_results(status);
CREATE INDEX idx_sessions_results_folio ON signing_sessions_results(folio);
CREATE INDEX idx_otp_email ON otp_tokens(email);
CREATE INDEX idx_otp_purpose ON otp_tokens(email, purpose);
CREATE INDEX idx_audit_org ON audit_log(organization_id);
CREATE INDEX idx_audit_type ON audit_log(event_type);
CREATE INDEX idx_audit_created ON audit_log(created_at);

-- ============================================================
--  FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION encrypt_secret(p_plaintext TEXT, p_key TEXT)
RETURNS BYTEA AS $$
BEGIN
    RETURN pgp_sym_encrypt(p_plaintext, p_key);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrypt_secret(p_ciphertext BYTEA, p_key TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN pgp_sym_decrypt(p_ciphertext, p_key);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION next_folio(p_org_id UUID, p_code TEXT, p_year INTEGER)
RETURNS TEXT AS $$
DECLARE
    v_seq INTEGER;
    v_prefix TEXT;
BEGIN
    SELECT folio_prefix INTO v_prefix
    FROM organizations
    WHERE id = p_org_id;

    IF v_prefix IS NULL THEN
        RAISE EXCEPTION 'Organization not found: %', p_org_id;
    END IF;

    INSERT INTO folio_sequence (organization_id, code, year, seq)
    VALUES (p_org_id, p_code, p_year, 1)
    ON CONFLICT (organization_id, code, year)
    DO UPDATE SET seq = folio_sequence.seq + 1
    RETURNING seq INTO v_seq;

    RETURN v_prefix || '-' || p_code || '-' || p_year::TEXT || '-' || LPAD(v_seq::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_org_id()
RETURNS UUID AS $$
DECLARE
    v_org_id UUID;
BEGIN
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

CREATE OR REPLACE FUNCTION expire_sessions()
RETURNS INTEGER AS $$
DECLARE
    expired INTEGER;
BEGIN
    UPDATE signing_sessions_results
    SET status = 'expired'
    WHERE status IN ('pending','opened','reviewing','awaiting_otp')
    AND expires_at < now();

    GET DIAGNOSTICS expired = ROW_COUNT;

    DELETE FROM signing_sessions_temp
    WHERE session_id IN (
        SELECT id FROM signing_sessions_results WHERE status IN ('expired','cancelled','completed')
    );

    RETURN expired;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION cleanup_otps()
RETURNS INTEGER AS $$
DECLARE
    cleaned INTEGER;
BEGIN
    DELETE FROM otp_tokens
    WHERE expires_at < now() - INTERVAL '1 hour';

    GET DIAGNOSTICS cleaned = ROW_COUNT;
    RETURN cleaned;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
--  TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_organizations_updated
    BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_org_oauth_updated
    BEFORE UPDATE ON org_oauth
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_org_sms_config_updated
    BEFORE UPDATE ON org_sms_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_consent_items_updated
    BEFORE UPDATE ON consent_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION fix_auth_user_token_defaults()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.confirmation_token IS NULL THEN NEW.confirmation_token := ''; END IF;
    IF NEW.recovery_token IS NULL THEN NEW.recovery_token := ''; END IF;
    IF NEW.email_change_token_new IS NULL THEN NEW.email_change_token_new := ''; END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_fix_auth_token_defaults
    BEFORE INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION fix_auth_user_token_defaults();

-- ============================================================
--  ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_oauth ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_sms_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE signing_sessions_temp ENABLE ROW LEVEL SECURITY;
ALTER TABLE signing_sessions_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE folio_sequence ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- organizations: solo ve/edita la suya. INSERT solo service_role.
CREATE POLICY "org_select_own" ON organizations
    FOR SELECT USING (id = get_org_id());

CREATE POLICY "org_update_own" ON organizations
    FOR UPDATE USING (id = get_org_id());

-- org_oauth: solo su config
CREATE POLICY "oauth_select_own" ON org_oauth
    FOR SELECT USING (organization_id = get_org_id());

CREATE POLICY "oauth_insert_own" ON org_oauth
    FOR INSERT WITH CHECK (organization_id = get_org_id());

CREATE POLICY "oauth_update_own" ON org_oauth
    FOR UPDATE USING (organization_id = get_org_id());

-- org_sms_config: solo su config
CREATE POLICY "sms_select_own" ON org_sms_config
    FOR SELECT USING (organization_id = get_org_id());

CREATE POLICY "sms_insert_own" ON org_sms_config
    FOR INSERT WITH CHECK (organization_id = get_org_id());

CREATE POLICY "sms_update_own" ON org_sms_config
    FOR UPDATE USING (organization_id = get_org_id());

-- consent_items: CRUD completo filtrado por org
CREATE POLICY "consent_select_own" ON consent_items
    FOR SELECT USING (organization_id = get_org_id());

CREATE POLICY "consent_insert_own" ON consent_items
    FOR INSERT WITH CHECK (organization_id = get_org_id());

CREATE POLICY "consent_update_own" ON consent_items
    FOR UPDATE USING (organization_id = get_org_id());

CREATE POLICY "consent_delete_own" ON consent_items
    FOR DELETE USING (organization_id = get_org_id());

-- signing_sessions_temp: org accede por session_id, firmante por x-access-token. INSERT/DELETE solo service_role.
CREATE POLICY "temp_select_own" ON signing_sessions_temp
    FOR SELECT USING (
        session_id IN (SELECT id FROM signing_sessions_results WHERE organization_id = get_org_id())
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
        session_id IN (SELECT id FROM signing_sessions_results WHERE organization_id = get_org_id())
    );

-- signing_sessions_results: org ve las suyas y actualiza status. Firmante accede por access_token. INSERT solo service_role.
CREATE POLICY "results_select_own" ON signing_sessions_results
    FOR SELECT USING (organization_id = get_org_id());

CREATE POLICY "results_select_by_token" ON signing_sessions_results
    FOR SELECT USING (
        access_token = current_setting('request.headers', true)::json->>'x-access-token'
    );

CREATE POLICY "results_update_own" ON signing_sessions_results
    FOR UPDATE USING (organization_id = get_org_id());

-- otp_tokens: RLS sin policies = bloqueado. Solo service_role.

-- folio_sequence: bloqueado para todos. Solo service_role.
CREATE POLICY "folio_deny_all" ON folio_sequence
    FOR ALL USING (false);

-- audit_log: org ve los suyos. INSERT solo service_role. Sin UPDATE ni DELETE.
CREATE POLICY "audit_select_own" ON audit_log
    FOR SELECT USING (organization_id = get_org_id());

-- ============================================================
--  TABLE COMMENTS
-- ============================================================

COMMENT ON TABLE organizations IS 'Clientes de la plataforma. INSERT solo via service_role (registro validado por Edge Function con OTP).';
COMMENT ON TABLE org_oauth IS 'Tokens OAuth encriptados (pgcrypto). history_sheets mapea año→sheet_id.';
COMMENT ON TABLE org_sms_config IS 'Configuración SMS gateway encriptada (pgcrypto). Solo accesible por la org dueña.';
COMMENT ON TABLE consent_items IS 'Consentimientos configurados por cada cliente.';
COMMENT ON TABLE signing_sessions_temp IS 'Datos en tránsito. INSERT via service_role. SELECT por org o firmante (access_token). FK a signing_sessions_results.';
COMMENT ON TABLE signing_sessions_results IS 'Registro permanente zero-knowledge. INSERT via service_role. SELECT/UPDATE por org. SELECT por firmante (access_token).';
COMMENT ON TABLE otp_tokens IS 'Códigos OTP temporales. Solo accesible via service_role (Edge Functions). RLS sin policies = bloqueado.';
COMMENT ON TABLE folio_sequence IS 'Secuencial atómico para folios. Solo accesible por service_role.';
COMMENT ON TABLE audit_log IS 'Registro inmutable. INSERT solo via service_role. SELECT filtrado por organization_id. Sin UPDATE ni DELETE.';
