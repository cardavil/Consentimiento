# Consentia

Plataforma multi-tenant de **consentimiento informado** y **firma electrónica** con verificación de identidad (OTP), evidencia criptográfica y arquitectura **zero-knowledge**: los documentos viven en el Drive del cliente y los datos del firmante no se almacenan de forma permanente.

Dos modos mutuamente excluyentes por solicitud:

- **Consentimiento** — documento embebido desde Drive + ítems de consentimiento (checkbox "Leí y acepto").
- **Documento (firma electrónica)** — editor visual donde se arrastran campos (firma, fecha, iniciales, checkbox, texto) sobre un PDF.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | HTML/CSS/JS estático (GitHub Pages), sin framework ni build |
| Backend | Supabase: PostgreSQL + RLS + Auth + Edge Functions (Deno/TypeScript) |
| OTP auth (login/registro) | Supabase Auth con SMTP propio |
| OTP firmante | Gmail API / Microsoft Graph del cliente (zero-knowledge) |
| Almacenamiento | Drive/OneDrive del cliente vía OAuth |
| PDF | pdf-lib en Edge Function |
| 2FA (Fase 3) | App Android SMS gateway + WhatsApp Business API (cuenta del cliente) |

## Alcance (MVP = 3 fases)

1. **Fase 1 — Consentimiento:** flujo completo, OTP email-only.
2. **Fase 2 — Editor visual de firma:** drag & drop sobre PDF, plantillas reutilizables.
3. **Fase 3 — App HTTP 2FA:** SMS gateway + WhatsApp Business API.

## Estructura

```
frontend/        HTML/CSS/JS estático (pages/, pages/admin/, js/, css/)
supabase/
  migrations/    001–006 (schema, RLS, funciones, dual-role)
  functions/     Edge Functions (admin-service, otp-service, _shared)
docs/            Documentación del proyecto
```

## Documentación

- [CLAUDE.md](CLAUDE.md) — constitución del proyecto y reglas inquebrantables
- [docs/PRODUCT.md](docs/PRODUCT.md) — producto, diferenciadores, pricing, roadmap, legal
- [docs/STACK.md](docs/STACK.md) — tecnologías, arquitectura, costos, estructura
- [docs/DATABASE.md](docs/DATABASE.md) — schema, tablas, RLS, funciones
- [docs/FLOWS.md](docs/FLOWS.md) — flujos paso a paso
- [docs/SECURITY.md](docs/SECURITY.md) — evidencia, amenazas, marco legal
- [docs/CONVENTIONS.md](docs/CONVENTIONS.md) — convenciones de código por capa
- [docs/API.md](docs/API.md) — endpoints REST (Post-MVP)
