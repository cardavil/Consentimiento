# CLAUDE.md — FirmaConsent

## Qué es

Plataforma multi-tenant de consentimiento informado con verificación dual (email + SMS OTP), evidencia criptográfica, y arquitectura zero-knowledge. Producto independiente.

## Alcance V1

Configuración de consentimientos (título + texto + obligatoriedad) + solicitar consentimiento + firma + SMS OTP.

V2: editor visual tipo DocuSign (marcar checkboxes sobre el documento preview).

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
- **NUNCA** usar el email de Supabase Auth (límite 2/hora)
- **NUNCA** usar Google Apps Script (se está migrando desde ahí)
- **NUNCA** mezclar datos de persona con datos de empresa en la misma lógica
- **NUNCA** asumir que natural_tutor es solo menores — aplica a cualquier persona que firma a través de representante legal
- **NUNCA** crear tablas innecesarias (si los datos viven en el PDF/Sheet del cliente, no duplicar)
- **NUNCA** asumir — preguntar. El autor es CARDAVIL.

## Convenciones

- Columnas en inglés, cortas, sin prefijos redundantes
- Frontend: HTML/CSS/JS estático, sin framework, sin build step
- Design tokens: --color-sol, --color-aqua, --color-coral, --color-lavanda, --color-violeta, --color-crema
- Fonts: Titillium Web + PT Sans
- Edge Functions en TypeScript/Deno
- APIs externas (Gmail, Drive, Sheets) via OAuth del cliente
- PDF con pdf-lib, nunca Google Docs templates

## Documentación

- [docs/PRODUCT.md](docs/PRODUCT.md) — producto, diferenciadores, pricing, roadmap, legal
- [docs/STACK.md](docs/STACK.md) — tecnologías, arquitectura, costos, estructura del proyecto
- [docs/DATABASE.md](docs/DATABASE.md) — schema, tablas, RLS, funciones
- [docs/FLOWS.md](docs/FLOWS.md) — flujos paso a paso
- [docs/SECURITY.md](docs/SECURITY.md) — gateway SMS, evidencia, amenazas, marco legal
- [docs/API.md](docs/API.md) — endpoints REST
