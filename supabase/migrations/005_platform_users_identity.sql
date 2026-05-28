-- Expand platform_users with full identity: first/last name, document, phone

ALTER TABLE platform_users ADD COLUMN first_name TEXT NOT NULL DEFAULT '';
ALTER TABLE platform_users ADD COLUMN last_name  TEXT NOT NULL DEFAULT '';
ALTER TABLE platform_users ADD COLUMN doc_type   TEXT;
ALTER TABLE platform_users ADD COLUMN doc_number TEXT;
ALTER TABLE platform_users ADD COLUMN phone      TEXT;

-- Migrate existing data
UPDATE platform_users SET first_name = name;

ALTER TABLE platform_users DROP COLUMN name;
