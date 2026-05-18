# FirmaConsent (nombre temporal) — Plataforma de Consentimiento Informado

## Documento de Producto v2.3

**Fecha:** Mayo 2026
**Autor:** CARDAVIL
**Estado:** En desarrollo
**Clasificación:** Confidencial
**Base:** Sistema existente DiversoLab Members Conecta (en producción)
**Arquitectura:** Multi-tenant (200+ clientes) · Single sign (1 firmante por solicitud)

---

## 1. Qué es

Plataforma donde empresas (clínicas, consultorios, ONGs) envían consentimientos informados a sus clientes/pacientes con verificación de identidad por email + SMS, evidencia criptográfica, y copia para ambas partes.

**Multi-tenant:** 200+ empresas usan la misma plataforma. Cada una solo ve lo suyo.

**Single sign:** cada solicitud de consentimiento es para UNA persona. Un firmante, una sesión, un PDF. Si la empresa tiene 10 pacientes hoy, hace 10 solicitudes.

**Zero-knowledge:** los documentos del cliente viven en su Drive. Los datos del firmante pasan por la plataforma pero no se quedan. Solo se guardan hashes y metadatos operativos.

**El producto profesa lo que vende:** el propio registro del cliente usa SMS OTP. La experiencia de registrarse es la demo del servicio.

### Diferenciadores

- Consentimiento granular con folio y hash SHA-256 por cada punto
- Documentos siempre en el Drive del cliente, nunca en la plataforma
- SMS OTP desde el número del consultorio/empresa del cliente
- Copia idéntica del PDF para ambas partes
- Historial automático en Google Sheet en la carpeta del cliente
- Soporte para menores de edad (firma el representante legal)
- Precio accesible para PYMEs colombianas

---

## 2. Marco legal

**Ley 527/1999:** firma electrónica válida si es confiable e identifica a la persona. ✓

**Decreto 2364/2012:** firma electrónica simple = misma validez que manuscrita (excepto cuando se exige firma digital con certificado). ✓

**Ley 1581/2012:** protección de datos. La plataforma es encargado del tratamiento, no responsable. El cliente es el responsable. ✓

**Ley 1098/2006:** menores de edad requieren firma del representante legal. ✓

**Decreto 1377/2013:** consentimiento previo, expreso, informado, verificable con fecha y hora. ✓

### Qué NO es

No es firma digital avanzada (con certificado). No sirve para escrituras públicas ni trámites ante la DIAN que exijan firma digital.

### Responsabilidad

La plataforma es la herramienta. El cliente es responsable de:
- El contenido de sus documentos y consentimientos
- La clasificación de obligatoriedad
- Verificar la relación tutor-menor
- El cumplimiento normativo de su proceso
- La custodia de sus PDFs

La plataforma es responsable de:
- Que funcione, esté disponible y sea segura
- Que los hashes y folios sean íntegros
- No almacenar datos sensibles innecesariamente
- Que los registros de consentimiento sean inmutables

---

## 3. Arquitectura

### Stack

```
GitHub Pages              Supabase (gratis)           APIs del cliente
(HTML/CSS/JS)             (BD + Auth + Edge Fn)       (las paga el cliente)

Frontend ──────────►      PostgreSQL + RLS            
                          Edge Functions:             
                            otp-service        ──────► Gmail API (del cliente)
                            consent-service    ──────► Drive API (del cliente)
                            drive-service      ──────► Sheets API (del cliente)
                            pdf-generator             
                                                      
                          Gateway SMS (Android)       
                            via Cloudflare Tunnel     
```

### Por qué no GAS

El sistema actual usa Google Apps Script. Con 200 clientes y 500 firmantes/día, GAS revienta:
- 90 min/día de ejecución total (no se puede pagar más)
- 2 emails/hora en Supabase Auth (inservible)
- 6 min máximo por ejecución
- Gmail gratis: 100 emails/día

Solución: mover todo a Supabase Edge Functions. Los emails los envía cada cliente desde su propia cuenta (Gmail API / Microsoft Graph con OAuth). La plataforma no envía emails propios excepto los OTP de login/registro, que salen del Workspace Nonprofits existente (1,500/día).

### Costos

