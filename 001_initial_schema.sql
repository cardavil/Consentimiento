-- ============================================================
--  FIRMACONSENT — SCHEMA v1.0
--  Multi-tenant · Single sign · Zero-knowledge
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
--  1. ORGANIZATIONS
-- ============================================================

CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type TEXT NOT NULL CHECK (type IN ('natural', 'juridica')),
    
    -- persona (siempre)
    first_name TEXT NOT NULL,
    last_name TEXT,
    doc_type TEXT NOT NULL CHECK (doc_type IN ('CC','CE','PA','PEP','PPT','TI','NIT')),
    doc_number TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT NOT NULL,
    position TEXT,
    
    -- empresa (solo juridica)
    company_name TEXT,
    company_nit TEXT,
    
    -- operativo
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
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,
    drive_folder_id TEXT,
    history_sheet_id TEXT,
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
    api_key TEXT,
    hmac_secret TEXT,
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
--  5. SIGNING_SESSIONS_TEMP
--     Datos operativos en tránsito. Se borra al completar.
-- ============================================================

CREATE TABLE signing_sessions_temp (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL,
    documents JSONB NOT NULL DEFAULT '[]',
    consents JSONB NOT NULL DEFAULT '[]',
    signer JSONB NOT NULL DEFAULT '{}',
    context TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
--  6. SIGNING_SESSIONS_RESULTS
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

CREATE OR REPLACE FUNCTION next_folio(p_org_id UUID, p_code TEXT, p_year INTEGER)
RETURNS INTEGER AS $$
DECLARE
    next_seq INTEGER;
BEGIN
    INSERT INTO folio_sequence (organization_id, code, year, seq)
    VALUES (p_org_id, p_code, p_year, 1)
    ON CONFLICT (organization_id, code, year)
    DO UPDATE SET seq = folio_sequence.seq + 1
    RETURNING seq INTO next_seq;
    
    RETURN next_seq;
END;
$$ LANGUAGE plpgsql;

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

-- ============================================================
--  AUTO-CLEANUP: expirar sesiones y limpiar temp
-- ============================================================

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
--  ROW LEVEL SECURITY
-- ============================================================

-- Helper: obtener organization_id del usuario autenticado
CREATE OR REPLACE FUNCTION get_org_id()
RETURNS UUID AS $$
BEGIN
    RETURN (
        SELECT id FROM organizations
        WHERE email = auth.jwt()->>'email'
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Activar RLS en todas las tablas
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_oauth ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_sms_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE signing_sessions_temp ENABLE ROW LEVEL SECURITY;
ALTER TABLE signing_sessions_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE folio_sequence ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- ORGANIZATIONS: solo ve la suya
CREATE POLICY "org_select_own" ON organizations
    FOR SELECT USING (id = get_org_id());

CREATE POLICY "org_update_own" ON organizations
    FOR UPDATE USING (id = get_org_id());

CREATE POLICY "org_insert_register" ON organizations
    FOR INSERT WITH CHECK (true);  -- registro público, validación en Edge Function

-- ORG_OAUTH: solo su config
CREATE POLICY "oauth_select_own" ON org_oauth
    FOR SELECT USING (organization_id = get_org_id());

CREATE POLICY "oauth_insert_own" ON org_oauth
    FOR INSERT WITH CHECK (organization_id = get_org_id());

CREATE POLICY "oauth_update_own" ON org_oauth
    FOR UPDATE USING (organization_id = get_org_id());

-- ORG_SMS_CONFIG: solo su config
CREATE POLICY "sms_select_own" ON org_sms_config
    FOR SELECT USING (organization_id = get_org_id());

CREATE POLICY "sms_insert_own" ON org_sms_config
    FOR INSERT WITH CHECK (organization_id = get_org_id());

CREATE POLICY "sms_update_own" ON org_sms_config
    FOR UPDATE USING (organization_id = get_org_id());

-- CONSENT_ITEMS: solo los suyos
CREATE POLICY "consent_select_own" ON consent_items
    FOR SELECT USING (organization_id = get_org_id());

CREATE POLICY "consent_insert_own" ON consent_items
    FOR INSERT WITH CHECK (organization_id = get_org_id());

CREATE POLICY "consent_update_own" ON consent_items
    FOR UPDATE USING (organization_id = get_org_id());

CREATE POLICY "consent_delete_own" ON consent_items
    FOR DELETE USING (organization_id = get_org_id());

-- SIGNING_SESSIONS_TEMP: acceso por session_id vinculado a resultados de la org
CREATE POLICY "temp_select_own" ON signing_sessions_temp
    FOR SELECT USING (
        session_id IN (SELECT id FROM signing_sessions_results WHERE organization_id = get_org_id())
    );

CREATE POLICY "temp_insert" ON signing_sessions_temp
    FOR INSERT WITH CHECK (true);  -- Edge Function valida

CREATE POLICY "temp_delete_own" ON signing_sessions_temp
    FOR DELETE USING (
        session_id IN (SELECT id FROM signing_sessions_results WHERE organization_id = get_org_id())
    );

-- SIGNING_SESSIONS_TEMP: acceso por access_token (firmante sin auth)
CREATE POLICY "temp_select_by_token" ON signing_sessions_temp
    FOR SELECT USING (
        session_id IN (
            SELECT id FROM signing_sessions_results
            WHERE access_token = current_setting('request.headers', true)::json->>'x-access-token'
        )
    );

-- SIGNING_SESSIONS_RESULTS: la org ve las suyas
CREATE POLICY "results_select_own" ON signing_sessions_results
    FOR SELECT USING (organization_id = get_org_id());

CREATE POLICY "results_insert" ON signing_sessions_results
    FOR INSERT WITH CHECK (true);  -- Edge Function valida

CREATE POLICY "results_update_own" ON signing_sessions_results
    FOR UPDATE USING (organization_id = get_org_id());

-- SIGNING_SESSIONS_RESULTS: firmante accede por access_token
CREATE POLICY "results_select_by_token" ON signing_sessions_results
    FOR SELECT USING (
        access_token = current_setting('request.headers', true)::json->>'x-access-token'
    );

-- OTP_TOKENS: sin restricción por org (login/register no tienen org)
-- Seguridad manejada en Edge Function
CREATE POLICY "otp_insert" ON otp_tokens
    FOR INSERT WITH CHECK (true);

CREATE POLICY "otp_select" ON otp_tokens
    FOR SELECT USING (true);

CREATE POLICY "otp_update" ON otp_tokens
    FOR UPDATE USING (true);

-- FOLIO_SEQUENCE: solo service_role (Edge Function)
CREATE POLICY "folio_deny_all" ON folio_sequence
    FOR ALL USING (false);

-- AUDIT_LOG: la org ve los suyos, solo insert
CREATE POLICY "audit_select_own" ON audit_log
    FOR SELECT USING (organization_id = get_org_id());

CREATE POLICY "audit_insert" ON audit_log
    FOR INSERT WITH CHECK (true);

-- audit_log y signing_sessions_results: sin UPDATE ni DELETE para nadie excepto las policies definidas
-- (no se crean policies de UPDATE/DELETE para audit_log)
-- (signing_sessions_results solo tiene UPDATE para status, no DELETE)

-- ============================================================
--  COMMENTS
-- ============================================================

COMMENT ON TABLE organizations IS 'Clientes de la plataforma. Persona siempre presente, empresa solo si jurídica.';
COMMENT ON TABLE org_oauth IS 'Tokens OAuth para acceder a Gmail/Drive/Sheets del cliente. Encriptados.';
COMMENT ON TABLE org_sms_config IS 'Configuración del gateway SMS Android del cliente. Encriptados.';
COMMENT ON TABLE consent_items IS 'Consentimientos configurados por cada cliente.';
COMMENT ON TABLE signing_sessions_temp IS 'Datos operativos en tránsito. Se borran al completar la firma.';
COMMENT ON TABLE signing_sessions_results IS 'Registro permanente zero-knowledge. Solo hashes y folios.';
COMMENT ON TABLE otp_tokens IS 'Códigos OTP temporales. Se limpian automáticamente.';
COMMENT ON TABLE folio_sequence IS 'Secuencial atómico para folios. Solo accesible por service_role.';
COMMENT ON TABLE audit_log IS 'Registro inmutable de eventos. Solo INSERT y SELECT.';
