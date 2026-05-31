# Base de Datos

Supabase nuevo, proyecto independiente. Multi-tenant con RLS. **14 tablas implementadas** (migraciones 001–010).

Migraciones aplicadas (`supabase/migrations/`):

| Archivo | Qué hace |
|---|---|
| `001_initial_schema.sql` | 9 tablas base, RLS, funciones, triggers |
| `002_catalog_doc_types.sql` | Tabla `catalog_doc_types` (catálogo tipos de documento) |
| `003_platform_users.sql` | Tablas `platform_users` + `platform_permissions` y funciones `is_platform_user/admin`, `has_platform_permission`, `get_tenant_id` |
| `004_admin_org_dual_role.sql` | Redefine `get_tenant_id()` para identidad dual admin/tenant (fast-path tenant_id en JWT antes del guard platform_role) |
| `005_platform_users_identity.sql` | Expande `platform_users` con nombre, apellido, documento, teléfono |
| `006_get_db_size.sql` | Función `get_db_size()` para métricas admin |
| `007_session_type_otp_channel.sql` | Agrega `session_type` (consent/firma) y `otp_channel` (email/sms/whatsapp) a `signing_sessions_results` |
| `008_schedule_cleanup.sql` | Programa `expire_sessions()` (cada 15 min) y `cleanup_otps()` (cada hora) vía pg_cron |
| `009_signing_templates.sql` | Crea `signing_templates`; agrega `fields` a `signing_sessions_temp` y `template_id` a `signing_sessions_results` (Fase 2) |
| `010_tenant_whatsapp_config.sql` | Crea `tenant_whatsapp_config` (Fase 3) |

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

### tenants
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

### tenant_oauth
Conexión a la nube del cliente (Google Workspace o Microsoft 365). Tokens encriptados con pgcrypto (pgp_sym_encrypt).

| Columna | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| tenant_id | UUID FK UNIQUE | → tenants |
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

### tenant_sms_config
Gateway SMS Android del cliente. Secrets encriptados con pgcrypto.

| Columna | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| tenant_id | UUID FK UNIQUE | → tenants |
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
| tenant_id | UUID FK | → tenants |
| code | TEXT | C1, C2... UNIQUE con tenant_id |
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
| tenant_id | UUID FK | → tenants |
| session_type | TEXT | consent / firma. NOT NULL. CHECK constraint |
| mode | TEXT | natural_personal / natural_tutor (con representante) / juridica |
| access_token | TEXT | UNIQUE, gen_random_bytes(32) hex |
| token_expires_at | TIMESTAMPTZ | |
| status | TEXT | pending/opened/reviewing/awaiting_otp/completed/expired/cancelled |
| folio | TEXT | formato: PREFIX-CODE-YEAR-SEQ |
| pdf_hash | TEXT | SHA-256 |
| consent_hashes | JSONB | hash por cada consentimiento |
| otp_channel | TEXT | email / sms / whatsapp. Default 'email' |
| template_id | UUID FK NULL | → signing_templates(id). ON DELETE SET NULL. Solo session_type=firma (migración 009) |
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
Plantillas reutilizables del editor visual (modo firma). Migración 009. Límites por plan: trial 0 / basic 3 / pro 20 / enterprise ∞ (validados en `signing-service`, no en BD).

| Columna | Tipo | Notas |
|---|---|---|
| id | UUID PK | uuid_generate_v4() |
| tenant_id | UUID FK | → tenants |
| name | TEXT | NOT NULL |
| source_file_name | TEXT | Nombre original del PDF (display, no Drive ID) |
| page_count | INTEGER | |
| fields | JSONB | NOT NULL default '[]'. [{type, label, x, y, w, h, page, required}] |
| active | BOOLEAN | default true |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | trigger auto |

### tenant_whatsapp_config
Config de WhatsApp Business API del cliente. Migración 010. Secrets encriptados con pgcrypto. Cada cliente usa su propia cuenta de WhatsApp Business.

| Columna | Tipo | Notas |
|---|---|---|
| id | UUID PK | uuid_generate_v4() |
| tenant_id | UUID FK UNIQUE | → tenants, ON DELETE CASCADE |
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
| tenant_id | UUID PK | → tenants |
| code | TEXT PK | |
| year | INTEGER PK | |
| seq | INTEGER | default: 0 |

### audit_log
Inmutable. INSERT solo via service_role. Sin UPDATE ni DELETE.

| Columna | Tipo | Notas |
|---|---|---|
| id | BIGSERIAL PK | |
| tenant_id | UUID FK | → tenants |
| event_type | TEXT | NOT NULL |
| event_data | JSONB | sin datos personales |
| ip | INET | |
| ua | TEXT | |
| created_at | TIMESTAMPTZ | |

### platform_users
Usuarios internos de la plataforma (admin/analyst). Completamente separados de inscritos. Un admin no es una tenant.

| Columna | Tipo | Notas |
|---|---|---|
| id | UUID PK | uuid_generate_v4() |
| auth_user_id | UUID UNIQUE NOT NULL | auth.users(id) |
| email | TEXT UNIQUE NOT NULL | |
| first_name | TEXT NOT NULL | |
| last_name | TEXT NOT NULL | |
| doc_type | TEXT | sin CHECK en BD; en UI: CC/CE/PA/PEP/PPT/TI/NIT |
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
| permission | TEXT NOT NULL | CHECK: read:tenants, read:audit_log, read:sessions, read:catalogs, write:catalogs, read:metrics |
| granted_by | UUID FK | → platform_users |
| created_at | TIMESTAMPTZ | |
| UNIQUE(user_id, permission) | | |