| Qué | Cuánto |
|---|---|
| Supabase gratis | $0 (hasta 500K invocaciones/mes ≈ 3,300 firmantes/día) |
| GitHub Pages | $0 |
| Cloudflare Tunnel | $0 |
| Dominio | ~$1 USD/mes |
| Emails, Drive, SMS | $0 (lo paga cada cliente) |
| **Total** | **~$1 USD/mes** |

Supabase Pro ($25 USD/mes) cuando crezca más.

---

## 4. Flujos

### 4.1 Registro del cliente

**Paso 1 — Tipo:** persona natural o jurídica.

**Paso 2 — Datos:**
- Natural: nombre, apellido, tipo doc, número, email, teléfono
- Jurídica: razón social, NIT, email empresa, teléfono empresa, nombre firmante, apellido, cargo, tipo doc, número

**Paso 3 — Consentimiento de servicio:** acepta términos de la plataforma + verificación OTP por SMS al teléfono que dio. Se registra y queda logueado.

### 4.2 Login

Email → OTP por email → verifica → dashboard.

### 4.3 Onboarding (primera vez)

1. **SMS Gateway:** descarga app Android (QR) → escanea QR de configuración (API key + HMAC secret + URL encriptados) → test SMS de prueba.
2. **Nube:** conecta Google Drive o OneDrive vía OAuth → selecciona carpeta → se crea el Google Sheet de historial automáticamente. Todo en la nube, sin opción local.

### 4.4 Dashboard

**Card: Documentos** — muestra los archivos que el cliente tiene en su Drive conectado. Solo lectura, solo visualización. El cliente crea y edita sus documentos en Drive directamente, no en la plataforma. Cuando solicite un consentimiento, selecciona cuáles embeber de esta lista.

**Card: Consentimientos** — lista de consentimientos que el cliente ha configurado. Cada uno tiene título, texto, y si es obligatorio o voluntario por defecto. Puede crear nuevos, editar, activar/desactivar.

**Botón: Solicitar consentimiento** — abre el formulario.

### 4.5 Solicitar consentimiento (single sign)

Tres modos:

**Persona natural:** nombre, apellido, tipo doc, número, email, teléfono.

**Persona jurídica:** razón social, NIT, email contacto, teléfono, nombre firmante, apellido, cargo, tipo doc, número.

**Menor de edad / con tutor:**

Datos del menor:
- Nombre, apellido
- Tipo doc: TI (tarjeta identidad, 7-17 años) o RC (registro civil, <7 años)
- Número, fecha de nacimiento (se valida que sea menor de 18)

Datos del representante legal:
- Nombre, apellido
- Tipo doc: CC / CE / PA
- Número
- Parentesco (madre, padre, tutor legal, representante legal, curador)
- Email (a donde llega el enlace)
- Teléfono (a donde llega el SMS OTP)

El OTP va al representante, nunca al menor. El representante marca los checkboxes. Verificar la relación tutor-menor es responsabilidad del cliente.

En el PDF queda: "Firmado por [representante], en calidad de [parentesco] del menor [nombre], nacido el [fecha]."

**Luego:**

Seleccionar documentos a embeber — el cliente ve sus archivos de Drive y elige cuáles incluir en esta solicitud.

Seleccionar consentimientos — lista con dos columnas de checkboxes:
- **Incluir:** cuáles aplican para esta solicitud
- **Obligatorio:** obligatoriedad para esta solicitud (voluntarios pueden cambiarse a obligatorios si el caso lo requiere)

Expiración del enlace (horas/días).

Enviar → el firmante recibe email con enlace.

### 4.6 Experiencia del firmante

1. Abre enlace del email → verificación factor 1 (acceso al email). Se registra IP, user agent, timestamp.
2. Ve sus datos (pre-llenados, read-only).
3. Lee documentos embebidos (iframe desde Drive del cliente, nunca pasan por la plataforma).
4. Marca consentimientos (checkbox "Leí y acepto", nunca prellenado). Los obligatorios impiden continuar.
5. Recibe OTP por SMS desde el número del cliente → ingresa 6 dígitos → verificación factor 2.
6. Ve confirmación: tabla con código, decisión, folio, hash por cada consentimiento.

### 4.7 Después de firmar

