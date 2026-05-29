# Estado del Proyecto — Consentia

**Última actualización:** 2026-05-28
**Sesión:** Auditoría de código + despliegue runtime (migraciones + Edge Functions)

---

## Resumen

Proyecto Consentia (antes FirmaConsent). **Código de las 3 fases completo** (consentimiento, firma visual, 2FA SMS/WhatsApp + app Android), auditado y con remediación aplicada. **Runtime desplegado:** migraciones 001–010 aplicadas en Supabase (pg_cron activo) y las 6 Edge Functions desplegadas. **Aún no funciona end-to-end** porque falta la configuración externa: apps OAuth (Google/Microsoft) + secrets, y SMTP propio + OTP 8 dígitos en Supabase Auth. Pendiente además la migración 011 de hardening (opcional, no bloquea pruebas).

---

## Lo que se hizo

### Sesión 1 — Configuración inicial (2026-05-17)

- Estructura del repositorio: `docs/` (7 archivos), `supabase/migrations/`
- CLAUDE.md como constitución del proyecto
- Schema BD: 9 tablas, RLS, funciones, 8 issues de seguridad corregidos
- Redefinición de natural_tutor (aplica a cualquier persona con representante legal)
- Supabase configurado: proyecto firmaconsent, ref pgouzutwvronvsxgdizk, org cardavil, sa-east-1, free tier
- Cloudflare CLI (wrangler v4.92.0) instalada y autenticada

### Sesión 2 — Redefinición de alcance MVP + Marca (2026-05-27)

- Roadmap redefinido: de 4 fases incrementales a 3 fases de producto + Post-MVP
- Dos modos mutuamente excluyentes: consentimiento + documento (firma electrónica visual)
- WhatsApp Business API como canal OTP (cuenta propia de cada cliente)
- Plantillas de firma limitadas por plan (monetización)
- Página única del firmante: `firmar.html?token=xxx` (detecta session_type)
- Nomenclatura nueva de páginas: `consentimiento-solicitar`, `documento-solicitar`, `documento-editor`, `firmar`
- Schema actualizado: 9 → 11 tablas (+signing_templates, +org_whatsapp_config)
- Todos los docs actualizados para reflejar el nuevo alcance
- **Rebrand:** FirmaConsent → Consentia. Manual de marca aprobado (`docs/mockups/manual-marca-consentia.html`)
- Design system: DM Serif Display + DM Sans + IBM Plex Mono, paleta teal profesional
- Folio prefix: FC → CT
- Infraestructura: Supabase restaurado y linkeado, Google Cloud Project creado (4 APIs habilitadas)

### Sesión 3 — Construcción Fase 1 + panel admin (2026-05-28)

- **Frontend Fase 1:** login (OTP email), registro 3 pasos (natural/jurídica), dashboard cliente, firmar (modo consentimiento).
- **Panel admin dual-role:** 5 páginas (`admin/index|orgs|catalogs|audit|analysts.html`) con guard de sesión y nav por permisos.
- **Edge Functions:** `admin-service` (métricas, CRUD orgs, invitar analistas, permisos, bootstrap org) y `otp-service` (generar/verificar OTP, registro). `_shared` (cors, response, supabase client).
- **Migraciones nuevas:** 002 (catalog_doc_types), 003 (platform_users + permissions + funciones de plataforma), 004 (dual-role get_org_id), 005 (identidad platform_users), 006 (get_db_size).
- **SMTP propio configurado** en Supabase Auth para OTP de login/registro (ya no aplica el límite 2/hora del SMTP por defecto).
- **Documentación sincronizada** con el código real (este commit): README, STACK, CONVENTIONS, DATABASE, FLOWS, SECURITY, API.

### Sesión 4 — Fase 2 (firma) + Fase 3 (2FA) (2026-05-28)