---

## Funciones

### encrypt_secret(p_plaintext TEXT, p_key TEXT) → BYTEA
Encripta con pgp_sym_encrypt. SECURITY DEFINER. La llave la pasa la Edge Function desde Supabase Secret.

### decrypt_secret(p_ciphertext BYTEA, p_key TEXT) → TEXT
Desencripta con pgp_sym_decrypt. SECURITY DEFINER. La llave la pasa la Edge Function desde Supabase Secret.

### next_folio(p_tenant_id, p_code, p_year) → TEXT
INSERT ON CONFLICT UPDATE atómico. Lee folio_prefix de tenants. Retorna folio formateado: `{prefix}-{code}-{year}-{seq_padded}`. Ejemplo: `CT-C1-2026-0007`. SECURITY DEFINER.

### is_platform_user() → BOOLEAN
Retorna true si el JWT tiene app_metadata.platform_role. SECURITY DEFINER STABLE.

### is_platform_admin() → BOOLEAN
Retorna true si platform_role = 'admin'. SECURITY DEFINER STABLE.

### has_platform_permission(p_permission TEXT) → BOOLEAN
Admin retorna true siempre. Analyst busca en platform_permissions (filtrado por auth.uid() y active=true). SECURITY DEFINER STABLE.

### get_tenant_id() → UUID
Lee tenant_id del JWT (app_metadata) como fast path sin query. Si no existe y platform_role existe, retorna NULL (admin/analyst sin tenant). Si no tiene platform_role, fallback a SELECT por email (tenant users legacy). SECURITY DEFINER STABLE. Permite dual identity: admin con tenant_id obtiene su tenant. Migration 004.

### expire_sessions() → INTEGER
Marca como 'expired' las sesiones vencidas. Limpia signing_sessions_temp de sesiones expired/cancelled/completed.

### cleanup_otps() → INTEGER
Borra OTPs expirados hace más de 1 hora.

### fix_auth_user_token_defaults()
Trigger BEFORE INSERT en auth.users. Convierte NULLs a string vacío en confirmation_token, recovery_token, email_change_token_new. Previene crash de GoTrue al crear usuarios vía Admin API. SECURITY DEFINER.

### Límite de plantillas (Fase 2)
El límite de plantillas por plan se valida en la Edge Function `signing-service` (no en SQL): trial 0 / basic 3 / pro 20 / enterprise ∞.

### get_db_size() → JSON
Retorna `{db_bytes, storage_bytes}` (tamaño de la BD y del storage). Usada por `admin-service` para métricas. SECURITY DEFINER. Migración 006.

### update_updated_at()
Trigger en tenants, tenant_oauth, tenant_sms_config, tenant_whatsapp_config, consent_items, signing_templates, platform_users. Actualiza updated_at automáticamente.

---

## Row Level Security

Patrón: operaciones sensibles (INSERT en tablas críticas, OTP) pasan exclusivamente por Edge Functions con service_role, que bypasea RLS. El frontend solo tiene acceso de lectura/actualización filtrado.

| Tabla | Regla |
|---|---|
| tenants | Solo ve/edita la suya. Admin ve/edita todas. INSERT solo service_role. |
| tenant_oauth | Solo su config (select/insert/update). |
| tenant_sms_config | Solo su config (select/insert/update). |
| consent_items | Solo los suyos (CRUD completo). |
| signing_sessions_temp | El inscrito accede por session_id. Firmante accede por x-access-token header. El inscrito puede borrar los suyos. INSERT solo service_role. |
| signing_sessions_results | El inscrito ve las suyas y actualiza status. Firmante accede por access_token. Admin/analyst con read:sessions ve todas (solo metadatos). INSERT solo service_role. |
| otp_tokens | Bloqueado (sin policies). Solo service_role. |
| folio_sequence | Bloqueado para todos. Solo service_role. |
| signing_templates | Solo ve/edita las suyas (CRUD). tenant_id = get_tenant_id(). |
| tenant_whatsapp_config | Solo su config (select/insert/update). Mismo patrón que tenant_sms_config. |
| catalog_doc_types | SELECT público (anon + authenticated) donde active=true. Admin con write:catalogs puede CRUD. |
| audit_log | El inscrito ve los suyos. Admin/analyst con read:audit_log ve todos. INSERT solo service_role. Sin UPDATE ni DELETE. |
| platform_users | Admin ve todos, analyst ve solo el suyo. CRUD solo admin. |
| platform_permissions | Admin CRUD. Analyst ve los suyos. |

---

## Índices

- consent_items(tenant_id)
- signing_sessions_temp(session_id)
- signing_sessions_results(tenant_id, access_token, status, folio, session_type)
- signing_templates(tenant_id)
- otp_tokens(email), otp_tokens(email, purpose)
- audit_log(tenant_id, event_type, created_at)
- platform_users(auth_user_id)
- platform_permissions(user_id)