1. Se genera PDF (pdf-lib): documentos + datos firmante + evidencia + cada consentimiento con folio y hash + hash global
2. Se sube al Drive del cliente
3. Se agrega fila al Google Sheet de historial (fecha, firmante, documento, consentimientos, folio, hash, link PDF)
4. Se envía copia al firmante por email (desde la cuenta del cliente)
5. Se registra en audit_log
6. Se limpian datos personales de memoria

---

## 5. App Android — SMS Gateway

App en el teléfono del cliente. Recibe peticiones HTTPS de la plataforma, envía SMS desde la SIM del cliente.

**Vinculación:** QR del onboarding → configura API key + HMAC secret + URL automáticamente.

**Seguridad:** API Key + timestamp ±30s + nonce único + HMAC-SHA256 + rate limiting.

**Requisitos:** Android 8.0+, SIM activa, WiFi, Cloudflare Tunnel.

---

## 6. Base de datos

Supabase nuevo, proyecto independiente. Multi-tenant con RLS. 9 tablas.

### organizations
La persona siempre existe. La empresa solo si es jurídica.

- **id**
- **type** — natural / juridica
- **first_name**
- **last_name** — solo natural
- **doc_type** — CC/CE/PA/PEP/PPT/TI/NIT (jurídica → NIT automático)
- **doc_number**
- **email**
- **phone**
- **position** — solo jurídica
- **company_name** — solo jurídica
- **company_nit** — solo jurídica
- **plan** — trial/basic/pro/enterprise
- **active**
- **folio_prefix**
- **created_at, updated_at**

### org_oauth
Conexión a la nube del cliente.

- **id**
- **organization_id**
- **provider** — google_workspace / microsoft_365
- **access_token** — encriptado
- **refresh_token** — encriptado
- **token_expires_at**
- **drive_folder_id**
- **history_sheet_id**
- **sender_email**
- **created_at, updated_at**

### org_sms_config
Gateway SMS Android del cliente.

- **id**
- **organization_id**
- **gateway_url**
- **api_key** — encriptado
- **hmac_secret** — encriptado
- **enabled**
- **created_at, updated_at**

### consent_items
Consentimientos configurados por cada cliente.

- **id**
- **organization_id**
- **code** — C1, C2...
- **title**
- **description**
- **required** — obligatorio por defecto
- **sort_order**
- **active**
- **created_at, updated_at**

### signing_sessions_temp
Datos operativos en tránsito. Se borra al completar la firma.

- **id**
- **session_id**
- **documents** — JSONB con drive file IDs a embeber
- **consents** — JSONB con consentimientos y obligatoriedad
- **signer** — JSONB con datos del firmante
- **context**
- **created_at**

### signing_sessions_results
Registro permanente. Zero-knowledge. Solo hashes y folios.

- **id**
- **organization_id**
- **mode** — natural_personal / natural_tutor / juridica
- **access_token**
- **token_expires_at**
- **status** — pending/opened/reviewing/awaiting_otp/completed/expired/cancelled
- **folio**
- **pdf_hash**
- **consent_hashes** — JSONB
- **created_at, completed_at, expires_at**

### otp_tokens
Temporales. Se limpian automáticamente.

- **id**
- **email**
- **code_hash**
- **purpose** — login / register / sign
- **attempts**
- **expires_at**
- **verified_at**
- **created_at**

### folio_sequence
Secuencial atómico.

- **organization_id** (PK)
- **code** (PK)
- **year** (PK)
- **seq**

Función: `next_folio(org_id, code, year)`

### audit_log
Inmutable. Solo INSERT y SELECT.

- **id**
- **organization_id**
- **event_type**
- **event_data** — JSONB
- **ip**
- **ua**
- **created_at**

### Row Level Security

Cada tabla filtra por organization_id. Un cliente nunca ve datos de otro. El firmante accede a signing_sessions_results y signing_sessions_temp por access_token sin autenticación. audit_log no permite UPDATE ni DELETE. folio_sequence solo accesible por service_role (Edge Functions). OTP abierto — seguridad en Edge Function.

---

## 7. Seguridad

### Cadena de evidencia por cada firma

Token generado → email enviado → enlace abierto (factor 1: IP, user agent, hora) → documentos vistos → consentimientos marcados → OTP SMS enviado → OTP verificado (factor 2: IP, hora) → PDF generado (hash) → PDF en Drive → Sheet actualizado → copia al firmante.

### Amenazas

