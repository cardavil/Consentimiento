# Base de Datos

Supabase nuevo, proyecto independiente. Multi-tenant con RLS. 9 tablas.

Schema: `supabase/migrations/001_initial_schema.sql`
Correcciones: `supabase/migrations/002_security_and_fixes.sql`

---

## Tablas

### organizations
Clientes de la plataforma. La persona siempre existe. La empresa solo si es jurídica. Si type = juridica, doc_type se pone en NIT automáticamente en el frontend. INSERT solo via service_role.

| Columna | Tipo | Notas |
|---|---|---|
| id | UUID PK | uuid_generate_v4() |
| type | TEXT | natural / juridica |
| first_name | TEXT | NOT NULL |
| last_name | TEXT | solo natural |
| doc_type | TEXT | CC/CE/PA/PEP/PPT/TI/NIT |
| doc_number | TEXT | NOT NULL |
| email | TEXT | UNIQUE NOT NULL |
| phone | TEXT | NOT NULL |
| position | TEXT | solo jurídica |
| company_name | TEXT | solo jurídica |
| company_nit | TEXT | solo jurídica |
| plan | TEXT | trial/basic/pro/enterprise (default: trial) |
| active | BOOLEAN | default: true |
| folio_prefix | TEXT | default: 'FC'. Usado por next_folio() |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | trigger auto |

### org_oauth
Conexión a la nube del cliente (Google Workspace o Microsoft 365). Tokens encriptados con pgcrypto (pgp_sym_encrypt).

| Columna | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| organization_id | UUID FK UNIQUE | → organizations |
| provider | TEXT | google_workspace / microsoft_365 |
| access_token | BYTEA | encriptado con pgcrypto |
| refresh_token | BYTEA | encriptado con pgcrypto |
| token_expires_at | TIMESTAMPTZ | |
| last_refreshed_at | TIMESTAMPTZ | monitoreo de refresh |
| drive_folder_id | TEXT | |
| history_sheet_id | TEXT | sheet activo actual |
| history_sheets | JSONB | mapa año→sheet_id: {"2026":"abc"} |
| sender_email | TEXT | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | trigger auto |

### org_sms_config
Gateway SMS Android del cliente. Secrets encriptados con pgcrypto.

| Columna | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| organization_id | UUID FK UNIQUE | → organizations |
| gateway_url | TEXT | |
| api_key | BYTEA | encriptado con pgcrypto |
| hmac_secret | BYTEA | encriptado con pgcrypto |
| enabled | BOOLEAN | default: false |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | trigger auto |

### consent_items
Consentimientos configurados por cada cliente.

| Columna | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| organization_id | UUID FK | → organizations |
| code | TEXT | C1, C2... UNIQUE con org_id |
| title | TEXT | NOT NULL |
| description | TEXT | NOT NULL |
| required | BOOLEAN | default: false |
| sort_order | INTEGER | default: 0 |
| active | BOOLEAN | default: true |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | trigger auto |

### signing_sessions_temp
Datos operativos en tránsito. **SE BORRA al completar la firma.** INSERT solo via service_role. FK a signing_sessions_results.

| Columna | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| session_id | UUID FK | → signing_sessions_results(id) ON DELETE CASCADE |
| documents | JSONB | drive file IDs a embeber |
| consents | JSONB | consentimientos y obligatoriedad |
| signer | JSONB | datos del firmante |
| context | TEXT | |
| created_at | TIMESTAMPTZ | |

### signing_sessions_results
Registro permanente zero-knowledge. **NO contiene datos del firmante, documentos, ni contexto.** INSERT solo via service_role.

| Columna | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| organization_id | UUID FK | → organizations |
| mode | TEXT | natural_personal / natural_tutor (con representante) / juridica |
| access_token | TEXT | UNIQUE, gen_random_bytes(32) hex |
| token_expires_at | TIMESTAMPTZ | |
| status | TEXT | pending/opened/reviewing/awaiting_otp/completed/expired/cancelled |
| folio | TEXT | formato: PREFIX-CODE-YEAR-SEQ |
| pdf_hash | TEXT | SHA-256 |
| consent_hashes | JSONB | hash por cada consentimiento |
| created_at | TIMESTAMPTZ | |
| completed_at | TIMESTAMPTZ | |
| expires_at | TIMESTAMPTZ | |

