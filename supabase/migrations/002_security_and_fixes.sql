-- ============================================================
--  FIRMACONSENT — MIGRACIÓN 002: Seguridad y correcciones
--  Resuelve 8 issues del schema inicial
-- ============================================================

-- ============================================================
--  1. FUNCIONES DE ENCRIPTACIÓN (pgcrypto parametrizado)
--     pgcrypto ya está en 001. Es estándar PostgreSQL,
--     no depende de features específicos de Supabase.
--     La llave vive como Supabase Secret ENCRYPTION_KEY,
--     la Edge Function la pasa como parámetro.
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

-- ============================================================
--  2. MIGRACIÓN DE COLUMNAS org_oauth (TEXT → BYTEA)
-- ============================================================

ALTER TABLE org_oauth ADD COLUMN access_token_enc BYTEA;
ALTER TABLE org_oauth ADD COLUMN refresh_token_enc BYTEA;

ALTER TABLE org_oauth DROP COLUMN access_token;
ALTER TABLE org_oauth DROP COLUMN refresh_token;

ALTER TABLE org_oauth RENAME COLUMN access_token_enc TO access_token;
ALTER TABLE org_oauth RENAME COLUMN refresh_token_enc TO refresh_token;

-- ============================================================
--  3. MIGRACIÓN DE COLUMNAS org_sms_config (TEXT → BYTEA)
-- ============================================================

ALTER TABLE org_sms_config ADD COLUMN api_key_enc BYTEA;
ALTER TABLE org_sms_config ADD COLUMN hmac_secret_enc BYTEA;

ALTER TABLE org_sms_config DROP COLUMN api_key;
ALTER TABLE org_sms_config DROP COLUMN hmac_secret;

ALTER TABLE org_sms_config RENAME COLUMN api_key_enc TO api_key;
ALTER TABLE org_sms_config RENAME COLUMN hmac_secret_enc TO hmac_secret;

-- ============================================================
--  4. FK signing_sessions_temp → signing_sessions_results
-- ============================================================

DELETE FROM signing_sessions_temp
WHERE session_id NOT IN (SELECT id FROM signing_sessions_results);

ALTER TABLE signing_sessions_temp
ADD CONSTRAINT fk_temp_session_results
FOREIGN KEY (session_id) REFERENCES signing_sessions_results(id)
ON DELETE CASCADE;

-- ============================================================
--  5. NUEVAS COLUMNAS org_oauth
-- ============================================================

ALTER TABLE org_oauth ADD COLUMN last_refreshed_at TIMESTAMPTZ;

ALTER TABLE org_oauth ADD COLUMN history_sheets JSONB NOT NULL DEFAULT '{}';

UPDATE org_oauth
SET history_sheets = jsonb_build_object(
    EXTRACT(YEAR FROM now())::TEXT,
    history_sheet_id
)
WHERE history_sheet_id IS NOT NULL;

-- ============================================================
--  6. REEMPLAZO get_org_id() — JWT fast path + fallback
-- ============================================================

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

-- ============================================================
--  7. REEMPLAZO next_folio() — retorna folio formateado
-- ============================================================

DROP FUNCTION next_folio(UUID, TEXT, INTEGER);

CREATE FUNCTION next_folio(p_org_id UUID, p_code TEXT, p_year INTEGER)
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

-- ============================================================
--  8. RLS — CERRAR POLÍTICAS ABIERTAS
--     Edge Functions usan service_role que bypasea RLS.
-- ============================================================

-- otp_tokens: cerrar todo
DROP POLICY "otp_insert" ON otp_tokens;
DROP POLICY "otp_select" ON otp_tokens;
DROP POLICY "otp_update" ON otp_tokens;

-- signing_sessions_results: cerrar INSERT público
DROP POLICY "results_insert" ON signing_sessions_results;

-- signing_sessions_temp: cerrar INSERT público
DROP POLICY "temp_insert" ON signing_sessions_temp;

-- audit_log: cerrar INSERT público
DROP POLICY "audit_insert" ON audit_log;

-- organizations: cerrar INSERT público (registro va por Edge Function)
DROP POLICY "org_insert_register" ON organizations;

-- ============================================================
--  9. COMENTARIOS ACTUALIZADOS
-- ============================================================

COMMENT ON FUNCTION encrypt_secret(TEXT, TEXT) IS 'Encripta texto con pgp_sym_encrypt. Llave pasada por Edge Function desde Supabase Secret.';
COMMENT ON FUNCTION decrypt_secret(BYTEA, TEXT) IS 'Desencripta BYTEA con pgp_sym_decrypt. Llave pasada por Edge Function desde Supabase Secret.';

COMMENT ON TABLE organizations IS 'Clientes de la plataforma. INSERT solo via service_role (registro validado por Edge Function con OTP).';
COMMENT ON TABLE org_oauth IS 'Tokens OAuth encriptados (pgcrypto). history_sheets mapea año→sheet_id.';
COMMENT ON TABLE org_sms_config IS 'Configuración SMS gateway encriptada (pgcrypto). Solo accesible por la org dueña.';
COMMENT ON TABLE otp_tokens IS 'Códigos OTP temporales. Solo accesible via service_role (Edge Functions). RLS sin policies = bloqueado.';
COMMENT ON TABLE signing_sessions_temp IS 'Datos en tránsito. INSERT via service_role. SELECT por org o firmante (access_token). FK a signing_sessions_results.';
COMMENT ON TABLE signing_sessions_results IS 'Registro permanente zero-knowledge. INSERT via service_role. SELECT/UPDATE por org. SELECT por firmante (access_token).';
COMMENT ON TABLE audit_log IS 'Registro inmutable. INSERT solo via service_role. SELECT filtrado por organization_id. Sin UPDATE ni DELETE.';

COMMENT ON COLUMN org_oauth.history_sheets IS 'Mapa año→sheet_id: {"2026":"abc","2027":"def"}. Edge Function crea sheet nuevo al cambiar de año.';
COMMENT ON COLUMN org_oauth.last_refreshed_at IS 'Última vez que se refrescaron los tokens OAuth. Para monitoreo.';
