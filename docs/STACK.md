# Stack y Arquitectura

## Tecnologías

| Capa | Tecnología |
|---|---|
| Frontend | GitHub Pages (HTML/CSS/JS estático) |
| Backend | Supabase (PostgreSQL + Auth + Edge Functions) |
| Email OTP auth (login/registro) | Supabase Auth con SMTP propio configurado (email de la plataforma) |
| Email OTP firmante | Gmail API o Microsoft Graph via OAuth del cliente (zero-knowledge) |
| 2FA (Fase 1-2) | Email OTP únicamente |
| SMS (Fase 3) | App Android gateway en el teléfono del cliente, via Cloudflare Tunnel |
| WhatsApp (Fase 3) | WhatsApp Business API via cuenta propia de cada cliente |
| PDF | pdf-lib en Edge Function |
| Almacenamiento | Drive/OneDrive del cliente via OAuth |
| Historial | Google Sheet en la carpeta del cliente |

## Arquitectura

```
GitHub Pages              Supabase (gratis)           APIs del cliente
(HTML/CSS/JS)             (BD + Auth + Edge Fn)       (las paga el cliente)

Frontend ──────────►      PostgreSQL + RLS            
                          Edge Functions:             
                            admin-service             (métricas, orgs, analistas)
                            otp-service        ──────► Gmail API (del cliente)
                            consent-service    ──────► Drive API (del cliente)
                            signing-service    ──────► Sheets API (del cliente)
                            drive-service             
                            pdf-generator             
                                                      
                          Fase 3:                     
                            whatsapp-service   ──────► WhatsApp Business API
                            Gateway SMS (Android)       (cuenta del cliente)
                              via Cloudflare Tunnel     
```

## Por qué no GAS

El sistema anterior usa Google Apps Script. Con 200 clientes y 500 firmantes/día, GAS revienta:
- 90 min/día de ejecución total (no se puede pagar más)
- 2 emails/hora en Supabase Auth (inservible)
- 6 min máximo por ejecución
- Gmail gratis: 100 emails/día

Solución: todo en Supabase Edge Functions. Los emails del firmante los envía cada cliente desde su propia cuenta (Gmail API / Microsoft Graph con OAuth, zero-knowledge). La plataforma solo envía los OTP de login/registro, vía SMTP propio configurado en Supabase Auth (no el SMTP por defecto, limitado a 2/hora).

## Almacenamiento en la nube

### Google Drive
OAuth 2.0 del cliente → Google Picker para seleccionar documentos → preview en iframe → verificación de permisos públicos → Google Sheets API para historial.

### OneDrive
OAuth 2.0 Microsoft → File Picker SDK → preview en iframe → permisos via Graph API.

El cliente elige cuál usa al conectar su cuenta. La plataforma tiene una capa de abstracción que funciona igual con ambos.

## Costos

| Qué | Cuánto |
|---|---|
| Supabase gratis | $0 (hasta 500K invocaciones/mes ≈ 3,300 firmantes/día) |
| GitHub Pages | $0 |
| Cloudflare Tunnel | $0 |
| Dominio | ~$1 USD/mes |
| Emails, Drive, SMS | $0 (lo paga cada cliente) |
| **Total** | **~$1 USD/mes** |

Supabase Pro ($25 USD/mes) cuando crezca más.

## Estructura del proyecto

```
consentia/
├── frontend/
│   ├── index.html                        (landing)
│   ├── pages/
│   │   ├── login.html                    (OTP email)
│   │   ├── registro.html                 (registro cliente)
│   │   ├── onboarding.html               (conectar nube + correo, OAuth)
│   │   ├── dashboard.html                (panel cliente)
│   │   ├── consentimientos.html          (CRUD consent_items del cliente)
│   │   ├── consentimiento-solicitar.html (solicitar consentimiento, 3 modos)
│   │   ├── documento-solicitar.html      (solicitar firma — Fase 2)
│   │   ├── documento-editor.html         (editor visual drag & drop — Fase 2)
│   │   ├── firmar.html                   (portal firmante, ambos modos)
│   │   └── admin/                         (panel plataforma — dual-role)
│   │       ├── index.html                (indicadores / métricas)
│   │       ├── orgs.html                 (CRUD organizaciones)
│   │       ├── catalogs.html             (CRUD catalog_doc_types)
│   │       ├── audit.html                (log de auditoría)
│   │       └── analysts.html             (gestión analistas + permisos)
│   ├── css/
│   │   ├── tokens.css
│   │   └── componentes.css
│   ├── js/
│   │   ├── config.js                     (URL Supabase, publishable key)
│   │   ├── supabase-client.js            (init, auth helpers, wrappers)
│   │   ├── utils.js                      (toasts, validación, formato)
│   │   ├── otp-ui.js                     (inputs OTP, timer, paste)
│   │   ├── modales.js                    (abrir/cerrar modales)
│   │   ├── app-header.js                 (header compartido app+admin, dual-role)
│   │   ├── admin-guard.js                (sesión + permisos admin/analyst)
│   │   ├── admin-nav.js                  (nav tabs admin por permiso)
│   │   ├── login.js
│   │   ├── registro.js
│   │   ├── onboarding.js                 (OAuth Google/Microsoft)
│   │   ├── dashboard.js
│   │   ├── consentimientos.js            (CRUD consent_items)
│   │   ├── consentimiento-solicitar.js   (crear sesión de consentimiento)
│   │   ├── documento-solicitar.js        (Fase 2)
│   │   ├── documento-editor.js           (Fase 2)
│   │   ├── firmar.js                     (ambos modos, detecta session_type)
│   │   ├── admin-dashboard.js            (métricas)
│   │   ├── admin-orgs.js                 (CRUD orgs)
│   │   ├── admin-catalogs.js             (CRUD catálogos)
│   │   ├── admin-audit.js                (log auditoría)
│   │   └── admin-analysts.js             (gestión analistas)
│   └── assets/
├── supabase/
│   ├── migrations/
│   │   ├── 001_initial_schema.sql … 006_get_db_size.sql
│   │   ├── 007_session_type_otp_channel.sql
│   │   └── 008_schedule_cleanup.sql
│   └── functions/
│       ├── _shared/                       (cors, response, supabase, auth, otp, email_templates)
│       ├── admin-service/                 (métricas, orgs, invitaciones, permisos)
│       ├── otp-service/                   (OTP firmante vía correo del cliente)
│       ├── consent-service/               (create_session, sign, pdf.ts con pdf-lib)
│       ├── drive-service/                 (OAuth + providers/google + providers/microsoft)
│       ├── signing-service/               (Fase 2)
│       └── whatsapp-service/              (Fase 3)
├── android/                              (Fase 3)
└── docs/
```
