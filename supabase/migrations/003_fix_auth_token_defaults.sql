-- ============================================================
--  FIRMACONSENT — MIGRACIÓN 003: Fix auth.users NULL tokens
--  Previene crash de GoTrue al crear usuarios vía Admin API
-- ============================================================

-- GoTrue puede dejar columnas de token en NULL al crear usuarios
-- vía Admin API. Luego crashea con "converting NULL to string is
-- unsupported" al intentar leer ese usuario.
--
-- No se puede ALTER TABLE auth.users (owner: supabase_auth_admin),
-- pero sí crear un trigger BEFORE INSERT desde public.

CREATE OR REPLACE FUNCTION public.fix_auth_user_token_defaults()
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
    FOR EACH ROW
    EXECUTE FUNCTION public.fix_auth_user_token_defaults();
