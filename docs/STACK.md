# Stack y Arquitectura

## Tecnologías

| Capa | Tecnología |
|---|---|
| Frontend | GitHub Pages (HTML/CSS/JS estático) |
| Backend | Supabase (PostgreSQL + Auth + Edge Functions) |
| Email | Gmail API o Microsoft Graph via OAuth del cliente |
| SMS | App Android gateway en el teléfono del cliente, via Cloudflare Tunnel |
| PDF | pdf-lib en Edge Function |
| Almacenamiento | Drive/OneDrive del cliente via OAuth |
| Historial | Google Sheet en la carpeta del cliente |

## Arquitectura

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

## Por qué no GAS

El sistema anterior usa Google Apps Script. Con 200 clientes y 500 firmantes/día, GAS revienta:
- 90 min/día de ejecución total (no se puede pagar más)
- 2 emails/hora en Supabase Auth (inservible)
- 6 min máximo por ejecución
- Gmail gratis: 100 emails/día

Solución: todo en Supabase Edge Functions. Los emails los envía cada cliente desde su propia cuenta (Gmail API / Microsoft Graph con OAuth). La plataforma no envía emails propios excepto los OTP de login/registro, que salen del Workspace Nonprofits existente (1,500/día).

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
│   │   ├── config.js           (URL Supabase, anon key)
│   │   ├── supabase-client.js  (init, auth helpers, wrappers)
│   │   ├── utils.js            (toasts, validación, formato)
│   │   ├── otp-ui.js           (inputs OTP, timer, paste)
│   │   ├── modales.js          (abrir/cerrar modales)
│   │   ├── login.js
│   │   ├── registro.js
│   │   ├── onboarding.js
│   │   ├── dashboard.js
│   │   ├── solicitar.js
│   │   └── firma.js
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