| Amenaza | Cómo se protege |
|---|---|
| Alguien se hace pasar por el firmante | Verificación dual: email + SMS |
| Alteran el PDF después de firmar | Hash SHA-256 + ambas partes tienen copia |
| Cambian un consentimiento | Hash individual + folio + tabla inmutable |
| Un cliente ve datos de otro | RLS con organization_id |
| Interceptan el OTP | HMAC + anti-replay + HTTPS |
| Hackean la plataforma | No hay documentos ni datos personales que robar |
| El firmante dice "yo no firmé" | Evidencia forense: IP, user agent, timestamps, hashes |
| Consentimiento de menor sin tutor | Formulario obliga datos del representante legal |

---

## 8. Almacenamiento en la nube

### Google Drive
OAuth 2.0 del cliente → Google Picker para seleccionar documentos → preview en iframe → verificación de permisos públicos → Google Sheets API para historial.

### OneDrive
OAuth 2.0 Microsoft → File Picker SDK → preview en iframe → permisos via Graph API.

El cliente elige cuál usa al conectar su cuenta. La plataforma tiene una capa de abstracción que funciona igual con ambos.

---

## 9. Pricing (COP)

| Plan | $/mes | Qué incluye |
|---|---|---|
| Trial | $0 (30 días) | 10 consentimientos, 2 documentos |
| Basic | $99.000 | 50/mes, 10 docs, email OTP |
| Pro | $199.000 | 200/mes, docs ilimitados, SMS OTP, API, branding |
| Enterprise | A medida | Ilimitado, soporte, SLA |

### Mercado

Consultorios, clínicas, IPS (50,000+ en Colombia), centros de estética, laboratorios, centros de psicología, ONGs, fundaciones, centros educativos.

---

## 10. Roadmap

**Fase 1 (2-3 sem):** Schema + Edge Functions OTP y consent + frontend registro/firma + SMS OTP.

**Fase 2 (2-3 sem):** Login + onboarding + dashboard (documentos, consentimientos, solicitar consentimiento con 3 modos).

**Fase 3 (2-3 sem):** Drive picker + OneDrive + Sheets historial + PDF con pdf-lib + API REST.

**Fase 4 (2-3 sem):** Landing + términos + facturación + Play Store + primeros 5 clientes.

---

## 11. Estructura del proyecto

```
firmaconsent/
├── frontend/
│   ├── index.html              (landing)
│   ├── pages/
│   │   ├── login.html          (OTP email)
│   │   ├── registro.html       (SMS OTP)
│   │   ├── onboarding.html     (SMS + nube)
│   │   ├── dashboard.html      (panel cliente)
│   │   ├── firma.html          (portal firmante)
│   │   └── solicitar.html      (solicitar consentimiento)
│   ├── css/
│   │   ├── tokens.css
│   │   └── componentes.css
│   ├── js/
│   │   ├── config.js
│   │   ├── auth.js
│   │   ├── firma.js
│   │   ├── dashboard.js
│   │   └── utils.js
│   └── assets/
├── supabase/
│   ├── migrations/
│   │   └── 001_initial_schema.sql
│   └── functions/
│       ├── otp-service/
│       ├── consent-service/
│       ├── drive-service/
│       └── pdf-generator/
├── android/
└── docs/
```

---

## 12. API REST (para integraciones)

```
POST /api/v1/consent/request
{
  "mode": "natural" | "juridica" | "menor",
  "signer": { nombre, apellido, tipoDoc, numero, email, telefono },
  "guardian": { ... },              // solo si menor
  "documents": ["drive_file_id"],   // archivos del Drive del cliente a embeber
  "consents": [
    { "id": "uuid", "required": true }
  ],
  "expiresInHours": 72,
  "context": "Programa X"
}

→ { sessionId, signingUrl, expiresAt, status: "pending" }
```

```
GET /api/v1/consent/status/{sessionId}
→ { status, completedAt, pdfHash, consents: { C1: {accepted, folio, hash} } }
```

---

## 13. Legal para operar

1. Términos de servicio (con encargado del tratamiento y disclaimer)
2. Política de privacidad
3. Aviso legal en portal del firmante
4. Registro RNBD ante SIC
5. Registro mercantil + RUT + facturación electrónica
6. Consulta jurídica recomendada: $1.5M — $3M COP una vez

---

*v2.3 — CARDAVIL — Mayo 2026*
