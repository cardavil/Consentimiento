# Convenciones de Código

Cada capa tiene una sola responsabilidad:

```
tokens.css          → Define el vocabulario visual (variables)
     ↓
componentes.css     → Construye componentes reutilizables con esos tokens
     ↓
pages/*.html        → Estructura DOM pura, usa clases de componentes.css
     ↓                 (1 HTML = 1 vista de usuario)
js/compartidos      → Lógica reutilizable (auth, fetch, utils, modales)
     ↓
js/de-página        → Lógica específica de cada vista
                       (1 JS = 1 página = 1 vista de usuario)
```

---

## CSS: tokens.css + componentes.css

### tokens.css

Variables del design system. Cero colores hardcodeados en ningún archivo; todo se referencia por token.

Tokens definidos (ver `docs/mockups/manual-marca-consentia.html` para referencia visual):

| Categoría | Tokens |
|---|---|
| Colores base | --gris-azulado (#1E2A3A), --verde-profundo (#0F4C5C), --teal (#17B3A3), --azul-grisaceo (#5F7D95) |
| Fondos | --fondo (#F5F8FC), --teal-soft (#E6F7F5), --white (#FFFFFF) |
| Textos | --gris-oscuro (#1F2937), --gris-claro (#DCE5EE) |
| Estados | --teal-dark (#0E8A7D), --danger (#E74C3C) |
| Tipografía | --font-display (DM Serif Display), --font-body (DM Sans), --font-mono (IBM Plex Mono) |
| Bordes/sombras | --radius (10px cards), --radius-lg (16px panels), --shadow, --shadow-md |

### componentes.css

Clases reutilizables para botones, inputs, cards, badges, tablas, toggles, chips, modales.

- Toda clase reutilizable va aquí, nunca inline en páginas.
- `[hidden] { display: none !important; }` garantiza que `el.hidden = true/false` en JS siempre funcione, incluso sobre display: flex/grid.
- Estados semánticos (exito, alerta, progreso) usan tokens, no colores directos.

---

## Pages (pages/*.html)

Cada archivo HTML corresponde a una vista/pantalla concreta:

| Archivo | Vista del usuario | Quién la ve | Fase |
|---|---|---|---|
| login.html | Inicio de sesión OTP email | Clientes / admin | 1 |
| registro.html | Registro cliente | Clientes nuevos | 1 |
| onboarding.html | Conectar nube + correo (OAuth Google/Microsoft) | Clientes primera vez | 1 |
| dashboard.html | Panel del cliente | Clientes activos | 1 |
| consentimientos.html | CRUD de consentimientos del cliente (consent_items) | Clientes activos | 1 |
| consentimiento-solicitar.html | Formulario solicitar consentimiento (3 modos) | Clientes activos | 1 |
| documento-solicitar.html | Formulario solicitar firma electrónica (3 modos) | Clientes activos | 2 |
| documento-editor.html | Editor visual drag & drop plantillas (pdf.js) | Clientes activos | 2 |
| plantillas.html | CRUD de plantillas de firma | Clientes activos | 2 |
| firmar.html | Portal del firmante (ambos modos, detecta session_type) | Firmantes | 1 |
| admin/index.html | Indicadores / métricas de la plataforma | Admin / analyst | 1 |
| admin/orgs.html | CRUD organizaciones | Admin (analyst lectura) | 1 |
| admin/catalogs.html | CRUD catalog_doc_types | Admin / analyst con permiso | 1 |
| admin/audit.html | Log de auditoría paginado | Admin / analyst con permiso | 1 |
| admin/analysts.html | Gestión de analistas + permisos | Solo admin | 1 |

### Reglas HTML

- Solo estructura y DOM. Cero lógica, cero `<script>` inline con código.
- Cada página carga sus JS con `<script src="../js/...">` al final del body.
- Cada página incluye Google Fonts via `<link>`, marca-barra (colores del design system), y skip link de accesibilidad.
- Inputs con `<label for="id">`, `aria-required`, `aria-describedby` para errores.
- Formularios con `novalidate` — la validación es en JS, no nativa del browser.

---

## JS: compartidos

Usados por 2+ páginas.

| Archivo | Responsabilidad |
|---|---|
| config.js | URL de Supabase, publishable key (datos públicos, nunca secrets) |
| supabase-client.js | Init Supabase, auth helpers, wrappers de fetch, `init_app_page()` (bootstrap de página) |
| utils.js | Toasts, validación, formato, helpers UI |
| otp-ui.js | Lógica OTP parametrizada (inputs, timer, paste, reenvío) |
| app-header.js | Header compartido app + admin, navegación dual-role (org ↔ panel admin) |
| signer-form.js | Form de firmante 3 modos compartido (setup_signer_form, build_signer, get_signer_mode) |
| admin-guard.js | Sesión + permisos admin (is_admin, has_permission, require_permission) |
| admin-nav.js | Render de tabs admin filtradas por rol y permisos |

## JS: de página

1 archivo = 1 página = 1 vista de usuario.

| Archivo | Página | Fase |
|---|---|---|
| login.js | login.html | 1 |
| registro.js | registro.html | 1 |
| onboarding.js | onboarding.html | 1 |
| dashboard.js | dashboard.html | 1 |
| consentimientos.js | consentimientos.html | 1 |
| consentimiento-solicitar.js | consentimiento-solicitar.html | 1 |
| documento-solicitar.js | documento-solicitar.html | 2 |
| documento-editor.js | documento-editor.html | 2 |
| plantillas.js | plantillas.html | 2 |
| firmar-fields.js | firmar.html (modo firma: render campos + pad) | 2 |
| firmar.js | firmar.html (ambos modos) | 1 |
| admin-dashboard.js | admin/index.html | 1 |
| admin-orgs.js | admin/orgs.html | 1 |
| admin-catalogs.js | admin/catalogs.html | 1 |
| admin-audit.js | admin/audit.html | 1 |
| admin-analysts.js | admin/analysts.html | 1 |

### Orden de carga

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="../js/config.js"></script>
<script src="../js/supabase-client.js"></script>
<script src="../js/utils.js"></script>
<!-- compartidos específicos si aplica -->
<script src="../js/[pagina].js"></script>
```

### Convenciones JS

**Naming:** inglés con snake_case (`get_session`, `on_click_submit`, `show_error`).

**Obligatorio:**
- `check_session()` antes de queries a Supabase. Excepto firmante que usa access_token.
- No queries directas desde funciones de UI — siempre por helpers en supabase-client.js.
- `show_error()` siempre en catch. Nunca catch vacío, nunca solo console.log.
- Botones async: disable + texto "Saving..."/"Sending..." + rehabilitar en `finally`.
- Debounce 300ms en búsquedas.
- Max 50 líneas por función. Si crece, dividir.
- `const` por defecto, `let` solo si se reasigna, `var` prohibido.

---

## Edge Functions (supabase/functions/)

| Función | Responsabilidad | Fase |
|---|---|---|
| admin-service | Panel plataforma: métricas, CRUD orgs, invitar analistas, permisos, bootstrap org | 1 |
| otp-service | Generar/verificar OTP; router de canal del firmante (email/sms/whatsapp) | 1 |
| consent-service | create_session + sign; incluye `pdf.ts` (constancia con pdf-lib) | 1 |
| drive-service | OAuth, list/upload/download, Sheet, envío de correo; `providers/google` + `providers/microsoft` | 1 |
| signing-service | create_template, create_session, sign, get_document, get_channels; `pdf_firma.ts` | 2 |
| config-service | Guardar config SMS/WhatsApp encriptada + pruebas | 3 |
| whatsapp-service | Implementado como `_shared/channels/whatsapp.ts` (no función propia); SMS en `channels/sms.ts` | 3 |

### Convenciones Edge Functions

- TypeScript/Deno. Imports con URLs o import maps.
- Toda función usa `service_role` para operaciones en BD (bypasea RLS).
- `ENCRYPTION_KEY` se lee de `Deno.env.get('ENCRYPTION_KEY')` y se pasa como parámetro a encrypt_secret/decrypt_secret.
- Validar input al inicio. Retornar 400 con mensaje claro si falla.
- Response: `{ ok: true, data }` o `{ ok: false, error: "mensaje" }`.
- Log con contexto: `console.error({ fn, error, input })`.
- No almacenar datos del firmante fuera de signing_sessions_temp.

---

## No aplica (del proyecto anterior)

| Archivo | Por qué no aplica |
|---|---|
| gas-client.js | GAS eliminado. Todo es Supabase Edge Functions. |
| labels.js | No hay labels compartidos. |
| consentimientos.js | Dinámicos por org (consent_items en BD), no hardcoded C1-C7. |
| mi-expediente.html | No existe en Consentia. |
| accesos.html | No existe en Consentia. |
