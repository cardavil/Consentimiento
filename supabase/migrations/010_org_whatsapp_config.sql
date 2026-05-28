-- Phase 3: WhatsApp Business API config per org (each client uses its own account).
-- access_token encrypted with pgcrypto (same pattern as org_oauth / org_sms_config).

CREATE TABLE org_whatsapp_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
    phone_number_id TEXT,
    waba_id TEXT,
    access_token BYTEA,        -- encrypted (pgp_sym_encrypt)
    display_phone TEXT,
    enabled BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_org_whatsapp_config_updated
    BEFORE UPDATE ON org_whatsapp_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE org_whatsapp_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "whatsapp_select_own" ON org_whatsapp_config
    FOR SELECT USING (organization_id = get_org_id());
CREATE POLICY "whatsapp_insert_own" ON org_whatsapp_config
    FOR INSERT WITH CHECK (organization_id = get_org_id());
CREATE POLICY "whatsapp_update_own" ON org_whatsapp_config
    FOR UPDATE USING (organization_id = get_org_id());
