# Estado del Proyecto — Consentia

**Última actualización:** 2026-05-27
**Sesión:** Redefinición de alcance MVP (3 fases)

---

## Resumen

Proyecto Consentia (antes FirmaConsent) con documentación estructurada, schema de BD diseñado, y servicios cloud configurados. No hay código funcional aún — solo documentación, migraciones SQL, configuración de infraestructura, y manual de marca aprobado.

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
| Documentación | Completa (8 docs actualizados con alcance MVP 3 fases + rebrand) |
| Schema BD (docs) | 11 tablas documentadas en DATABASE.md |
| Migraciones SQL | 001_initial_schema.sql aplicada (9 tablas). Pendiente migración para signing_templates y org_whatsapp_config |
| Supabase | ACTIVE_HEALTHY, 9 tablas, RLS habilitado, 0 rows |
| Cloudflare | CLI instalada, autenticada. Tunnel pendiente |
| Frontend | No existe. Cero código |
| Edge Functions | No existen. Cero código |
| App Android | No existe. Cero código |
| Landing page | No existe |

---

## Pendiente

### Inmediato
- [x] Agregar `ENCRYPTION_KEY` como Supabase Secret (completado sesión 2)
- [ ] Migración: folio_prefix default 'FC' → 'CT' (rebrand Consentia)
- [ ] Migración: signing_templates + org_whatsapp_config (tablas nuevas sesión 2)
- [ ] Configurar Cloudflare tunnel para SMS gateway
- [ ] Elegir y configurar dominio
- [ ] Commit con los docs actualizados + rebrand

### Fase 1 — Consentimiento
1. Schema + migraciones (tablas ya diseñadas, falta aplicar cambios de sesión 2)
2. Edge Functions: otp-service, consent-service, drive-service, pdf-generator
3. Frontend: login, registro, onboarding, dashboard, consentimiento-solicitar, firmar
4. Landing page
5. Drive/OneDrive integration (OAuth, file picker, preview)
6. Google Sheets historial
7. PDF con pdf-lib

OTP factor 2: email-only en esta fase.

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
