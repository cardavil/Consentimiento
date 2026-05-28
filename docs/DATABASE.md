# Base de Datos

Supabase nuevo, proyecto independiente. Multi-tenant con RLS. **12 tablas implementadas** + 2 pendientes (`signing_templates` en Fase 2, `org_whatsapp_config` en Fase 3).

Migraciones aplicadas (`supabase/migrations/`):

| Archivo | Qué hace |
|---|---|
| `001_initial_schema.sql` | 9 tablas base, RLS, funciones, triggers |
| `002_catalog_doc_types.sql` | Tabla `catalog_doc_types` (catálogo tipos de documento) |
| `003_platform_users.sql` | Tablas `platform_users` + `platform_permissions` y funciones `is_platform_user/admin`, `has_platform_permission`, `get_org_id` |
| `004_admin_org_dual_role.sql` | Redefine `get_org_id()` para identidad dual admin/org (fast-path org_id en JWT antes del guard platform_role) |
| `005_platform_users_identity.sql` | Expande `platform_users` con nombre, apellido, documento, teléfono |
| `006_get_db_size.sql` | Función `get_db_size()` para métricas admin |

---

## Supabase Keys

| Concepto | Qué es |
|---|---|
| **publishable key** (`sb_publishable_*`) | Identifica proyecto ante el gateway, se traduce a rol anon. Segura en frontend. |
| **secret key** (`sb_secret_*`) | Se traduce a service_role. Solo en Edge Functions (env var), nunca en frontend. |
| **header apikey** | Identificación del proyecto ante el API gateway. |
| **header Authorization: Bearer** | JWT de sesión del usuario. Autenticación ante GoTrue/PostgREST. |

`apikey` y `Authorization` son headers independientes. El gateway lee `apikey` para routing. GoTrue/PostgREST lee `Authorization` para autenticación.

Para operaciones admin: `updateUserById()`, NO `updateUser()` (ese es para el usuario autenticado actual).

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
| folio_prefix | TEXT | default actual 'FC'; target 'CT' (rebrand, migración pendiente). Usado por next_folio() |
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
| fields | JSONB | Para firma: [{type, x, y, w, h, page, required, label}]. NULL para consentimiento |
| created_at | TIMESTAMPTZ | |

### signing_sessions_results
Registro permanente zero-knowledge. **NO contiene datos del firmante, documentos, ni contexto.** INSERT solo via service_role.

| Columna | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| organization_id | UUID FK | → organizations |
| session_type | TEXT | consent / firma. NOT NULL. CHECK constraint |
| mode | TEXT | natural_personal / natural_tutor (con representante) / juridica |
| access_token | TEXT | UNIQUE, gen_random_bytes(32) hex |
| token_expires_at | TIMESTAMPTZ | |
| status | TEXT | pending/opened/reviewing/awaiting_otp/completed/expired/cancelled |
| folio | TEXT | formato: PREFIX-CODE-YEAR-SEQ |
| pdf_hash | TEXT | SHA-256 |
| consent_hashes | JSONB | hash por cada consentimiento |
| otp_channel | TEXT | email / sms / whatsapp. Default 'email' |
| template_id | UUID FK NULL | → signing_templates(id). ON DELETE SET NULL. Solo session_type=firma. **Fase 2 — tabla destino pendiente** |
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

### signing_templates
**Pendiente — Fase 2, no creada aún (sin migración).** Plantillas reutilizables del editor visual (modo firma). Limitadas por plan (límites TBD). El límite se valida en Edge Function, no en BD.

| Columna | Tipo | Notas |
|---|---|---|
| id | UUID PK | uuid_generate_v4() |
| organization_id | UUID FK | → organizations |
| name | TEXT | NOT NULL |
| source_file_name | TEXT | Nombre original del PDF (display, no Drive ID) |
| page_count | INTEGER | |
| fields | JSONB | NOT NULL default '[]'. [{type, label, x, y, w, h, page, required}] |
| active | BOOLEAN | default true |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | trigger auto |

### org_whatsapp_config
**Pendiente — Fase 3, no creada aún (sin migración).** Config de WhatsApp Business API del cliente. Secrets encriptados con pgcrypto. Cada cliente usa su propia cuenta de WhatsApp Business.

| Columna | Tipo | Notas |
|---|---|---|
| id | UUID PK | uuid_generate_v4() |
| organization_id | UUID FK UNIQUE | → organizations, ON DELETE CASCADE |
| phone_number_id | TEXT | WhatsApp Business phone number ID |
| waba_id | TEXT | WhatsApp Business Account ID |
| access_token | BYTEA | encriptado con pgcrypto |
| display_phone | TEXT | Número visible para el firmante en UI |
| enabled | BOOLEAN | default false |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | trigger auto |

### catalog_doc_types
Catálogo de tipos de documento colombianos. Lectura pública, escritura solo admin. Cuando el gobierno agrega un tipo nuevo, basta un INSERT.

| Columna | Tipo | Notas |
|---|---|---|
| code | TEXT PK | CC, CE, PA, PEP, PPT, TI, RC, NIT |
| label | TEXT | Nombre legible (Cédula de Ciudadanía, etc.) |
| contexts | TEXT[] | Contextos donde aplica: natural, natural_tutor_represented, natural_tutor_representative, juridica_signer, organization |
| regex | TEXT | Patrón de validación frontend |
| sort_order | INTEGER | Orden en dropdowns |
| active | BOOLEAN | default true. Desactivar en vez de borrar |

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

### platform_users
Usuarios internos de la plataforma (admin/analyst). Completamente separados de organizaciones. Un admin no es una org.

