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
| Migraciones SQL | 001–006 aplicadas (12 tablas). Pendiente: signing_templates (F2) y org_whatsapp_config (F3) |
| Supabase | ACTIVE_HEALTHY, 12 tablas, RLS habilitado, dual-role |
| Cloudflare | CLI instalada, autenticada. Tunnel pendiente |
| Frontend | Fase 1 construida: login, registro, dashboard, firmar + panel admin (5 páginas). Pendiente: onboarding, consentimiento-solicitar |
| Edge Functions | `admin-service` (completa), `otp-service` (envío de email STUB). Pendiente: consent-service, drive-service, pdf-generator |
| App Android | No existe. Cero código (Fase 3) |
| Landing page | index.html en la raíz |

---

## Pendiente

### Issues señalados (a resolver — no son diseño)
- [ ] **OTP largo inconsistente:** `config.js`/UI usan 8 dígitos, pero `otp-service/otp_check.ts` genera 6. Estandarizar `otp-service` a **8**.
- [ ] **Envío de email OTP es STUB:** `otp-service/send.ts` solo hace `console.log`. Falta integrar Gmail/Graph del cliente (firmante, zero-knowledge).
- [ ] Verificar que el OTP de Supabase Auth (auth de cliente) esté configurado en 8 dígitos para cuadrar con la UI.

### Inmediato
- [x] Agregar `ENCRYPTION_KEY` como Supabase Secret (completado sesión 2)
- [ ] Migración: folio_prefix default 'FC' → 'CT' (rebrand Consentia)
- [ ] Migración: signing_templates + org_whatsapp_config (tablas nuevas sesión 2)
- [ ] Configurar Cloudflare tunnel para SMS gateway
- [ ] Elegir y configurar dominio
- [ ] Commit con los docs actualizados + rebrand

### Fase 1 — Consentimiento
1. ✅ Schema + migraciones (001–006 aplicadas)
2. Edge Functions: ⏳ otp-service (envío email STUB), ❌ consent-service, ❌ drive-service, ❌ pdf-generator
3. Frontend: ✅ login, registro, dashboard, firmar · ❌ onboarding, consentimiento-solicitar
4. ⏳ Landing page (index.html existe)
5. ❌ Drive/OneDrive integration (OAuth, file picker, preview)
6. ❌ Google Sheets historial
7. ❌ PDF con pdf-lib

OTP factor 2: email-only en esta fase (firmante zero-knowledge vía cliente).

> **Adicional construido (no estaba en el plan original de Fase 1):** panel admin dual-role completo (`admin-service` + 5 páginas) con métricas, CRUD orgs, catálogos, auditoría y gestión de analistas.

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
