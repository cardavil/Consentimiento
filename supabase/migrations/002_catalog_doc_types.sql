-- Catálogo de tipos de documento (referencia gubernamental colombiana)
-- Lectura pública, escritura solo admin/service_role
-- Cuando el gobierno agrega un tipo nuevo, basta un INSERT

CREATE TABLE catalog_doc_types (
    code        TEXT PRIMARY KEY,
    label       TEXT NOT NULL,
    contexts    TEXT[] NOT NULL,
    regex       TEXT,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    active      BOOLEAN NOT NULL DEFAULT true
);

ALTER TABLE catalog_doc_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "catalog_doc_types_select"
    ON catalog_doc_types FOR SELECT
    TO anon, authenticated
    USING (active = true);

-- Seed: tipos vigentes Colombia 2026
INSERT INTO catalog_doc_types (code, label, contexts, regex, sort_order) VALUES
    ('CC',  'Cédula de Ciudadanía',             ARRAY['natural','natural_represented','natural_representative','juridica_signer','juridica_entity'], '^\d{6,10}$',        1),
    ('CE',  'Cédula de Extranjería',            ARRAY['natural','natural_represented','natural_representative','juridica_signer','juridica_entity'], '^[A-Za-z0-9]{4,12}$', 2),
    ('PA',  'Pasaporte',                         ARRAY['natural','natural_represented','natural_representative','juridica_signer','juridica_entity'], '^[A-Za-z0-9]{5,15}$', 3),
    ('PEP', 'Permiso Especial de Permanencia',   ARRAY['natural','natural_represented','juridica_signer','juridica_entity'],                                '^\d{7,15}$',        4),
    ('PPT', 'Permiso por Protección Temporal',   ARRAY['natural','natural_represented','juridica_signer','juridica_entity'],                                '^\d{7,15}$',        5),
    ('TI',  'Tarjeta de Identidad',              ARRAY['natural_represented','juridica_entity'],                                                            '^\d{8,11}$',        6),
    ('RC',  'Registro Civil',                    ARRAY['natural_represented'],                                                                           '^\d{8,11}$',        7),
    ('NIT', 'NIT',                               ARRAY['juridica_entity'],                                                                                        '^\d{9,10}(-\d)?$',  8);