### otp_tokens
Temporales. Se limpian automáticamente. Solo accesible via service_role (Edge Functions). RLS sin policies = bloqueado para anon/authenticated.

| Columna | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| email | TEXT | NOT NULL |
| code_hash | TEXT | nunca el código en claro |
| purpose | TEXT | login / register / sign |
| attempts | INTEGER | default: 0 |
| expires_at | TIMESTAMPTZ | |
| verified_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | |

### folio_sequence
Secuencial atómico. PK compuesta. Solo accesible por service_role.

| Columna | Tipo | Notas |
|---|---|---|
| organization_id | UUID PK | → organizations |
| code | TEXT PK | |
| year | INTEGER PK | |
| seq | INTEGER | default: 0 |

### audit_log
Inmutable. INSERT solo via service_role. Sin UPDATE ni DELETE.

| Columna | Tipo | Notas |
|---|---|---|
| id | BIGSERIAL PK | |
| organization_id | UUID FK | → organizations |
| event_type | TEXT | NOT NULL |
| event_data | JSONB | sin datos personales |
| ip | INET | |
| ua | TEXT | |
| created_at | TIMESTAMPTZ | |

---

## Funciones

### encrypt_secret(p_plaintext TEXT, p_key TEXT) → BYTEA
Encripta con pgp_sym_encrypt. SECURITY DEFINER. La llave la pasa la Edge Function desde Supabase Secret.

### decrypt_secret(p_ciphertext BYTEA, p_key TEXT) → TEXT
Desencripta con pgp_sym_decrypt. SECURITY DEFINER. La llave la pasa la Edge Function desde Supabase Secret.

### next_folio(p_org_id, p_code, p_year) → TEXT
INSERT ON CONFLICT UPDATE atómico. Lee folio_prefix de organizations. Retorna folio formateado: `{prefix}-{code}-{year}-{seq_padded}`. Ejemplo: `FC-C1-2026-0007`. SECURITY DEFINER.

### get_org_id() → UUID
Lee org_id del JWT (app_metadata) como fast path sin query. Si no existe, fallback a SELECT por email. SECURITY DEFINER STABLE. La Edge Function de login debe setear app_metadata.org_id.

### expire_sessions() → INTEGER
Marca como 'expired' las sesiones vencidas. Limpia signing_sessions_temp de sesiones expired/cancelled/completed.

### cleanup_otps() → INTEGER
Borra OTPs expirados hace más de 1 hora.

### update_updated_at()
Trigger en organizations, org_oauth, org_sms_config, consent_items. Actualiza updated_at automáticamente.

---

## Row Level Security

Patrón: operaciones sensibles (INSERT en tablas críticas, OTP) pasan exclusivamente por Edge Functions con service_role, que bypasea RLS. El frontend solo tiene acceso de lectura/actualización filtrado.

| Tabla | Regla |
|---|---|
| organizations | Solo ve/edita la suya. INSERT solo service_role. |
| org_oauth | Solo su config (select/insert/update). |
| org_sms_config | Solo su config (select/insert/update). |
| consent_items | Solo los suyos (CRUD completo). |
| signing_sessions_temp | Org accede por session_id. Firmante accede por x-access-token header. INSERT/DELETE solo service_role. |
| signing_sessions_results | Org ve las suyas y actualiza status. Firmante accede por access_token. INSERT solo service_role. |
| otp_tokens | Bloqueado (sin policies). Solo service_role. |
| folio_sequence | Bloqueado para todos. Solo service_role. |
| audit_log | Org ve los suyos. INSERT solo service_role. Sin UPDATE ni DELETE. |

---

## Índices

- consent_items(organization_id)
- signing_sessions_temp(session_id)
- signing_sessions_results(organization_id, access_token, status, folio)
- otp_tokens(email), otp_tokens(email, purpose)
- audit_log(organization_id, event_type, created_at)
