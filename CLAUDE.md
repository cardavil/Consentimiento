# CLAUDE.md — Consentia

> **IMPORTANTE:** Al inicio de cada sesión, leer [docs/CLAUDE_ERRORS.md](docs/CLAUDE_ERRORS.md) para no repetir errores documentados.

## Qué es

Plataforma multi-tenant de consentimiento informado y firma electrónica con verificación de identidad (email OTP; SMS/WhatsApp en Fase 3), evidencia criptográfica, y arquitectura zero-knowledge. Dos modos mutuamente excluyentes: consentimiento y documento (firma electrónica visual). Producto independiente.

## Alcance MVP

Las 3 fases son MVP. Todas deben estar completas antes del primer cliente.

- **Fase 1 — Consentimiento:** flujo completo de consentimiento, landing page, OTP email-only
- **Fase 2 — Editor visual firma:** drag & drop campos sobre PDF de Drive, plantillas reutilizables (limitadas por plan)
- **Fase 3 — App HTTP 2FA:** app Android SMS gateway + WhatsApp Business API (cuenta del cliente), términos, facturación
- **Post-MVP:** API REST

## Protocolo de trabajo

Claude SIEMPRE sigue este protocolo, sin importar el tamaño del cambio:

1. **Auditar** — Leer el estado actual del código, archivos, y contexto relevante
2. **Diagnosticar** — Identificar qué se necesita, qué impacta, qué riesgos hay
3. **Planear** — Proponer un plan concreto con los cambios específicos
4. **Solicitar autorización** — Presentar el plan al usuario y esperar aprobación explícita
5. **Implementar** — Ejecutar solo lo aprobado, nada más

Un cambio de una línea sigue el mismo protocolo que una migración de 500 líneas. Sin excepciones.

## Reglas inquebrantables

- **NUNCA** hacer cambios sin autorización explícita del usuario
- **NUNCA** almacenar datos personales del firmante en la BD permanente
- **NUNCA** usar el SMTP por defecto de Supabase Auth (límite 2/hora); usar el SMTP propio configurado en Supabase Auth
- **NUNCA** usar Google Apps Script (se está migrando desde ahí)
- **NUNCA** mezclar datos de persona con datos de empresa en la misma lógica
- **NUNCA** asumir que natural_tutor es solo menores — aplica a cualquier persona que firma a través de representante legal
- **NUNCA** crear tablas innecesarias (si los datos viven en el PDF/Sheet del cliente, no duplicar)
- **NUNCA** mezclar consentimiento y firma en la misma solicitud — modos mutuamente excluyentes (riesgo legal)
- **NUNCA** usar una cuenta central de WhatsApp — cada cliente usa su propia cuenta de WhatsApp Business
- **NUNCA** asumir — preguntar. El autor es CARDAVIL.

## Convenciones

- Columnas en inglés, cortas, sin prefijos redundantes
- Frontend: HTML/CSS/JS estático, sin framework, sin build step
- Design tokens: --gris-azulado, --verde-profundo, --teal, --azul-grisaceo, --fondo, --gris-oscuro, --gris-claro, --teal-soft, --teal-dark, --danger
- Fonts: DM Serif Display (display) + DM Sans (body/UI) + IBM Plex Mono (code/datos)
- Edge Functions en TypeScript/Deno
- APIs externas (Gmail, Drive, Sheets) via OAuth del cliente
- WhatsApp Business API via cuenta propia de cada cliente (Fase 3)
- PDF con pdf-lib, nunca Google Docs templates

## Documentación

- [docs/CONVENTIONS.md](docs/CONVENTIONS.md) — convenciones de código por capa
- [docs/PRODUCT.md](docs/PRODUCT.md) — producto, diferenciadores, pricing, roadmap, legal
- [docs/STACK.md](docs/STACK.md) — tecnologías, arquitectura, costos, estructura del proyecto
- [docs/DATABASE.md](docs/DATABASE.md) — schema, tablas, RLS, funciones
- [docs/FLOWS.md](docs/FLOWS.md) — flujos paso a paso
- [docs/SECURITY.md](docs/SECURITY.md) — gateway SMS, evidencia, amenazas, marco legal
- [docs/API.md](docs/API.md) — endpoints REST
