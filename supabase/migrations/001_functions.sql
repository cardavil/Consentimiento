-- ============================================================
--  CONSENTIA — FUNCIONES + EXTENSIONES + CRON
--  Se crean antes del schema: los triggers y las RLS de 002 las usan.
--  Los cuerpos plpgsql que referencian tablas se resuelven en runtime.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---- Secretos (pgcrypto) -----------------------------------
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

-- ---- Folios atómicos ---------------------------------------
CREATE OR REPLACE FUNCTION next_folio(p_tenant_id UUID, p_code TEXT, p_year INTEGER)
RETURNS TEXT AS $$
DECLARE
    v_seq INTEGER;
    v_prefix TEXT;
BEGIN
    SELECT folio_prefix INTO v_prefix FROM tenants WHERE id = p_tenant_id;
    IF v_prefix IS NULL THEN
        RAISE EXCEPTION 'Tenant not found: %', p_tenant_id;
    END IF;
    INSERT INTO folio_sequence (tenant_id, code, year, seq)
    VALUES (p_tenant_id, p_code, p_year, 1)
    ON CONFLICT (tenant_id, code, year)
    DO UPDATE SET seq = folio_sequence.seq + 1
    RETURNING seq INTO v_seq;
    RETURN v_prefix || '-' || p_code || '-' || p_year::TEXT || '-' || LPAD(v_seq::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---- Identidad (dual tenant/admin) -------------------------
-- Fast-path: tenant_id del JWT (sirve para tenant users Y admin-with-tenant).
-- Platform users sin tenant_id -> NULL. Fallback por email para tenants legacy.
CREATE OR REPLACE FUNCTION get_tenant_id()
RETURNS UUID AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    v_tenant_id := (auth.jwt()->'app_metadata'->>'tenant_id')::UUID;
    IF v_tenant_id IS NOT NULL THEN
        RETURN v_tenant_id;
    END IF;
    IF (auth.jwt()->'app_metadata'->>'platform_role') IS NOT NULL THEN
        RETURN NULL;
    END IF;
    RETURN (SELECT id FROM tenants WHERE email = auth.jwt()->>'email' LIMIT 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ---- Plataforma (admin/analyst) ----------------------------
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

-- ---- Mantenimiento -----------------------------------------
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
    DELETE FROM otp_tokens WHERE expires_at < now() - INTERVAL '1 hour';
    GET DIAGNOSTICS cleaned = ROW_COUNT;
    RETURN cleaned;
END;
$$ LANGUAGE plpgsql;

-- ---- Métricas admin ----------------------------------------
CREATE OR REPLACE FUNCTION get_db_size()
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT json_build_object(
    'db_bytes', pg_database_size(current_database()),
    'storage_bytes', COALESCE(
      (SELECT SUM((metadata->>'size')::bigint) FROM storage.objects),
      0
    )
  );
$$;

-- ---- Trigger functions -------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fix_auth_user_token_defaults()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.confirmation_token IS NULL THEN NEW.confirmation_token := ''; END IF;
    IF NEW.recovery_token IS NULL THEN NEW.recovery_token := ''; END IF;
    IF NEW.email_change_token_new IS NULL THEN NEW.email_change_token_new := ''; END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---- Cron (pg_cron) ----------------------------------------
-- Tolerante: si pg_cron no está disponible (p. ej. en un reset local sin la
-- extensión habilitada), se omite el agendamiento sin abortar la migración.
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
    PERFORM cron.schedule('consentia_expire_sessions', '*/15 * * * *', 'SELECT expire_sessions();');
    PERFORM cron.schedule('consentia_cleanup_otps',    '0 * * * *',    'SELECT cleanup_otps();');
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron no disponible; se omite el agendamiento (habilitar en el dashboard).';
END $$;