- **Fase 2 — Editor visual de firma:** migración 009 (`signing_templates`, `fields` en temp, `template_id` en results); Edge Function `signing-service` (create_template con límite por plan 0/3/20/∞, create_session, sign con `pdf_firma.ts`, get_document, get_channels); frontend `documento-editor` (pdf.js + drag), `documento-solicitar`, `plantillas`, modo firma en `firmar.html` + `firmar-fields.js` (pad de firma). `pdf_evidence.ts` extraído y compartido.
- **Fase 3 — 2FA SMS + WhatsApp:** migración 010 (`org_whatsapp_config`); canales `_shared/channels/{sms,whatsapp}.ts`; router de canal en `otp-service`; `config-service` (guardar config encriptada + test); onboarding extendido (SMS/WhatsApp); selector de canal en `firmar.html`.
- **App Android (`android/`):** proyecto Kotlin completo — `GatewayService` (foreground + boot), `HttpServer` (NanoHTTPD), 5 capas de seguridad, `SmsSender`, `PairingStore` (EncryptedSharedPreferences), `MainActivity` (vinculación QR).
- **Estado:** código de las 3 fases completo; **no probado en runtime** (requiere credenciales OAuth/Meta, secrets, despliegue, gateway).

### Sesión 5 — Auditoría + despliegue runtime (2026-05-28)

- **Auditoría de código** (CSS hardcodeado, duplicación, código muerto, seguridad, escalabilidad) + **remediación en 4 lotes** (commit): eliminado `modales.js` muerto; deduplicado `org_display_name`/`sha256_bytes`/`sign_out`; `init_app_page()` y `signer-form.js` compartidos; historial Microsoft atómico (ETag/If-Match); guardas de tamaño + tope OTP por sesión; tokens CSS centralizados.
- **Migraciones 007–010 aplicadas** en `firmaconsent` vía MCP de Supabase. **pg_cron activo** (`expire_sessions` cada 15 min, `cleanup_otps` cada hora).
- **Edge Functions desplegadas** (`supabase functions deploy`): admin, otp, drive, consent, signing, config.
- **Auditoría de BD** (advisors): hallazgos de hardening → planeada **migración 011** (revoke EXECUTE en encrypt/decrypt_secret/next_folio/get_db_size/fix_auth_user_token_defaults; `SET search_path` en SECURITY DEFINER; índices FK; opcional reescribir 5 policies RLS). **No aplicada aún** (opcional, no bloquea pruebas).
- Confirmado: BD limpia, solo `db.carlosm@gmail.com` (admin + org jurídica); sin rastro de diversolab. Hosting: GitHub Pages activo en `https://cardavil.github.io/Consentimiento/`.

---

## Commits

| Hash | Mensaje |
|---|---|
| 7fbfd8b | Restructure docs, add migration 002 security fixes, update natural_tutor mode |
| 54fc5b8 | Fix next_folio: DROP before CREATE to change return type from INTEGER to TEXT |
| 606f72d | Fix DATABASE.md: signing_sessions_temp DELETE is allowed for org, not service_role only |
| c8e6bec | Consolidate schema into single file, fix API.md mode names |
| a4cea11 | Replace deprecated anon key refs with publishable key, add migration 003 |
| 1db2c99 | Add coding conventions and update project structure |
| 8d26f34 | Add project status document with session summary |

---

## Estado actual

| Qué | Estado |
|---|---|
| Marca | Consentia — manual aprobado en docs/mockups/manual-marca-consentia.html |
| Documentación | Sincronizada con el código real (README + 7 docs) |
| Schema BD | 14 tablas implementadas |
| Migraciones SQL | **001–010 aplicadas** en firmaconsent. pg_cron activo. Pendiente: 011 (hardening, opcional) |
| Supabase | ACTIVE_HEALTHY, 14 tablas, RLS, dual-role. Proyecto: `pgouzutwvronvsxgdizk` |
| Edge Functions | **Desplegadas**: admin, otp, drive, consent, signing, config. Falta config externa (OAuth/secrets) para correr |
| Frontend | 3 fases + panel admin. **GitHub Pages activo** en `https://cardavil.github.io/Consentimiento/` |
| Cloudflare | CLI instalada, autenticada. Tunnel pendiente (Fase 3 SMS) |
| App Android | `android/` proyecto Kotlin completo (gateway SMS). Pendiente compilar/probar/Play Store |
| Landing page | index.html redirige a login |

---

## Pendiente

### Issues señalados
- [x] **OTP a 8 dígitos:** estandarizado en `_shared/otp.ts` (generate_otp default 8) y `send.ts`.
- [x] **Envío de email OTP:** implementado en `send.ts` vía `drive-service/connection` + providers (Gmail/Graph del cliente, zero-knowledge).
- [ ] Verificar que el OTP de Supabase Auth (auth de cliente) esté configurado en 8 dígitos para cuadrar con la UI (ajuste manual en dashboard).

