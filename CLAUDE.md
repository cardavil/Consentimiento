# CLAUDE.md — FirmaConsent (nombre temporal)

## Qué es

Microservicio de consentimiento informado con verificación dual (email + SMS OTP), evidencia criptográfica, y arquitectura zero-knowledge. Separado de DiversoLab Members Conecta como producto independiente.

## Conceptos fundamentales

- **Multi-tenant:** 200+ clientes (organizaciones) en la misma plataforma. Aislamiento por RLS con organization_id.
- **Single sign:** cada solicitud de consentimiento es para UN firmante. Una persona, una sesión, un PDF.
- **Zero-knowledge:** la plataforma NO almacena documentos, datos personales del firmante, ni contenido de consentimientos. Solo hashes, folios, y metadatos operativos. Los datos del firmante viven en signing_sessions_temp mientras el proceso está activo y se borran al completar.
- **El producto profesa lo que vende:** el registro del propio cliente usa SMS OTP. Login usa email OTP.

## Stack

- **Frontend:** GitHub Pages (HTML/CSS/JS estático)
- **Backend:** Supabase (PostgreSQL + Auth + Edge Functions)
- **Email:** Gmail API o Microsoft Graph via OAuth del cliente (NO el email de Supabase que tiene límite de 2/hora)
- **SMS:** App Android gateway en el teléfono del cliente, comunicación via Cloudflare Tunnel
- **PDF:** pdf-lib en Edge Function (NO Google Docs template)
- **Almacenamiento:** Drive/OneDrive del cliente via OAuth
- **Historial:** Google Sheet en la carpeta del cliente, actualizado automáticamente

## Origen

Migración de DiversoLab Members Conecta (GitHub Pages + Supabase + Google Apps Script). El sistema actual tiene:
- 6 páginas desplegadas, 8 tablas, 7 migraciones, 24 RLS, 3 servicios GAS (OTP v1.21, Firma v1.7, Drive v1.0)
- Firma E2E con 7 consentimientos (C1-C7), folios secuenciales, hashes SHA-256
- Design system: tokens.css + componentes.css (colores sol/aqua/coral/lavanda/violeta/crema, fonts Titillium Web + PT Sans)
- El documento CONSOLIDADO-SISTEMA.md tiene los mockups, pipelines, schema BD actual, y modelo de seguridad completo

GAS se elimina completamente. Toda la lógica migra a Supabase Edge Functions.

## Base de datos

Supabase nuevo, proyecto independiente. 9 tablas:

### organizations
La persona siempre existe. La empresa solo si es jurídica. Si type = juridica, doc_type se pone en NIT automáticamente en el frontend.

### org_oauth
Conexión a la nube del cliente (Google Workspace o Microsoft 365). Tokens encriptados. drive_folder_id, history_sheet_id, sender_email.

### org_sms_config
Gateway SMS Android. gateway_url, api_key (encriptado), hmac_secret (encriptado), enabled.

### consent_items
Consentimientos configurados por cada cliente. code, title, description, required (por defecto), sort_order, active.

### signing_sessions_temp
Datos operativos en tránsito: documents (JSONB), consents (JSONB), signer (JSONB), context. Se vincula a signing_sessions_results por session_id. **SE BORRA al completar la firma.**

### signing_sessions_results
Registro permanente zero-knowledge. mode (natural_personal/natural_tutor/juridica), access_token, status, folio, pdf_hash, consent_hashes (JSONB). **NO contiene datos del firmante, documentos, ni contexto.**

### otp_tokens
Temporales. email, code_hash (nunca el código en claro), purpose (login/register/sign), attempts, expires_at, verified_at. Se limpian automáticamente.

### folio_sequence
PK compuesta: organization_id + code + year. Función next_folio() atómica.

### audit_log
Inmutable. Solo INSERT y SELECT. event_type, event_data (JSONB sin datos personales), ip, ua.

## RLS

- Cada tabla filtra por organization_id via get_org_id() que lee el JWT
- Firmante accede a signing_sessions_results y signing_sessions_temp por access_token sin autenticación
- folio_sequence: solo service_role (Edge Functions)
- otp_tokens: abierto, seguridad en Edge Function
- audit_log: sin UPDATE ni DELETE

## Flujos principales

### Registro del cliente
Paso 1: tipo (natural/juridica) → Paso 2: formulario según tipo → Paso 3: consentimiento de servicio de la plataforma + OTP por SMS → cuenta creada

### Login
Email → OTP por email → dashboard