| Columna | Tipo | Notas |
|---|---|---|
| id | UUID PK | uuid_generate_v4() |
| auth_user_id | UUID UNIQUE NOT NULL | auth.users(id) |
| email | TEXT UNIQUE NOT NULL | |
| first_name | TEXT NOT NULL | |
| last_name | TEXT NOT NULL | |
| doc_type | TEXT | CC/CE/PA/PEP/PPT/TI/NIT |
| doc_number | TEXT | |
| phone | TEXT | |
| role | TEXT NOT NULL | CHECK: admin / analyst |
| active | BOOLEAN | default true |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | trigger auto |

### platform_permissions
Permisos granulares para analysts. Admin tiene todos implícitamente.

| Columna | Tipo | Notas |
|---|---|---|
| id | UUID PK | uuid_generate_v4() |
| user_id | UUID FK NOT NULL | → platform_users ON DELETE CASCADE |
| permission | TEXT NOT NULL | CHECK: read:orgs, read:audit_log, read:sessions, read:catalogs, write:catalogs, read:metrics |
| granted_by | UUID FK | → platform_users |
| created_at | TIMESTAMPTZ | |
| UNIQUE(user_id, permission) | | |

---

## Funciones

### encrypt_secret(p_plaintext TEXT, p_key TEXT) → BYTEA
Encripta con pgp_sym_encrypt. SECURITY DEFINER. La llave la pasa la Edge Function desde Supabase Secret.

### decrypt_secret(p_ciphertext BYTEA, p_key TEXT) → TEXT
Desencripta con pgp_sym_decrypt. SECURITY DEFINER. La llave la pasa la Edge Function desde Supabase Secret.

### next_folio(p_org_id, p_code, p_year) → TEXT
INSERT ON CONFLICT UPDATE atómico. Lee folio_prefix de organizations. Retorna folio formateado: `{prefix}-{code}-{year}-{seq_padded}`. Ejemplo: `CT-C1-2026-0007`. SECURITY DEFINER.

### is_platform_user() → BOOLEAN
Retorna true si el JWT tiene app_metadata.platform_role. SECURITY DEFINER STABLE.

### is_platform_admin() → BOOLEAN
Retorna true si platform_role = 'admin'. SECURITY DEFINER STABLE.

### has_platform_permission(p_permission TEXT) → BOOLEAN
Admin retorna true siempre. Analyst busca en platform_permissions (filtrado por auth.uid() y active=true). SECURITY DEFINER STABLE.

### get_org_id() → UUID
Lee org_id del JWT (app_metadata) como fast path sin query. Si no existe y platform_role existe, retorna NULL (admin/analyst sin org). Si no tiene platform_role, fallback a SELECT por email (org users legacy). SECURITY DEFINER STABLE. Permite dual identity: admin con org_id obtiene su org. Migration 004.

### expire_sessions() → INTEGER
Marca como 'expired' las sesiones vencidas. Limpia signing_sessions_temp de sesiones expired/cancelled/completed.

### cleanup_otps() → INTEGER
Borra OTPs expirados hace más de 1 hora.

### fix_auth_user_token_defaults()
Trigger BEFORE INSERT en auth.users. Convierte NULLs a string vacío en confirmation_token, recovery_token, email_change_token_new. Previene crash de GoTrue al crear usuarios vía Admin API. SECURITY DEFINER.

### check_template_limit(p_org_id UUID) → BOOLEAN
**Pendiente — Fase 2 (depende de signing_templates).** Cuenta plantillas activas de la org, compara contra el límite del plan (leído de organizations.plan). Retorna true si puede crear más. SECURITY DEFINER.

### get_db_size() → JSON
Retorna `{db_bytes, storage_bytes}` (tamaño de la BD y del storage). Usada por `admin-service` para métricas. SECURITY DEFINER. Migración 006.

### update_updated_at()
Trigger en organizations, org_oauth, org_sms_config, org_whatsapp_config, consent_items, signing_templates. Actualiza updated_at automáticamente.

---

## Row Level Security

Patrón: operaciones sensibles (INSERT en tablas críticas, OTP) pasan exclusivamente por Edge Functions con service_role, que bypasea RLS. El frontend solo tiene acceso de lectura/actualización filtrado.

| Tabla | Regla |
|---|---|
| organizations | Solo ve/edita la suya. Admin ve/edita todas. INSERT solo service_role. |
| org_oauth | Solo su config (select/insert/update). |
| org_sms_config | Solo su config (select/insert/update). |
| consent_items | Solo los suyos (CRUD completo). |
| signing_sessions_temp | Org accede por session_id. Firmante accede por x-access-token header. Org puede borrar los suyos. INSERT solo service_role. |
| signing_sessions_results | Org ve las suyas y actualiza status. Firmante accede por access_token. INSERT solo service_role. |
| otp_tokens | Bloqueado (sin policies). Solo service_role. |
| folio_sequence | Bloqueado para todos. Solo service_role. |
| signing_templates | Solo ve/edita las suyas (CRUD). organization_id = get_org_id(). |
| org_whatsapp_config | Solo su config (select/insert/update). Mismo patrón que org_sms_config. |
| catalog_doc_types | SELECT público (anon + authenticated) donde active=true. Admin con write:catalogs puede CRUD. |
| audit_log | Org ve los suyos. Admin/analyst con read:audit_log ve todos. INSERT solo service_role. Sin UPDATE ni DELETE. |
| platform_users | Admin ve todos, analyst ve solo el suyo. CRUD solo admin. |
| platform_permissions | Admin CRUD. Analyst ve los suyos. |

---

## Índices

- consent_items(organization_id)
- signing_sessions_temp(session_id)
- signing_sessions_results(organization_id, access_token, status, folio, session_type)
- signing_templates(organization_id)
- otp_tokens(email), otp_tokens(email, purpose)
- audit_log(organization_id, event_type, created_at)
- platform_users(auth_user_id)
- platform_permissions(user_id)
