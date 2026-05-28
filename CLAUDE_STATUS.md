# Estado del Proyecto — Consentia

**Última actualización:** 2026-05-28
**Sesión:** Sincronización de documentación con el código real

---

## Resumen

Proyecto Consentia (antes FirmaConsent) con documentación estructurada, schema de BD aplicado (migraciones 001–006), y servicios cloud configurados. **Ya existe código funcional:** frontend (login, registro, dashboard, firmar) + panel admin dual-role completo + Edge Functions (`admin-service`, `otp-service`). Fase 1 mayormente construida; pendiente el envío real de email OTP y las integraciones de nube (Drive/Sheets/PDF). Fases 2 y 3 no iniciadas.

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
| Schema BD (docs) | 12 tablas implementadas + 2 pendientes (signing_templates F2, org_whatsapp_config F3) |
| Migraciones SQL | 001–006 aplicadas; 007–008 creadas (pendiente aplicar). Pendiente: signing_templates (F2) y org_whatsapp_config (F3) |
| Supabase | ACTIVE_HEALTHY, 12 tablas, RLS habilitado, dual-role |
| Cloudflare | CLI instalada, autenticada. Tunnel pendiente |
| Frontend | Fase 1 completa: login, registro, dashboard, onboarding, consentimientos, consentimiento-solicitar, firmar + panel admin (5 páginas) |
| Edge Functions | `admin-service`, `otp-service`, `consent-service`, `drive-service` (Google+Microsoft). Pendiente runtime (OAuth/secrets/deploy) |
| App Android | No existe. Cero código (Fase 3) |
| Landing page | index.html en la raíz |

---

## Pendiente

### Issues señalados
- [x] **OTP a 8 dígitos:** estandarizado en `_shared/otp.ts` (generate_otp default 8) y `send.ts`.
- [x] **Envío de email OTP:** implementado en `send.ts` vía `drive-service/connection` + providers (Gmail/Graph del cliente, zero-knowledge).
- [ ] Verificar que el OTP de Supabase Auth (auth de cliente) esté configurado en 8 dígitos para cuadrar con la UI (ajuste manual en dashboard).

### Prerrequisitos para que Fase 1 funcione en runtime
- [ ] Configurar OAuth de Google (client ID/secret, scopes drive/gmail/sheets) y Microsoft (Entra app, Files/Mail).
- [ ] Supabase Secrets: `GOOGLE_CLIENT_ID/SECRET`, `MS_CLIENT_ID/SECRET`, `OAUTH_REDIRECT_BASE`.
- [ ] Aplicar migraciones 007 y 008 (`supabase db push`) y desplegar Edge Functions (`drive-service`, `consent-service`, `otp-service`).
- [ ] Habilitar pg_cron en Supabase (para migración 008).

### Inmediato
- [x] Agregar `ENCRYPTION_KEY` como Supabase Secret (completado sesión 2)
- [ ] Migración: folio_prefix default 'FC' → 'CT' (rebrand Consentia)
- [ ] Migración: signing_templates + org_whatsapp_config (tablas nuevas sesión 2)
- [ ] Configurar Cloudflare tunnel para SMS gateway
- [ ] Elegir y configurar dominio
- [ ] Commit con los docs actualizados + rebrand

### Fase 1 — Consentimiento (código completo, pendiente runtime)
1. ✅ Schema + migraciones (001–006 aplicadas; 007–008 creadas, pendiente aplicar)
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

### Fase 2 — Editor visual de firma electrónica
1. Frontend: documento-editor (drag & drop), documento-solicitar
2. firmar.html extendido (session_type=firma)
3. Edge Function: signing-service
4. Plantillas reutilizables (limitadas por plan, TBD)
5. PDF con campos aplicados

### Fase 3 — App HTTP para 2FA (SMS + WhatsApp)
1. App Android SMS gateway
2. WhatsApp Business API (cuenta de cada cliente)
3. Firmante elige canal
4. Onboarding extendido (config SMS + WhatsApp)
5. Términos de servicio
6. Facturación
7. Play Store

### Post-MVP
- [ ] API REST para integraciones externas