### Onboarding (primera vez)
1. SMS Gateway: QR descarga app Android → QR configuración (api_key + hmac_secret + url encriptados) → test SMS
2. Nube: conectar Google Drive o OneDrive via OAuth → seleccionar carpeta → creación automática Google Sheet historial. Todo nube, sin opción local.

### Dashboard
- Card documentos: lista archivos del Drive del cliente. Solo lectura, no es editor.
- Card consentimientos: configurar título, texto, obligatoriedad. CRUD.
- Botón "Solicitar consentimiento": formulario con 3 modos (natural_personal, natural_tutor, juridica) + selección de documentos a embeber + selección de consentimientos con dos columnas (incluir + obligatoriedad)

### Solicitar consentimiento (single sign)
Cliente llena datos del firmante → selecciona documentos de su Drive → selecciona consentimientos → envía → firmante recibe email

### Experiencia del firmante
Abre enlace (factor 1) → ve datos → lee documentos (iframe desde Drive del cliente) → marca consentimientos (nunca prellenados) → SMS OTP (factor 2) → confirmación con tabla de folios/hashes

### Después de firmar
PDF generado → hash SHA-256 → sube a Drive del cliente → fila en Google Sheet → copia al firmante por email → signing_sessions_temp se borra → signing_sessions_results queda con hashes

## Menor de edad / con tutor (mode = natural_tutor)

Ley 1098 de 2006 + Art. 12 Ley 1581 de 2012. El consentimiento lo da el representante legal, no el menor.

Datos del menor: nombre, apellido, TI (7-17) o RC (<7), número, fecha nacimiento.
Datos del representante: nombre, apellido, CC/CE/PA, número, parentesco, email (enlace), teléfono (OTP).

OTP va al representante. En el PDF: "Firmado por [representante], en calidad de [parentesco] del menor [nombre]."

Verificar la relación tutor-menor es responsabilidad del cliente, no de la plataforma.

## Seguridad SMS Gateway (5 capas)

1. API Key (comparación constant-time)
2. Timestamp ±30 segundos
3. Nonce único (anti-replay)
4. Firma HMAC-SHA256 del payload
5. Rate limiting configurable

App Android con NanoHTTPD, SmsManager nativo, foreground service, auto-inicio. Vinculación por QR.

## Marco legal colombiano

- Ley 527/1999: firma electrónica simple válida
- Decreto 2364/2012: misma validez que manuscrita
- Ley 1581/2012: plataforma es encargado del tratamiento, no responsable
- Ley 1098/2006: menores requieren representante legal
- Decreto 1377/2013: consentimiento verificable con fecha/hora

## Disclaimer de responsabilidad

La plataforma es la herramienta. El cliente es responsable del contenido de sus documentos, consentimientos, obligatoriedad, cumplimiento normativo, relación tutor-menor, y custodia de PDFs. La plataforma es responsable de infraestructura, integridad criptográfica, e inmutabilidad de registros.

## Roadmap

- **V1:** configuración de consentimientos (título + texto + obligatoriedad) + solicitar consentimiento + firma + SMS OTP
- **V2:** editor visual tipo DocuSign (marcar checkboxes sobre el documento preview)

## Convenciones

- Nombres de columnas en inglés, cortos, sin prefijos redundantes (no admin_email si la tabla ya es de la organización)
- Frontend: HTML/CSS/JS estático, sin framework, sin build step
- Design tokens heredados de DiversoLab: --color-sol, --color-aqua, --color-coral, --color-lavanda, --color-violeta, --color-crema
- Edge Functions en TypeScript/Deno
- Toda comunicación con APIs externas (Gmail, Drive, Sheets) via OAuth del cliente
- PDF generado con pdf-lib, nunca con Google Docs templates

## Archivos clave

- `docs/FirmaConsent_Documento_de_Producto_v2.md` — documento de producto completo
- `supabase/migrations/001_initial_schema.sql` — schema con 9 tablas y RLS
- `CONSOLIDADO-SISTEMA.md` (en el repo de DiversoLab) — referencia del sistema actual con mockups, pipelines, y schema original

## Qué NO hacer

- No almacenar datos personales del firmante en la BD permanente
- No usar el email de Supabase Auth (2/hora)
- No usar Google Apps Script (se está migrando desde ahí)
- No mezclar datos de persona con datos de empresa en la misma lógica de campos
- No crear tablas innecesarias (si los datos viven en el PDF/Sheet del cliente, no duplicar en BD)
- No asumir — preguntar. El autor es CARDAVIL, no DiversoLAB.
