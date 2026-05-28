-- Phase 2: visual signature templates + per-session fields + template link.

CREATE TABLE signing_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    source_file_name TEXT,
    page_count INTEGER,
    fields JSONB NOT NULL DEFAULT '[]',
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_signing_templates_org ON signing_templates (organization_id);

CREATE TRIGGER trg_signing_templates_updated
    BEFORE UPDATE ON signing_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE signing_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "templates_select_own" ON signing_templates
    FOR SELECT USING (organization_id = get_org_id());
CREATE POLICY "templates_insert_own" ON signing_templates
    FOR INSERT WITH CHECK (organization_id = get_org_id());
CREATE POLICY "templates_update_own" ON signing_templates
    FOR UPDATE USING (organization_id = get_org_id());
CREATE POLICY "templates_delete_own" ON signing_templates
    FOR DELETE USING (organization_id = get_org_id());

-- Per-session field definitions/values in transit (deleted on completion).
ALTER TABLE signing_sessions_temp ADD COLUMN fields JSONB;

-- Link a completed firma session to the template it used (nullable; SET NULL on delete).
ALTER TABLE signing_sessions_results
    ADD COLUMN template_id UUID REFERENCES signing_templates(id) ON DELETE SET NULL;
