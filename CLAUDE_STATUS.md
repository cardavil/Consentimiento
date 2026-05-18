# Estado del Proyecto — FirmaConsent

**Última actualización:** 2026-05-17
**Sesión:** Configuración inicial completa

---

## Resumen

Proyecto FirmaConsent inicializado con documentación estructurada, schema de BD con correcciones de seguridad, y servicios cloud configurados.

---

## Lo que se hizo

### 1. Estructura del repositorio

- Creado directorio `docs/` con 6 archivos de documentación
- Creado directorio `supabase/migrations/` con 2 migraciones
- Movidos archivos sueltos a sus ubicaciones correctas (`git mv`)
- Eliminadas todas las referencias a DiversoLab

**Estructura resultante:**
```
Consentimiento/
├── CLAUDE.md                          ← constitución del proyecto
├── CLAUDE_STATUS.md                   ← este archivo
├── README.md
├── docs/
│   ├── PRODUCT.md                     ← producto, pricing, roadmap, legal
│   ├── STACK.md                       ← tecnologías, arquitectura, costos
│   ├── DATABASE.md                    ← 9 tablas, RLS, funciones, índices
│   ├── FLOWS.md                       ← 7 flujos paso a paso
│   ├── SECURITY.md                    ← encriptación, SMS gateway, amenazas, marco legal
│   └── API.md                         ← endpoints REST (fase 3)
└── supabase/migrations/
    ├── 001_initial_schema.sql         ← schema inicial: 9 tablas, RLS, funciones
    └── 002_security_and_fixes.sql     ← correcciones de seguridad (8 issues)
```

### 2. CLAUDE.md reestructurado

Convertido de documento técnico extenso a constitución del proyecto:
- Qué es FirmaConsent (3 líneas)
- Alcance V1/V2
- Protocolo de trabajo (auditar → diagnosticar → planear → autorización → implementar)
- 8 reglas inquebrantables
- Convenciones de código
- Links a documentación

### 3. Auditoría del schema — 8 issues identificados y corregidos

| # | Issue | Fix en migración 002 |
|---|---|---|
| 1 | Tokens OAuth y API keys en TEXT plano | Columnas migradas a BYTEA, funciones encrypt_secret/decrypt_secret con pgcrypto |
| 2 | otp_tokens RLS abierto a todo el mundo | 3 policies eliminadas, solo accesible via service_role |
| 3 | INSERT público en tablas críticas | Policies de INSERT eliminadas en organizations, signing_sessions_results, signing_sessions_temp, audit_log |
| 4 | Sin FK entre signing_sessions_temp y results | FK agregada con ON DELETE CASCADE |
| 5 | get_org_id() hacía SELECT por cada evaluación RLS | Reescrita: lee org_id del JWT (fast path), fallback a SELECT |
| 6 | next_folio() no usaba folio_prefix | Retorna TEXT formateado: FC-C1-2026-0007. DROP + CREATE (cambio de tipo retorno) |
| 7 | Sin tracking de refresh de tokens OAuth | Columna last_refreshed_at agregada a org_oauth |
| 8 | Google Sheet sin partición por año | Columna history_sheets JSONB agregada: {"2026":"sheet_id"} |

**Decisión de encriptación:** pgcrypto parametrizado. Ya estaba en el schema, es estándar PostgreSQL, no depende de features específicos de Supabase. La llave vive como Supabase Secret, Edge Function la pasa como parámetro.

### 4. Redefinición del modo natural_tutor

El modo `natural_tutor` NO es solo para menores de edad. Aplica a cualquier persona que firma a través de representante legal:
- Menores de edad
- Adultos con discapacidad cognitiva
- Personas en interdicción
- Adultos mayores con curador

**Cambios:**
- Reordenado: modo 1 (natural_personal), modo 2 (natural_tutor), modo 3 (juridica)
- "Parentesco" renombrado a "Calidad" (madre, padre, tutor legal, representante legal, curador)
- Fecha nacimiento: obligatoria solo si tipo doc es TI o RC, opcional en los demás
- PDF genérico: "Firmado por [representante], en calidad de [calidad] de [nombre representado]"
- Juridica: campo "cargo" movido al final

### 5. Supabase configurado

- **Proyecto:** firmaconsent
- **Ref:** pgouzutwvronvsxgdizk
- **Organización:** cardavil
- **Región:** sa-east-1 (São Paulo) — elegida por proximidad legal a Colombia
- **Plan:** Free tier ($0/mes)
- **Migraciones aplicadas:** 001_initial_schema + 002_security_and_fixes
- **Estado:** ACTIVE_HEALTHY, 9 tablas, RLS habilitado, 0 rows

### 6. Cloudflare CLI instalada

- **Wrangler:** v4.92.0 instalado globalmente
- **Autenticación:** completada via OAuth
- **Pendiente:** configurar tunnel (SMS gateway) y DNS (cuando se tenga dominio)

---

## Commits

| Hash | Mensaje |
|---|---|
| 7fbfd8b | Restructure docs, add migration 002 security fixes, update natural_tutor mode |
| 54fc5b8 | Fix next_folio: DROP before CREATE to change return type from INTEGER to TEXT |

---

## Pendiente

### Inmediato
- [ ] Agregar `ENCRYPTION_KEY` como Supabase Secret
- [ ] Configurar Cloudflare tunnel para SMS gateway
- [ ] Elegir y configurar dominio

### Fase 1 (próxima)
- [ ] Edge Functions: otp-service, consent-service
- [ ] Frontend: registro.html, firma.html
- [ ] Login Edge Function debe setear `app_metadata.org_id` en JWT
- [ ] Todas las Edge Functions deben usar service_role para operaciones sensibles

### Fase 2
- [ ] Login + onboarding + dashboard
- [ ] Drive picker + consent CRUD

### Fase 3
- [ ] Drive/OneDrive integration + Sheets historial
- [ ] PDF generation con pdf-lib
- [ ] API REST

### Fase 4
- [ ] Landing + términos + facturación
- [ ] App Android SMS Gateway → Play Store
- [ ] Primeros 5 clientes