### Para correr end-to-end (config externa — bloquea pruebas)
- [ ] App OAuth **Google** (client ID/secret; redirect `https://cardavil.github.io/Consentimiento/frontend/pages/onboarding.html`; scopes drive.readonly/drive.file/spreadsheets/gmail.send) y app **Entra Microsoft** (personal accounts para Hotmail: Files.ReadWrite, Mail.Send, offline_access).
- [ ] Supabase Secrets: `GOOGLE_CLIENT_ID/SECRET`, `MS_CLIENT_ID/SECRET`, `OAUTH_REDIRECT_BASE=https://cardavil.github.io/Consentimiento/frontend/pages`. (`ENCRYPTION_KEY` ya está.)
- [ ] SMTP propio + OTP a **8 dígitos** en Supabase Auth (para OTP de registro/login).

### Hardening / pulido (no bloquea pruebas)
- [ ] **Migración 011**: revoke EXECUTE en encrypt/decrypt_secret + sensibles, `SET search_path` en SECURITY DEFINER, índices FK, policies RLS `(select …)`.
- [ ] Migración: `folio_prefix` default 'FC' → 'CT' (en 001 sigue en 'FC').
- [ ] Cloudflare tunnel + compilar/probar app Android (Fase 3 SMS).
- [ ] Verificar OTP de Supabase Auth en 8 dígitos (cuadra con la UI).
- [ ] Dominio propio (opcional).

### Fase 1 — Consentimiento (código completo, pendiente runtime)
1. ✅ Schema + migraciones (001–010 aplicadas en Supabase)
2. ✅ Edge Functions: otp-service (envío real), consent-service (create_session + sign + pdf.ts), drive-service (OAuth + providers Google/Microsoft)
3. ✅ Frontend: login, registro, dashboard, firmar, onboarding, consentimientos, consentimiento-solicitar
4. ⏳ Landing page (index.html redirige a login)
5. ✅ Drive/OneDrive integration (OAuth, list, download, upload) — Google + Microsoft
6. ✅ Google Sheets / CSV historial (append por proveedor)
7. ✅ PDF con pdf-lib (constancia autocontenida: documentos + evidencia)

OTP factor 2: email-only en esta fase (firmante zero-knowledge vía cliente).

> **Nota:** el código de Fase 1 está completo pero **no probado en runtime** (requiere credenciales OAuth + secrets + despliegue, ver prerrequisitos arriba). Las integraciones con Gmail/Drive/Sheets y Graph se escribieron correct-by-construction vía REST.

> **Adicional ya construido:** panel admin dual-role completo (`admin-service` + 5 páginas) con métricas, CRUD orgs, catálogos, auditoría y gestión de analistas.

### Limitaciones conocidas (a pulir)
- Preview de documentos en `firmar.html` usa iframe de Google Drive; documentos de OneDrive no previsualizan (el PDF final sí embebe sus páginas).
- Microsoft: historial se guarda como CSV en OneDrive (no workbook xlsx).
- Landing real pendiente (hoy redirige a login).

### Fase 2 — Editor visual de firma electrónica — ✅ código construido
1. ✅ documento-editor (drag & drop, pdf.js), documento-solicitar
2. ✅ firmar.html extendido (session_type=firma) + firmar-fields (pad)
3. ✅ Edge Function: signing-service
4. ✅ Plantillas reutilizables (límite por plan 0/3/20/∞)
5. ✅ PDF con campos aplicados (pdf_firma.ts)

### Fase 3 — App HTTP para 2FA (SMS + WhatsApp) — ✅ código construido (sin términos/facturación)
1. ✅ App Android SMS gateway (Kotlin) — falta compilar/probar
2. ✅ WhatsApp Business API (cuenta de cada cliente)
3. ✅ Firmante elige canal
4. ✅ Onboarding extendido (config SMS + WhatsApp)
5. ❌ Términos de servicio (fuera de alcance acordado)
6. ❌ Facturación (fuera de alcance acordado)
7. ❌ Play Store

### Post-MVP
- [ ] API REST para integraciones externas
